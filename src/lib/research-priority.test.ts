import { describe, expect, it } from 'vitest'
import { calculateResearchPriority, sortResearchActions } from './research-priority'

describe('research action priority', () => {
  it('keeps blockers visible and bounds AI influence', () => {
    const result = calculateResearchPriority({ blocksVerification: true, evidenceState: 'missing', aiRelevanceAdjustment: -100 })
    expect(result.factors.blocker).toBe(30)
    expect(result.factors.aiAdjustment).toBe(-5)
    expect(result.score).toBe(43)
  })

  it('prioritizes pins, deadlines, and uses stable ordering', () => {
    const due = calculateResearchPriority({ dueAt: '2026-09-01', now: new Date('2026-08-31T00:00:00Z') })
    expect(due.factors.deadline).toBe(15)
    expect(sortResearchActions([
      { id: 'b', priority: 10, pinned: false, createdAt: '2026-01-01' },
      { id: 'a', priority: 10, pinned: false, createdAt: '2026-01-01' },
      { id: 'p', priority: 0, pinned: true, createdAt: '2026-02-01' },
    ]).map((item) => item.id)).toEqual(['p', 'a', 'b'])
  })
})
