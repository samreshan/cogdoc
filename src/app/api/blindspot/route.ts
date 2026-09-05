/**
 * POST /api/blindspot — Blindspot Monitor (PRODUCT.md §7.2).
 * Body: { projectId, draft, friction_mode? }
 *
 * Finds the most-relevant library passage the user has NOT already cited (not in
 * any Citation Sentinel evidence set) and surfaces it as a [Lens] margin prompt.
 * This attacks one-sided evidence use: the overlooked counter-evidence.
 *
 * One-per-session anti-fatigue is enforced client-side (store flag); this route
 * just computes the result when invoked.
 *
 * The scoring uses keyword overlap (consistent with the keyword retrieval
 * baseline). A real embedding model (Phase 4) plugs in via findBlindspot's
 * scoring seam.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/auth-supabase'
import { findBlindspot, type LibraryPassage } from '@/lib/blindspot'
import { appendAuditEvent } from '@/lib/workspace-server'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { projectId, draft } = body as { projectId: string; draft: string }

  if (!projectId || !draft) {
    return NextResponse.json({ error: 'projectId and draft are required' }, { status: 400 })
  }

  const userId = await requireUserId(req)
  const project = await db.project.findUnique({ where: { id: projectId, userId } })
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  // The library: this project's PdfChunks.
  const chunks = await db.pdfChunk.findMany({
    where: { pdf: { projectId } },
    select: { id: true, content: true },
  })
  const library: LibraryPassage[] = chunks.map((c) => ({ chunk_id: c.id, text: c.content }))

  // The cited set: chunk_ids already used as Citation Sentinel evidence.
  const citationInterventions = await db.intervention.findMany({
    where: { projectId, engineType: 'citation' },
    select: { id: true },
  })
  const citedChunkIds = new Set<string>()
  if (citationInterventions.length > 0) {
    const evidence = await db.interventionEvidence.findMany({
      where: { interventionId: { in: citationInterventions.map((i) => i.id) } },
      select: { chunkId: true },
    })
    for (const e of evidence) citedChunkIds.add(e.chunkId)
  }

  const result = findBlindspot({ draft, library, citedChunkIds })

  if (!result) {
    return NextResponse.json({ blindspot: null })
  }

  const intervention = await db.$transaction(async (tx) => {
    const created = await tx.intervention.create({
      data: {
        userId,
        projectId,
        promptTemplateTag: 'Lens',
        engineType: 'blindspot',
        promptText: draft.slice(0, 200),
        responseText: result.text.slice(0, 500),
        status: 'active',
      },
    })
    await appendAuditEvent(tx, {
      projectId, userId, type: 'intervention_created', actor: 'system',
      modelVersion: 'deterministic', promptVersion: 'blindspot-lens-v1',
      payload: { summary: 'Cogdoc surfaced an overlooked source passage', interventionId: created.id, engineType: 'blindspot', chunkId: result.chunk_id },
    })
    return created
  })

  return NextResponse.json({
    blindspot: {
      chunkId: result.chunk_id,
      text: result.text,
      relevance: result.relevance,
    },
    intervention,
  })
}
