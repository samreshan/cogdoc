import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/auth-supabase'
import { retrieveVectorChunks } from '@/lib/ai-gateway'
import { indexSourceChunks } from '@/lib/source-indexing'
export const runtime = 'nodejs'
export const maxDuration = 120
async function owned(req: NextRequest, id: string) {
  const userId = await requireUserId(req)
  return db.project.findFirst({ where: { id, userId, deletedAt: null }, select: { id: true, description: true } })
}
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const project = await owned(req, id)
  if (!project) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  const demoTopicId = project.description?.match(/\[demo-topic:([^\]]+)\]/)?.[1] ?? null
  const chunks = await db.pdfChunk.count({ where: { pdf: { projectId: id } } })
  try {
    const rows = await db.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*) AS count FROM "PdfChunk" c JOIN "Pdf" p ON p.id=c."pdfId" WHERE p."projectId"=${id} AND c.embedding IS NOT NULL`
    return NextResponse.json({ demoTopicId, chunks, embedded: Number(rows[0]?.count ?? 0), storage: 'PostgreSQL pgvector', dimensions: 3072 })
  } catch { return NextResponse.json({ demoTopicId, chunks, embedded: 0, error: 'Vector schema unavailable. Run the vector-init service.' }, { status: 503 }) }
}
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!await owned(req, id)) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  const body = await req.json().catch(() => ({}))
  try {
    if (body.action === 'index') {
      const pdfs = await db.pdf.findMany({ where: { projectId: id }, select: { id: true }, take: 10 })
      let indexed = 0
      for (const pdf of pdfs) indexed += (await indexSourceChunks(id, pdf.id)).count
      return NextResponse.json({ indexed })
    }
    if (typeof body.query !== 'string' || !body.query.trim() || body.query.length > 3000) return NextResponse.json({ error: 'Enter a search question (up to 3000 characters).' }, { status: 400 })
    const ranked = await retrieveVectorChunks(id, body.query, 5)
    const chunks = await db.pdfChunk.findMany({ where: { id: { in: ranked.map((item) => item.chunkId) }, pdf: { projectId: id } }, include: { pdf: { select: { librarySourceId: true } } } })
    const sources = await db.workspaceSource.findMany({ where: { projectId: id }, select: { id: true, librarySourceId: true } })
    const passages = ranked.flatMap((item) => {
      const chunk = chunks.find((entry) => entry.id === item.chunkId)
      if (!chunk) return []
      const source = sources.find((entry) => entry.librarySourceId === chunk.pdf.librarySourceId)
      return [{ ...item, content: chunk.content, workspaceSourceId: source?.id ?? null }]
    })
    return NextResponse.json({ passages, method: 'semantic cosine similarity' })
  } catch { return NextResponse.json({ error: 'Semantic retrieval is unavailable. Check the RAG service and embedding configuration, then retry. Your source text is still saved.' }, { status: 503 }) }
}
