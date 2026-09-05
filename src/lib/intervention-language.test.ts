import { describe, expect, it } from 'vitest'
import { plainResearchQuestion } from '@/lib/intervention-language'

describe('plainResearchQuestion', () => {
  it('removes model labels from a short useful question', () => {
    expect(plainResearchQuestion('[Provocation] QUESTION: What would change your mind?', 'socratic')).toBe('What would change your mind?')
  })

  it('replaces vague, complex legacy interventions with an everyday question', () => {
    const legacy = '[Provocation] QUESTION: If possessing evidence is distinct from possessing knowledge, what epistemic framework should govern the theoretical implication?'
    const result = plainResearchQuestion(legacy, 'socratic', 'the highlighted phrase')
    expect(result.endsWith('?')).toBe(true)
    expect(result).not.toMatch(/epistemic|theoretical implication|\[Provocation\]/i)
    expect(result.split(/\s+/).length).toBeLessThanOrEqual(10)
  })

  it('keeps a direct conversational question', () => {
    expect(plainResearchQuestion('Can you give one clear example?', 'interceptor')).toBe('Can you give one clear example?')
  })
})
