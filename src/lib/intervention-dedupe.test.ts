import { describe, expect, it } from 'vitest'
import type { EngineType, Intervention } from '@/lib/types'
import { canonicalInterventionPhrase, dedupeInterventionsByPhrase } from './intervention-dedupe'

function intervention(id: string, engineType: EngineType, promptText: string, createdAt: string): Intervention {
  return {
    id, userId: 'user-1', projectId: 'project-1', paragraphId: null,
    promptTemplateTag: null, engineType, promptText, responseText: `Question ${id}`,
    verdict: null, status: 'active', userAction: null, createdAt, resolvedAt: null,
  }
}

describe('intervention phrase deduplication', () => {
  it('normalizes whitespace, case, and typographic quotes in phrase anchors', () => {
    expect(canonicalInterventionPhrase('  Researchers’   Evidence  ')).toBe("researchers' evidence")
  })

  it('keeps one active intervention per phrase and prefers the more actionable engine', () => {
    const phrase = 'This claim needs independent evidence.'
    const result = dedupeInterventionsByPhrase([
      intervention('socratic', 'socratic', phrase, '2026-09-01T02:00:00.000Z'),
      intervention('citation', 'citation', phrase.toUpperCase(), '2026-09-01T01:00:00.000Z'),
      intervention('other', 'socratic', 'A different phrase.', '2026-09-01T03:00:00.000Z'),
    ])
    expect(result.map((item) => item.id)).toEqual(['citation', 'other'])
  })

  it('retains resolved duplicates as audit history', () => {
    const resolved = { ...intervention('resolved', 'socratic', 'Same phrase.', '2026-09-01T01:00:00.000Z'), status: 'resolved' as const }
    const active = intervention('active', 'citation', 'Same phrase.', '2026-09-01T02:00:00.000Z')
    expect(dedupeInterventionsByPhrase([resolved, active])).toEqual([resolved, active])
  })
})
