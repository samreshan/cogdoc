import { describe, expect, it } from 'vitest'
import { validateGroundedFindings } from './research-grounding'

describe('grounded synthesis boundary', () => {
  it('rejects findings without valid indexed passages', () => {
    expect(validateGroundedFindings([{ text: 'A claim', passageIds: [] }], ['p1']).ok).toBe(false)
    expect(validateGroundedFindings([{ text: 'A claim', passageIds: ['foreign'] }], ['p1']).ok).toBe(false)
    expect(validateGroundedFindings([{ text: 'A claim', passageIds: ['p1'] }], ['p1']).ok).toBe(true)
  })
})
