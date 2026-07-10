/**
 * Blindspot Monitor logic (PRODUCT.md §7.2).
 *
 * Finds high-relevance library passages the user has NOT engaged with (not in
 * any Citation evidence set) and surfaces the most divergent one — attacking
 * one-sided evidence use. Pure scoring logic; the intervention UI wraps this.
 *
 * Uses keyword overlap as a relevance proxy (consistent with the keyword
 * retrieval baseline). A real embedding model would plug in here the same way
 * it does in retrieval.ts.
 */
import { _scoreChunks } from '@/lib/retrieval'

export interface LibraryPassage {
  chunk_id: string
  text: string
}

export interface BlindspotResult {
  chunk_id: string
  text: string
  relevance: number
}

// Tokeniser reused from retrieval (stop-word filtered, lowercased).
function tokenize(text: string): Set<string> {
  // Mirror retrieval.ts's internal tokeniser.
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2),
  )
}

/**
 * Find the most relevant library passage the user has not cited.
 *
 * @returns the top unseen passage above the relevance floor, or null if every
 *          relevant passage is already cited or none is relevant enough.
 */
export function findBlindspot(args: {
  draft: string
  library: LibraryPassage[]
  citedChunkIds: Set<string>
  minRelevance?: number
}): BlindspotResult | null {
  // The default floor is lower than Citation Sentinel's (0.05) because
  // blindspot detection intentionally casts a wider net: the whole point is to
  // surface *overlooked* material, which by definition has a weaker surface
  // match. A semantic embedder (Sprint 1 pgvector path) would raise this floor
  // safely by capturing paraphrase/counterargument relationships.
  const { draft, library, citedChunkIds, minRelevance = 0.08 } = args
  if (library.length === 0) return null

  const draftTokens = tokenize(draft)
  if (draftTokens.size === 0) return null

  const scored = library
    .filter((p) => !citedChunkIds.has(p.chunk_id))
    .map((p) => {
      const passageTokens = Array.from(tokenize(p.text))
      return {
        chunk_id: p.chunk_id,
        text: p.text,
        relevance: _scoreChunks(draftTokens, passageTokens),
      }
    })
    .filter((p) => p.relevance >= minRelevance)
    .sort((a, b) => b.relevance - a.relevance)

  if (scored.length === 0) return null
  return scored[0]
}
