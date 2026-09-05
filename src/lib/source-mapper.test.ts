import { describe, expect, it } from 'vitest'
import { mergeMappedChunks, parseGroundedAnswer } from './source-mapper'
import type { RetrievedChunk } from './retrieval'

const chunk = (chunkId: string, similarityScore: number): RetrievedChunk => ({
  chunkId,
  content: `Passage ${chunkId}`,
  similarityScore,
  pageApprox: 1,
  pdfFilename: 'source.pdf',
})

describe('source mapper grounding', () => {
  it('merges exact and semantic retrieval while retaining the strongest score', () => {
    expect(mergeMappedChunks([chunk('a', 0.2), chunk('b', 0.1)], [chunk('a', 0.8), chunk('c', 0.4)])).toEqual([
      expect.objectContaining({ chunkId: 'a', similarityScore: 0.8, matchType: 'hybrid' }),
      expect.objectContaining({ chunkId: 'c', matchType: 'semantic' }),
      expect.objectContaining({ chunkId: 'b', matchType: 'exact' }),
    ])
  })

  it('rejects answers without a valid indexed passage', () => {
    expect(parseGroundedAnswer('{"answer":"Unsupported","passage_ids":["invented"],"confidence":"high"}', ['real'])).toBeNull()
  })

  it('keeps only allowed passage links in a grounded answer', () => {
    expect(parseGroundedAnswer('{"answer":"A concise finding.","passage_ids":["real","invented"],"confidence":"medium","follow_up_question":"What are the limits?"}', ['real'])).toEqual({
      answer: 'A concise finding.', passageIds: ['real'], confidence: 'medium', followUpQuestion: 'What are the limits?',
    })
  })
})
