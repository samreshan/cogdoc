import { db } from '@/lib/db'
import { ingestToVectorStore } from '@/lib/ai-gateway'

/** Index existing canonical chunk IDs so retrieved passages keep valid provenance. */
export async function indexSourceChunks(projectId: string, pdfId: string) {
  const pdf = await db.pdf.findFirst({ where: { id: pdfId, projectId }, select: { id: true } })
  if (!pdf) throw new Error('Source does not belong to this workspace.')
  const chunks = await db.pdfChunk.findMany({ where: { pdfId }, orderBy: { chunkIndex: 'asc' } })
  if (!chunks.length) return { count: 0, chunkIds: [] }
  return ingestToVectorStore(projectId, pdfId, chunks.map((chunk) => ({ chunk_id: chunk.id, content: chunk.content, page_approx: chunk.pageApprox })))
}
