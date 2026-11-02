import { indexSourceChunks } from '@/lib/source-indexing'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/auth-supabase'
import { putPrivateAsset } from '@/lib/private-storage'
import { chunkText } from '@/lib/retrieval'
import { assessSourceQuality, canonicalizeSourceUrl, contentDigest, normalizeDoi } from '@/lib/research-source'
import { enqueueBackgroundEnginePrompt, enqueueClericalResearchJobs } from '@/lib/research-jobs'
import { appendAuditEvent } from '@/lib/workspace-server'
import { currentFindingIdsForWorkspaceSource, invalidateFindingReviews } from '@/lib/finding-review-invalidation'

export const runtime = 'nodejs'
export const maxDuration = 60

async function ownedWorkspace(req: NextRequest, projectId: string) {
  const userId = await requireUserId(req)
  const project = await db.project.findFirst({ where: { id: projectId, userId, deletedAt: null }, select: { id: true, userId: true } })
  return { userId, project }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { project } = await ownedWorkspace(req, id)
  if (!project) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  const sources = await db.workspaceSource.findMany({ where: { projectId: id }, include: { source: true }, orderBy: [{ lastOpenedAt: 'desc' }, { updatedAt: 'desc' }] })
  const readable = await db.pdf.findMany({ where: { projectId: id, chunks: { some: {} } }, select: { librarySourceId: true } })
  const localIds = new Set(readable.map((pdf) => pdf.librarySourceId))
  return NextResponse.json({ sources: sources.map((row) => localIds.has(row.librarySourceId) ? { ...row, source: { ...row.source, parseStatus: 'ready' } } : row) })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { userId, project } = await ownedWorkspace(req, id)
  if (!project) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  let title = ''
  let filename: string | null = null
  let doi: string | null = null
  let canonicalUrl: string | null = null
  let mimeType: string | null = null
  let bytes: Buffer | null = null
  let rawText = ''
  let metadata: Record<string, unknown> = {}
  let librarySourceId: string | null = null

  if ((req.headers.get('content-type') ?? '').includes('multipart/form-data')) {
    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'A PDF file is required' }, { status: 400 })
    if (file.type !== 'application/pdf') return NextResponse.json({ error: 'Only PDF sources are supported' }, { status: 400 })
    bytes = Buffer.from(await file.arrayBuffer())
    filename = file.name.slice(0, 240)
    title = filename.replace(/\.pdf$/i, '')
    mimeType = file.type
    try {
      const { PDFParse } = await import('pdf-parse')
      const parser = new PDFParse({ data: bytes })
      const parsed = await parser.getText()
      await parser.destroy()
      rawText = parsed.text ?? ''
    } catch (error) {
      return NextResponse.json({ error: `PDF parse failed: ${(error as Error).message}` }, { status: 400 })
    }
  } else {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    librarySourceId = typeof body.librarySourceId === 'string' ? body.librarySourceId : null
    title = typeof body.title === 'string' ? body.title.trim().slice(0, 500) : ''
    doi = normalizeDoi(body.doi)
    canonicalUrl = canonicalizeSourceUrl(body.canonicalUrl ?? body.url)
    metadata = typeof body.metadata === 'object' && body.metadata ? body.metadata as Record<string, unknown> : {}
  }

  if (librarySourceId) {
    const source = await db.librarySource.findFirst({ where: { id: librarySourceId, userId } })
    if (!source) return NextResponse.json({ error: 'Library source not found' }, { status: 404 })
    const workspaceSource = await db.$transaction(async (tx) => {
      const linked = await tx.workspaceSource.upsert({ where: { projectId_librarySourceId: { projectId: id, librarySourceId } }, update: { status: 'saved' }, create: { projectId: id, librarySourceId } , include: { source: true } })
      await appendAuditEvent(tx, { projectId: id, userId, type: 'workspace_source_attached', actor: 'student', payload: { summary: `Attached source: ${source.title}`, workspaceSourceId: linked.id, librarySourceId, reused: true } })
      return linked
    })
    return NextResponse.json({ workspaceSource, alreadySaved: true })
  }

  if (!title) return NextResponse.json({ error: 'A source title is required' }, { status: 400 })
  if (!bytes && !doi && !canonicalUrl) return NextResponse.json({ error: 'Provide a PDF, DOI, or canonical URL' }, { status: 400 })
  const hash = bytes ? contentDigest(bytes) : null
  const existing = await db.librarySource.findFirst({ where: { userId, OR: [...(doi ? [{ doi }] : []), ...(canonicalUrl ? [{ canonicalUrl }] : []), ...(hash ? [{ contentHash: hash }] : [])] } })
  const quality = assessSourceQuality({ doi, canonicalUrl, fullText: Boolean(rawText), metadata })
  let source = existing
  if (!source) {
    const storage = bytes ? await putPrivateAsset(id, filename ?? 'source.pdf', bytes, mimeType ?? 'application/pdf') : null
    source = await db.librarySource.create({ data: {
      userId, title, filename, doi, canonicalUrl, contentHash: hash, mimeType,
      sizeBytes: bytes?.byteLength ?? 0, parseStatus: rawText ? 'ready' : 'metadata_only',
      storageProvider: storage?.provider, storageKey: storage?.key,
      metadataJson: JSON.stringify(metadata), qualityScore: quality.score, qualityExplanation: quality.explanation,
    } })
  }
  const workspaceSource = await db.workspaceSource.upsert({ where: { projectId_librarySourceId: { projectId: id, librarySourceId: source.id } }, update: { status: 'saved' }, create: { projectId: id, librarySourceId: source.id }, include: { source: true } })
  let indexingWarning: string | undefined
  if (rawText && !existing) {
    const pdf = await db.pdf.create({ data: { projectId: id, userId, filename: filename ?? title, rawText, sizeBytes: bytes?.byteLength ?? 0, parseStatus: 'ready', librarySourceId: source.id } })
    const chunks = chunkText(rawText)
    if (chunks.length) await db.pdfChunk.createMany({ data: chunks.map((chunk) => ({ pdfId: pdf.id, chunkIndex: chunk.chunkIndex, content: chunk.content, charCount: chunk.charCount, pageApprox: chunk.pageApprox })) })
    try { await indexSourceChunks(id, pdf.id) } catch { indexingWarning = 'Source text is saved; semantic indexing failed. Retry indexing in Sources.' }
  }
  await db.$transaction((tx) => appendAuditEvent(tx, { projectId: id, userId, type: 'workspace_source_attached', actor: 'student', payload: { summary: `${existing ? 'Reused' : 'Added'} source: ${source.title}`, workspaceSourceId: workspaceSource.id, librarySourceId: source.id, reused: Boolean(existing), privateFile: Boolean(bytes) } }))
  void enqueueClericalResearchJobs(id, 'source_import', source.id).catch((error) => console.warn('Research jobs could not be enqueued:', (error as Error).message))
  void enqueueBackgroundEnginePrompt({ projectId: id, trigger: 'source_added', entityId: workspaceSource.id })
    .catch((error) => console.warn('Background engine prompt could not be enqueued:', (error as Error).message))
  return NextResponse.json({ workspaceSource, alreadySaved: Boolean(existing), indexingWarning }, { status: existing ? 200 : 201 })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { userId, project } = await ownedWorkspace(req, id)
  if (!project) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  const body = await req.json().catch(() => ({}))
  const workspaceSource = await db.workspaceSource.findFirst({ where: { id: String(body.workspaceSourceId ?? ''), projectId: id } })
  if (!workspaceSource) return NextResponse.json({ error: 'Workspace source not found' }, { status: 404 })
  await db.$transaction(async (tx) => {
    const findingIds = await currentFindingIdsForWorkspaceSource(tx as never, id, workspaceSource.id)
    await invalidateFindingReviews(tx as never, {
      projectId: id,
      userId,
      findingIds,
      reason: 'A source used by the current finding was removed from this workspace.',
      changed: { kind: 'removal', id: workspaceSource.id },
    })
    await tx.workspaceSource.delete({ where: { id: workspaceSource.id } })
    await appendAuditEvent(tx, { projectId: id, userId, type: 'workspace_source_detached', actor: 'student', payload: { summary: 'Removed a source from this project', workspaceSourceId: workspaceSource.id, librarySourceId: workspaceSource.librarySourceId, librarySourceRetained: true } })
  })
  return NextResponse.json({ ok: true, librarySourceRetained: true })
}
