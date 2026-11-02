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
import { parseSSEEvents, type SSEEvent } from '@/lib/sse'

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
    signal: AbortSignal.timeout(30000),
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
export function isVectorRetrievalEnabled(): boolean {
  return process.env.USE_VECTOR_RETRIEVAL === 'true' || process.env.USE_VECTOR_RETRIEVAL === '1'
}

/**
 * A pre-chunked passage pushed into the FastAPI vector store on ingest.
 * The BFF owns BOTH the content and the chunk_id (a SQLite PdfChunk.id cuid),
 * so FastAPI stores them verbatim and never re-chunks.
 */
export interface IngestChunk {
  content: string
  chunk_id: string
  page_approx: number
}

/** Result of a successful ingest push to FastAPI. */
export interface VectorIngestResult {
  /** The chunk ids FastAPI stored, verbatim — must match the input ids. */
  chunkIds: string[]
  /** Number of chunks ingested. */
  count: number
}

/**
 * Push freshly-created PDF chunks into the FastAPI vector store.
 *
 * DESIGN DECISION — chunk_id alignment (task spec option A):
 * We send explicit `chunks: [{content, chunk_id, page_approx}]` rather than
 * raw `{text}`. The BFF has already chunked the text and persisted PdfChunk rows
 * in SQLite (each with a cuid id). By handing those exact ids to FastAPI, the
 * vector store's chunk ids == SQLite PdfChunk.id. That way, when the Citation
 * Sentinel later retrieves evidence and persists `InterventionEvidence.chunkId`,
 * those ids are real foreign keys into SQLite and evidence deep-links resolve.
 * (Sending raw `{text}` would make FastAPI re-chunk and emit `chunk-N` ids that
 * point at non-existent SQLite rows — broken deep-links / FK violations.)
 *
 * The FastAPI endpoint is backwards-compatible: callers that still send only
 * `{text}` get the auto-chunk path.
 *
 * THROWS on non-2xx or network error. The upload route wraps this in a
 * try/catch so a FastAPI outage degrades gracefully (SQLite chunks are the
 * source of truth; the app stays usable on the keyword path).
 *
 * NOTE: persistence depends on the FastAPI store (ADR-0008). With
 * EMBEDDING_PROVIDER=gemini + SUPABASE_DB_URL set, the service runs on
 * PgvectorStore and ingested chunks survive restarts. The in-memory fallback
 * (offline dev / tests) is ephemeral — a restart there loses ingested chunks
 * until the PDFs are re-uploaded.
 */
export async function ingestToVectorStore(
  projectId: string,
  pdfId: string,
  chunks: IngestChunk[],
): Promise<VectorIngestResult> {
  const res = await fetch(`${fastApiUrl()}/api/rag/ingest`, {
    signal: AbortSignal.timeout(60000),
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project_id: projectId,
      pdf_id: pdfId,
      chunks,
    }),
  })
  if (!res.ok) {
    throw new Error(`FastAPI ingest failed: ${res.status}`)
  }
  const data = (await res.json()) as {
    chunks: Array<{ chunk_id: string; chunk_index: number; page_approx: number }>
  }
  return {
    chunkIds: data.chunks.map((c) => c.chunk_id),
    count: data.chunks.length,
  }
}

/**
 * Stream an engine intervention from the FastAPI service as an async iterator
 * of typed SSE events (PRODUCT.md §12.3).
 *
 * The consumer buffers partial chunks across network reads and only emits
 * events once their dispatching blank line arrives — so a slow token stream
 * yields token events as they complete, never half-formed.
 *
 * @param engine one of: interceptor | socratic | citation | scaffold
 * @param payload the engine-specific request body
 */
export async function* streamIntervention(
  engine: 'interceptor' | 'socratic' | 'citation' | 'scaffold',
  payload: Record<string, unknown>,
): AsyncGenerator<SSEEvent> {
  const res = await fetch(`${fastApiUrl()}/api/ai/${engine}/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok || !res.body) {
    throw new Error(`FastAPI stream failed: ${res.status}`)
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      // Emit any complete events; retain the trailing partial in the buffer.
      if (buffer.includes('\n\n')) {
        const lastDispatch = buffer.lastIndexOf('\n\n') + 2
        const complete = buffer.slice(0, lastDispatch)
        buffer = buffer.slice(lastDispatch)
        for (const event of parseSSEEvents(complete)) {
          yield event
        }
      }
    }
    // Flush any final buffered content (terminated or not).
    if (buffer.trim()) {
      for (const event of parseSSEEvents(buffer + '\n\n')) {
        yield event
      }
    }
  } finally {
    reader.releaseLock()
  }
}

/** Result of consuming a full interceptor stream (ADR-0007). */
export interface StreamedIntervention {
  /** The assembled response text (all tokens joined). */
  text: string
  /** The meta tag, e.g. "[The Spark Gap]". */
  tag: string | null
  /** The engine name from the meta event. */
  engine: string | null
  /** The friction mode from the meta event. */
  frictionMode: string | null
  /** Intervention id from the done event (null if the BFF persists). */
  interventionId: string | null
  /** An error event code if one was emitted (e.g. guard_violation). */
  errorCode: string | null
}

/**
 * Consume an interceptor stream to completion, surfacing the assembled text +
 * meta + any error. `onToken` is called per token so the editor can render
 * live. On a network drop, this rejects; the caller should persist the partial
 * text if any token was received (test case I-10).
 *
 * FastAPI has no DB client, so persistence is the BFF's job on `done`
 * (ADR-0007): the caller POSTs `text` to the existing blocking route.
 */
export async function consumeInterceptorStream(
  payload: Record<string, unknown>,
  onToken?: (partial: string) => void,
): Promise<StreamedIntervention> {
  const result: StreamedIntervention = {
    text: '',
    tag: null,
    engine: null,
    frictionMode: null,
    interventionId: null,
    errorCode: null,
  }
  let partial = ''
  for await (const event of streamIntervention('interceptor', payload)) {
    if (event.type === 'meta') {
      const d = event.data as { tag?: string; engine?: string; friction_mode?: string }
      result.tag = d.tag ?? null
      result.engine = d.engine ?? null
      result.frictionMode = d.friction_mode ?? null
    } else if (event.type === 'token') {
      const t = (event.data as { t?: string })?.t ?? ''
      partial += t
      result.text = partial
      onToken?.(partial)
    } else if (event.type === 'error') {
      const d = event.data as { code?: string }
      result.errorCode = d.code ?? null
    } else if (event.type === 'done') {
      const d = event.data as { intervention_id?: string }
      result.interventionId = d.intervention_id ?? null
    }
  }
  return result
}
