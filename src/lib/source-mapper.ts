import type { RetrievedChunk } from '@/lib/retrieval'
import type { SourceMapAnswer } from '@/lib/types'

export interface RankedMappedChunk extends RetrievedChunk {
  matchType: 'exact' | 'semantic' | 'hybrid'
}

export function mergeMappedChunks(exact: RetrievedChunk[], semantic: RetrievedChunk[], limit = 8): RankedMappedChunk[] {
  const rows = new Map<string, RankedMappedChunk>()
  for (const chunk of exact) rows.set(chunk.chunkId, { ...chunk, matchType: 'exact' })
  for (const chunk of semantic) {
    const current = rows.get(chunk.chunkId)
    rows.set(chunk.chunkId, current
      ? { ...current, similarityScore: Math.max(current.similarityScore, chunk.similarityScore), matchType: 'hybrid' }
      : { ...chunk, matchType: 'semantic' })
  }
  return [...rows.values()]
    .sort((a, b) => b.similarityScore - a.similarityScore || a.chunkId.localeCompare(b.chunkId))
    .slice(0, limit)
}

export function parseGroundedAnswer(raw: string, allowedPassageIds: string[]): SourceMapAnswer | null {
  const allowed = new Set(allowedPassageIds)
  try {
    const start = raw.indexOf('{')
    const end = raw.lastIndexOf('}')
    if (start < 0 || end <= start) return null
    const parsed = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>
    const answer = typeof parsed.answer === 'string' ? parsed.answer.trim() : ''
    const passageIds = Array.isArray(parsed.passage_ids)
      ? [...new Set(parsed.passage_ids.filter((id): id is string => typeof id === 'string' && allowed.has(id)))]
      : []
    if (!answer || passageIds.length === 0) return null
    const confidence = parsed.confidence === 'high' || parsed.confidence === 'medium' ? parsed.confidence : 'low'
    const followUpQuestion = typeof parsed.follow_up_question === 'string' && parsed.follow_up_question.trim()
      ? parsed.follow_up_question.trim()
      : null
    return { answer, passageIds, confidence, followUpQuestion }
  } catch {
    return null
  }
}
