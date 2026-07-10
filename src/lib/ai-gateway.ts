/**
 * AI Gateway — the single integration seam between the Next.js BFF and the
 * FastAPI RAG service.
 *
 * This is the ONE shared merge point in the multi-agent build (PRODUCT.md §18
 * coordination rule 1): streams D (SSE) and B (Citation Sentinel) both touch
 * this file and queue, never edit concurrently.
 *
 * The gateway translates FastAPI responses into the SAME RetrievedChunk[]
 * shape the keyword retrieval path produces, so the citation route is
 * unchanged whether the USE_VECTOR_RETRIEVAL flag is on or off.
 *
 * Sprint 1: vector retrieval. Sprint 2: SSE streaming + engine gateway.
 */
import type { RetrievedChunk } from '@/lib/retrieval'

/**
 * The FastAPI base URL. Read per-call (not module-load) so tests and runtime
 * config changes take effect without a reload.
 */
function fastApiUrl(): string {
  return process.env.FASTAPI_URL ?? 'http://localhost:8000'
}

/**
 * Retrieve top-k chunks via the FastAPI vector-retrieval service.
 * Returns RetrievedChunk[] in the same shape as the keyword path
 * (src/lib/retrieval.ts) so callers are agnostic to the retrieval backend.
 */
export async function retrieveVectorChunks(
  projectId: string,
  claim: string,
  topK = 5,
): Promise<RetrievedChunk[]> {
  const res = await fetch(`${fastApiUrl()}/api/rag/retrieve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ claim, project_id: projectId, top_k: topK }),
  })
  if (!res.ok) {
    throw new Error(`FastAPI retrieve failed: ${res.status}`)
  }
  const data = (await res.json()) as {
    passages: Array<{
      chunk_id: string
      pdf_id: string
      text: string
      score: number
      page_approx: number
      pdf_filename: string
    }>
  }
  return data.passages.map((p) => ({
    chunkId: p.chunk_id,
    content: p.text,
    similarityScore: p.score,
    pageApprox: p.page_approx,
    pdfFilename: p.pdf_filename,
  }))
}

/**
 * Whether the system should use the FastAPI vector-retrieval path.
 * Off by default; the citation route flips to vector retrieval when true.
 * The keyword path stays as the ablation baseline (PRODUCT.md §14.3).
 */
export function useVectorRetrieval(): boolean {
  return process.env.USE_VECTOR_RETRIEVAL === 'true' || process.env.USE_VECTOR_RETRIEVAL === '1'
}
