/**
 * Characterization tests for retrieval.ts
 *
 * Locks in the CURRENT chunking + keyword-overlap retrieval behaviour so the
 * pgvector migration (Sprint 1) has a green safety net. The keyword path must
 * keep passing these tests unchanged while the vector path is added behind a
 * flag — this is what makes the migration a refactor rather than a rewrite.
 *
 * Maps to PRODUCT.md §15.2 U-07, U-08, U-09.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the DB before importing the module under test.
vi.mock('@/lib/db', () => ({
  db: {
    pdfChunk: { findMany: vi.fn() },
  },
}))

import { chunkText, retrieveTopK, _scoreChunks } from '@/lib/retrieval'
import { db } from '@/lib/db'

const findManyMock = db.pdfChunk.findMany as ReturnType<typeof vi.fn>

beforeEach(() => {
  findManyMock.mockReset()
})

describe('_scoreChunks (pure Jaccard)', () => {
  it('returns 0 for empty chunk tokens', () => {
    expect(_scoreChunks(new Set(['machine', 'learning']), [])).toBe(0)
  })

  it('returns 1.0 for identical token sets', () => {
    const q = new Set(['machine', 'learning', 'models'])
    expect(_scoreChunks(q, ['machine', 'learning', 'models'])).toBeCloseTo(1.0)
  })

  it('returns 0 for disjoint token sets', () => {
    const q = new Set(['machine', 'learning'])
    expect(_scoreChunks(q, ['cooking', 'recipes', 'kitchen'])).toBe(0)
  })

  it('computes intersection/union correctly', () => {
    // intersection = {a, b} = 2; union = {a,b,c,d,e} = 5 → 0.4
    const q = new Set(['a', 'b', 'c'])
    expect(_scoreChunks(q, ['a', 'b', 'd', 'e'])).toBeCloseTo(0.4)
  })

  it('returns 0 when both sets are empty (union 0)', () => {
    expect(_scoreChunks(new Set(), [])).toBe(0)
  })
})

describe('chunkText', () => {
  it('returns [] for empty input', () => {
    expect(chunkText('')).toEqual([])
  })

  it('returns [] for whitespace-only input', () => {
    expect(chunkText('   \n\n  ')).toEqual([])
  })

  it('returns a single chunk for text under CHUNK_SIZE', () => {
    const text = 'This is a short paragraph that fits in one chunk.'
    const chunks = chunkText(text)
    expect(chunks).toHaveLength(1)
    expect(chunks[0].content).toBe(text)
    expect(chunks[0].chunkIndex).toBe(0)
    expect(chunks[0].charCount).toBe(text.length)
    expect(chunks[0].pageApprox).toBe(1)
  })

  it('splits on paragraph boundaries when exceeding CHUNK_SIZE', () => {
    // Two paragraphs, each > CHUNK_SIZE/2, combined > CHUNK_SIZE → 2 chunks.
    const paraA = 'A'.repeat(2000)
    const paraB = 'B'.repeat(2000)
    const chunks = chunkText(`${paraA}\n\n${paraB}`)
    expect(chunks).toHaveLength(2)
    expect(chunks[0].chunkIndex).toBe(0)
    expect(chunks[1].chunkIndex).toBe(1)
    expect(chunks[1].pageApprox).toBeGreaterThanOrEqual(1)
  })

  it('assigns increasing pageApprox across chunks', () => {
    const paras = Array.from({ length: 6 }, (_, i) => `${i}` + 'X'.repeat(2500))
    const chunks = chunkText(paras.join('\n\n'))
    expect(chunks.length).toBeGreaterThanOrEqual(2)
    // pageApprox is monotonically non-decreasing
    for (let i = 1; i < chunks.length; i++) {
      expect(chunks[i].pageApprox).toBeGreaterThanOrEqual(chunks[i - 1].pageApprox)
    }
  })
})

describe('retrieveTopK', () => {
  it('returns [] when the query has no content tokens', async () => {
    const result = await retrieveTopK('proj-1', 'the and of')
    expect(result).toEqual([])
    expect(findManyMock).not.toHaveBeenCalled()
  })

  it('returns [] when the project has no chunks', async () => {
    findManyMock.mockResolvedValue([])
    const result = await retrieveTopK('proj-1', 'machine learning models')
    expect(result).toEqual([])
  })

  it('returns ranked chunks above minScore, capped at k', async () => {
    findManyMock.mockResolvedValue([
      {
        id: 'c1',
        content: 'machine learning models are powerful',
        pageApprox: 1,
        pdf: { filename: 'a.pdf' },
      },
      {
        id: 'c2',
        content: 'cooking recipes for the kitchen',
        pageApprox: 2,
        pdf: { filename: 'b.pdf' },
      },
      {
        id: 'c3',
        content: 'deep learning neural network training',
        pageApprox: 3,
        pdf: { filename: 'c.pdf' },
      },
    ])

    const result = await retrieveTopK('proj-1', 'machine learning models', 5, 0.05)
    // c2 (cooking) shares no tokens → filtered out by minScore
    expect(result.map((r) => r.chunkId)).toEqual(['c1', 'c3'])
    // highest-scoring chunk first
    expect(result[0].similarityScore).toBeGreaterThanOrEqual(result[1].similarityScore)
    // shape contract
    expect(result[0]).toHaveProperty('content')
    expect(result[0]).toHaveProperty('pdfFilename', 'a.pdf')
    expect(result[0]).toHaveProperty('pageApprox', 1)
  })

  it('respects the k limit', async () => {
    findManyMock.mockResolvedValue(
      Array.from({ length: 8 }, (_, i) => ({
        id: `c${i}`,
        content: `machine learning ${i} topic`,
        pageApprox: i,
        pdf: { filename: 'a.pdf' },
      })),
    )
    const result = await retrieveTopK('proj-1', 'machine learning topic', 3, 0.05)
    expect(result.length).toBeLessThanOrEqual(3)
  })

  it('queries chunks scoped to the project', async () => {
    findManyMock.mockResolvedValue([])
    await retrieveTopK('proj-42', 'machine learning')
    expect(findManyMock).toHaveBeenCalledWith({
      where: { pdf: { projectId: 'proj-42' } },
      include: { pdf: { select: { filename: true } } },
    })
  })
})
