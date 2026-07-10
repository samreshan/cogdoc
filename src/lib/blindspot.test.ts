/**
 * RED→GREEN — tests for the Blindspot Monitor (PRODUCT.md §7.2).
 *
 * Compares the draft against the research library and surfaces high-relevance
 * passages the user has NOT engaged with (not in any Citation evidence set)
 * — attacking one-sided evidence use and the illusion of mastery.
 *
 * Pure logic: given the library passages + the set of already-cited chunk ids,
 * return the most divergent high-relevance unseen passage (≤ 1 per session).
 */
import { describe, it, expect } from 'vitest'
import { findBlindspot, type LibraryPassage } from '@/lib/blindspot'

const PASSAGES: LibraryPassage[] = [
  { chunk_id: 'p1', text: 'Cognitive load theory limits working memory capacity.' },
  { chunk_id: 'p2', text: 'A counterargument: direct instruction can outperform discovery learning.' },
  { chunk_id: 'p3', text: 'Pasta dough uses durum wheat semolina and water.' },
]

describe('findBlindspot', () => {
  it('returns the most relevant passage not in the cited set', () => {
    // Draft about cognitive load; p1 cited; p2 is a related-but-uncited passage
    // that shares domain tokens (cognitive, learning). NOTE: keyword overlap
    // cannot surface a true counterargument that shares NO surface tokens —
    // that's the semantic-retrieval limitation the Sprint 1 pgvector path
    // addresses. This fixture shares tokens so the blindspot LOGIC is tested.
    const passages: LibraryPassage[] = [
      { chunk_id: 'p1', text: 'Cognitive load theory limits working memory capacity.' },
      { chunk_id: 'p2', text: 'Cognitive learning research also shows spacing effects improve retention.' },
      { chunk_id: 'p3', text: 'Pasta dough uses durum wheat semolina and water.' },
    ]
    const result = findBlindspot({
      draft: 'Cognitive load theory holds that working memory is limited in capacity for learning.',
      library: passages,
      citedChunkIds: new Set(['p1']),
    })
    expect(result).not.toBeNull()
    expect(result!.chunk_id).toBe('p2')
  })

  it('returns null when every relevant passage is already cited', () => {
    const result = findBlindspot({
      draft: 'Cognitive load theory limits working memory capacity.',
      library: PASSAGES,
      citedChunkIds: new Set(['p1', 'p2']),
    })
    // p1 + p2 cited; p3 is irrelevant (pasta) → no blindspot
    expect(result).toBeNull()
  })

  it('returns null when the library is empty', () => {
    expect(
      findBlindspot({ draft: 'anything', library: [], citedChunkIds: new Set() }),
    ).toBeNull()
  })

  it('ignores low-relevance passages even if uncited', () => {
    // Draft about cognitive load; only p1 relevant and cited; p3 (pasta) is
    // irrelevant and uncited but should NOT be surfaced.
    const result = findBlindspot({
      draft: 'Cognitive load theory limits working memory capacity.',
      library: [PASSAGES[0], PASSAGES[2]],
      citedChunkIds: new Set(['p1']),
    })
    expect(result).toBeNull()
  })

  it('respects a minimum relevance floor', () => {
    // Even if uncited, a passage below the floor is not a blindspot.
    const result = findBlindspot({
      draft: 'quantum entanglement enables nonlocal correlations',
      library: PASSAGES,
      citedChunkIds: new Set(),
    })
    // nothing in the library is relevant to quantum physics
    expect(result).toBeNull()
  })
})
