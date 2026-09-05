import { describe, expect, it } from 'vitest'
import { contextualHelpKey, createContextualHelp } from './contextual-research-help'

describe('contextual research help', () => {
  const base = { question: 'Does library access cause better study planning?', explanation: 'I think longer hours cause better planning.', passage: { id: 'p1', content: 'Hours and planning were reported together.', sourceTitle: 'Local report' } }

  it('asks one bounded causal concern with explicit passage provenance', () => {
    const help = createContextualHelp({ ...base, kind: 'help' })
    expect(help.body).toMatch(/caused.*occurred together/i)
    expect(help.basis).toContain('p1')
    expect(help.hypothetical).toBe(false)
  })

  it('labels examples as hypothetical rather than evidence', () => {
    const help = createContextualHelp({ ...base, kind: 'example' })
    expect(help.hypothetical).toBe(true)
    expect(help.basis).toMatch(/not evidence/i)
  })

  it('does not manufacture a concern for an adequate bounded explanation', () => {
    const help = createContextualHelp({ kind: 'help', question: base.question, explanation: 'The available report describes an association, not causation, and it may not represent students with different schedules or access needs.' })
    expect(help.noUsefulGap).toBe(true)
  })

  it('uses a stable context key that changes when evidence changes', () => {
    expect(contextualHelpKey({ ...base, kind: 'help' })).not.toBe(contextualHelpKey({ ...base, kind: 'help', passage: { ...base.passage, id: 'p2' } }))
  })
})
