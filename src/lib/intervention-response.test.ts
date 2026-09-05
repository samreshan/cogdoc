import { describe, expect, it } from 'vitest'
import {
  evaluateInterventionAnswerLocally,
  parseInterventionAnswerEvaluation,
  structuredResolutionLines,
} from './intervention-response'

describe('intervention response evaluation', () => {
  it('parses bounded JSON and removes follow-ups from satisfied answers', () => {
    expect(parseInterventionAnswerEvaluation('prefix {"satisfied":true,"rationale":"Specific enough.","follow_up_question":"Ignore me"} suffix')).toEqual({
      satisfied: true,
      rationale: 'Specific enough.',
      followUpQuestion: null,
    })
    expect(parseInterventionAnswerEvaluation('not json')).toBeNull()
  })

  it('keeps weak answers open with a focused follow-up', () => {
    const result = evaluateInterventionAnswerLocally({ answer: 'I think it matters.', engineType: 'socratic' })
    expect(result.satisfied).toBe(false)
    expect(result.followUpQuestion).toMatch(/clear reason/i)
  })

  it('accepts specific evidence-aware reasoning in the offline fallback', () => {
    const answer = 'The indexed study is relevant because its evidence identifies fabricated references, while the limitation is that it evaluates educational use rather than this interface directly.'
    expect(evaluateInterventionAnswerLocally({ answer, engineType: 'citation' }).satisfied).toBe(true)
  })

  it('preserves researcher language and source passages as structured lines', () => {
    const lines = structuredResolutionLines({
      claim: 'A claim', answer: 'My own reasoning', rationale: 'It is specific.',
      evidence: [{ filename: 'source.pdf', pageApprox: 4, excerpt: 'Exact passage' }],
    })
    expect(lines).toEqual([
      { label: 'Claim under review', value: 'A claim' },
      { label: 'Researcher reasoning', value: 'My own reasoning' },
      { label: 'Evaluation', value: 'It is specific.' },
      { label: 'Supporting passages', value: 'source.pdf, p.4: Exact passage' },
    ])
  })
})
