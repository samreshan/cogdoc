/**
 * PUT /api/projects/[id]/document — save the document content (auto-save)
 *
 * Phase 6: this was the only mutation route without auth. Now wrapped so an
 * unauthenticated request gets a clean 401 (matches all other mutation routes).
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/auth-supabase'
import { canonicalDocumentString } from '@/lib/document-content'
import { sha256 } from '@/lib/crypto'
import { appendAuditEvent } from '@/lib/workspace-server'
import { enqueueBackgroundEnginePrompt, enqueueClericalResearchJobs } from '@/lib/research-jobs'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const userId = await requireUserId(req)
  const body = await req.json().catch(() => ({}))
  const content = typeof body.content === 'string' ? body.content : ''
  const baseRevision = Number.isInteger(body.baseRevision) ? Number(body.baseRevision) : null

  // Verify the project belongs to the acting user (isolation, §8).
  const project = await db.project.findUnique({ where: { id }, select: { userId: true, document: true } })
  if (!project || project.userId !== userId) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  if (baseRevision !== null && project.document && baseRevision !== project.document.revision) {
    return NextResponse.json({
      error: 'This document changed in another session.',
      code: 'revision_conflict',
      serverRevision: project.document.revision,
      serverContent: project.document.content,
    }, { status: 409 })
  }

  const canonical = canonicalDocumentString(content)
  const contentHash = sha256(canonical)
  const document = await db.$transaction(async (tx) => {
    const saved = await tx.document.upsert({
      where: { projectId: id },
      update: { content: canonical, contentHash, revision: { increment: 1 }, lastSaved: new Date() },
      create: { projectId: id, content: canonical, contentHash, revision: 1, lastSaved: new Date() },
    })
    await tx.project.update({ where: { id }, data: { updatedAt: new Date(), lifecycleState: 'draft' } })
    await tx.certificate.updateMany({
      where: { projectId: id, status: 'valid' },
      data: { status: 'superseded', supersededAt: new Date() },
    })
    await appendAuditEvent(tx, {
      projectId: id,
      userId,
      type: 'document_saved',
      documentHash: contentHash,
      payload: { revision: saved.revision },
    })
    return saved
  })

  // Autosave stays low-latency; clerical research work runs on the leased
  // PostgreSQL queue and may safely retry without changing the saved draft.
  void enqueueClericalResearchJobs(id, 'document_save', `${document.id}:${document.revision}`)
    .catch((error) => console.warn('Research jobs could not be enqueued:', (error as Error).message))
  void enqueueBackgroundEnginePrompt({ projectId: id, trigger: 'document_saved', entityId: `${document.id}:${document.revision}` })
    .catch((error) => console.warn('Background engine prompt could not be enqueued:', (error as Error).message))

  return NextResponse.json({ ok: true, lastSaved: document.lastSaved, revision: document.revision, contentHash })
}
