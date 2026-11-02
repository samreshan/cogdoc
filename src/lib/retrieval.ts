/**
 * Explicit keyword fallback alongside the FastAPI pgvector cosine similarity
 * retrieval used by the Citation Sentinel in the architecture doc.
 *
 * The canonical database is PostgreSQL. This fallback approximates relevance
 * with TF-IDF-style keyword overlap. For an FYP prototype this is sufficient
 * to demonstrate the RAG pattern; the architecture is vector-DB-ready.
 */
import { db } from '@/lib/db'

// Common English stop words to filter out
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'then', 'else', 'when', 'where',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
  'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
  'must', 'can', 'to', 'of', 'in', 'on', 'at', 'by', 'for', 'with', 'about',
  'against', 'between', 'into', 'through', 'during', 'before', 'after',
  'above', 'below', 'from', 'up', 'down', 'out', 'off', 'over', 'under',
  'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we',
  'they', 'them', 'their', 'his', 'her', 'its', 'our', 'your',
  'as', 'than', 'so', 'such', 'very', 'too', 'also', 'just', 'only', 'even',
  'not', 'no', 'nor', 'yet',
])

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
}

/**
 * Pure Jaccard-overlap similarity scorer.
 *
 * Extracted from retrieveTopK so the scoring math is unit-testable without a
 * DB. Computes |intersection| / |union| of the token sets. Returns 0 if the
 * union is empty.
 *
 * @internal — exported only for testing; the contract is Jaccard similarity.
 */
export function _scoreChunks(
  queryTokens: Set<string>,
  chunkTokens: string[],
): number {
  if (chunkTokens.length === 0) return 0
  const chunkTokenSet = new Set(chunkTokens)
  let intersection = 0
  for (const t of queryTokens) {
    if (chunkTokenSet.has(t)) intersection++
  }
  const union = new Set([...queryTokens, ...chunkTokens]).size
  return union === 0 ? 0 : intersection / union
}

export interface RetrievedChunk {
  chunkId: string
  content: string
  similarityScore: number
  pageApprox: number
  pdfFilename: string
}

/**
 * Retrieve the top-k chunks from a project's PDF library whose keywords
 * overlap most with the query. Returns at most `k` chunks above the
 * minimum similarity threshold.
 */
export async function retrieveTopK(
  projectId: string,
  query: string,
  k = 5,
  minScore = 0.05,
): Promise<RetrievedChunk[]> {
  const queryTokens = new Set(tokenize(query))
  if (queryTokens.size === 0) return []

  const chunks = await db.pdfChunk.findMany({
    where: { pdf: { projectId } },
    include: { pdf: { select: { filename: true } } },
  })

  if (chunks.length === 0) return []

  const scored = chunks.map((chunk) => {
    const chunkTokens = tokenize(chunk.content)
    const score = _scoreChunks(queryTokens, chunkTokens)
    return {
      chunk,
      score,
      pdfFilename: chunk.pdf.filename,
    }
  })

  return scored
    .filter((s) => s.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((s) => ({
      chunkId: s.chunk.id,
      content: s.chunk.content,
      similarityScore: s.score,
      pageApprox: s.chunk.pageApprox,
      pdfFilename: s.pdfFilename,
    }))
}

/**
 * Chunk a long text into ~500-token passages (approximated as ~2500 chars).
 * Tag each chunk with an approximate page number (~3000 chars per page).
 */
export function chunkText(text: string): { content: string; charCount: number; pageApprox: number; chunkIndex: number }[] {
  const size = 2500
  const overlap = 250
  const chunks: { content: string; charCount: number; pageApprox: number; chunkIndex: number }[] = []
  let start = 0
  while (start < text.length) {
    let end = Math.min(start + size, text.length)
    if (end < text.length) {
      const window = text.slice(start, end)
      const paragraph = window.lastIndexOf('\n\n')
      const space = window.lastIndexOf(' ')
      const boundary = paragraph >= size / 2 ? paragraph : space
      if (boundary >= size / 2) end = start + boundary
    }
    const content = text.slice(start, end).trim()
    if (content) chunks.push({ content, charCount: content.length, pageApprox: Math.floor(start / 3000) + 1, chunkIndex: chunks.length })
    if (end === text.length) break
    start = Math.max(start + 1, end - overlap)
    const wordBoundary = text.slice(start, start + 40).search(/\s/)
    if (wordBoundary > 0) start += wordBoundary + 1
  }
  return chunks
}
