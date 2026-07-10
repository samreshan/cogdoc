/**
 * SSE (Server-Sent Events) parser.
 *
 * Turns a raw SSE text chunk into typed events per the uniform schema in
 * PRODUCT.md §12.3. Used by the gateway streaming consumer to reconstruct
 * token-by-token engine output from a FastAPI text/event-stream.
 *
 * SSE wire format:
 *   event: <type>\n
 *   data: <json>\n
 *   \n            ← blank line dispatches the event
 *
 * Multi-line data is joined with \n. An event without the dispatching blank
 * line is incomplete and not emitted (the caller buffers partial chunks).
 */

export type SSEEventType = 'token' | 'meta' | 'done' | 'error' | 'message'

export interface SSEEvent {
  type: SSEEventType
  data: unknown
}

/**
 * Parse a complete SSE text chunk into events.
 *
 * Incomplete events (no trailing blank line) are silently dropped — the
 * streaming consumer is responsible for buffering partial chunks across
 * network reads before calling this.
 */
export function parseSSEEvents(chunk: string): SSEEvent[] {
  const events: SSEEvent[] = []
  // Split into raw event blocks on the dispatching blank line.
  const blocks = chunk.split('\n\n')
  // The last block after the final split is only complete if the chunk ended
  // with the dispatching blank line; otherwise it's a partial event the caller
  // must buffer. Drop it.
  const lastIsPartial = !chunk.endsWith('\n\n')
  const completeBlocks = lastIsPartial ? blocks.slice(0, -1) : blocks
  for (const block of completeBlocks) {
    if (block.trim() === '') continue
    let type: SSEEventType = 'message'
    const dataLines: string[] = []
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) {
        type = line.slice('event:'.length).trim() as SSEEventType
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice('data:'.length).trim())
      }
    }
    // If there are no data lines, this is a malformed/incomplete block — skip.
    if (dataLines.length === 0) continue
    const dataStr = dataLines.join('\n')
    let data: unknown = dataStr
    try {
      data = JSON.parse(dataStr)
    } catch {
      // non-JSON data stays a string
    }
    events.push({ type, data })
  }
  return events
}

/**
 * Accumulate streamed tokens into a single string from a sequence of SSEEvents.
 * Convenience for consumers that only care about the reconstructed text.
 */
export function collectTokens(events: SSEEvent[]): string {
  return events
    .filter((e) => e.type === 'token')
    .map((e) => (e.data as { t?: string })?.t ?? '')
    .join('')
}
