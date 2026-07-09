/**
 * Characterization tests for content-analyzer.ts
 *
 * These tests lock in the CURRENT behaviour of the heuristic engine trigger
 * logic so that the Tiptap/SSE migrations (Sprint 2) can refactor safely:
 * if the trigger rules drift, these tests fail before a bad build ships.
 *
 * Maps to PRODUCT.md §15.2 test cases U-01, U-02, U-10.
 */
import { describe, it, expect } from 'vitest'
import {
  analyzeSentence,
  extractLastSentence,
  ENGINE_COOLDOWNS,
  type EngineType,
} from '@/lib/content-analyzer'

describe('analyzeSentence', () => {
  describe('short fragments (< 4 words)', () => {
    it('fires only socratic with reason short_fragment', () => {
      const result = analyzeSentence('A heading')
      expect(result.engines).toEqual(['socratic'])
      expect(result.reasons.socratic).toBe('short_fragment')
    })

    it('treats empty string as a short fragment', () => {
      const result = analyzeSentence('')
      expect(result.engines).toEqual(['socratic'])
      expect(result.reasons.socratic).toBe('short_fragment')
    })
  })

  describe('questions → socratic', () => {
    it('fires socratic on a sentence ending with ?', () => {
      const result = analyzeSentence('What are the main reasons for this phenomenon?')
      expect(result.engines).toContain('socratic')
      expect(result.reasons.socratic).toBe('question_provocation')
    })

    it('fires socratic on an interrogative word without ?', () => {
      const result = analyzeSentence('Why does this happen in the observed sample')
      expect(result.engines).toContain('socratic')
      expect(result.reasons.socratic).toBe('question_provocation')
    })
  })

  describe('vague language → interceptor', () => {
    it('fires interceptor on "basically"', () => {
      const result = analyzeSentence('The model basically learns the distribution over time')
      expect(result.engines).toContain('interceptor')
      expect(result.reasons.interceptor).toBe('vague_language')
    })

    it('fires interceptor on "stuff"', () => {
      const result = analyzeSentence('There is lots of stuff happening in the data here')
      expect(result.engines).toContain('interceptor')
      expect(result.reasons.interceptor).toBe('vague_language')
    })
  })

  describe('absolute language → interceptor', () => {
    it('fires interceptor on "always" (non-question)', () => {
      const result = analyzeSentence('This approach always produces the correct output reliably')
      expect(result.engines).toContain('interceptor')
      expect(result.reasons.interceptor).toBe('absolute_claim')
    })

    it('does NOT fire interceptor absolute on a question containing "always"', () => {
      const result = analyzeSentence('Does this always produce the correct output reliably?')
      expect(result.reasons.interceptor).toBe('')
    })
  })

  describe('factual claims → citation', () => {
    it('fires citation on a factual claim with a percentage', () => {
      const result = analyzeSentence('The study shows a 30% increase in retention rates')
      expect(result.engines).toContain('citation')
      expect(result.reasons.citation).toBe('factual_claim')
    })

    it('does NOT fire citation on short claims (< 6 words)', () => {
      // "The data proves it." — has a claim verb but only 4 words, and
      // "proves" → CLAIM_PATTERNS, but words.length < 6 blocks citation.
      const result = analyzeSentence('The data proves it')
      expect(result.reasons.citation).toBe('')
    })

    it('does NOT fire citation on questions (those go to socratic)', () => {
      const result = analyzeSentence('How does the research demonstrate this effect today?')
      expect(result.reasons.citation).toBe('')
    })
  })

  describe('long sentences → scaffold', () => {
    it('fires scaffold on a sentence with ≥ 25 words', () => {
      const long = 'However when the participants were asked to complete the task under conditions of high cognitive load the observed effect diminished considerably suggesting that the underlying mechanism is sensitive to attentional resources and competing demands'
      const result = analyzeSentence(long)
      expect(result.engines).toContain('scaffold')
      expect(result.reasons.scaffold).toBe('long_sentence')
    })
  })

  describe('transition words → scaffold', () => {
    it('fires scaffold on "however" (non-question)', () => {
      const result = analyzeSentence('However the observed effect diminished under load')
      expect(result.engines).toContain('scaffold')
      expect(result.reasons.scaffold).toBe('transition_word')
    })
  })

  describe('fallback', () => {
    it('fires socratic fallback when no other engine matches', () => {
      // A 5-word neutral sentence with no vague/absolute/claim/transition/question.
      const result = analyzeSentence('the cat sat on mats')
      expect(result.engines).toContain('socratic')
      expect(result.reasons.socratic).toBe('fallback')
    })
  })

  describe('multiple engines on one sentence', () => {
    it('can fire citation + scaffold on a long factual claim', () => {
      // 25+ words, contains "demonstrates" (claim verb) + "however" (transition).
      // Carefully avoids QUESTION_PATTERNS words (who/why/how/if/etc.) so the
      // claim classification path is actually exercised.
      const sentence =
        'The study demonstrates that trained participants performed better than untrained controls across all measured dimensions however the large effect size diminished under conditions of high cognitive load during the later experimental trials'
      const result = analyzeSentence(sentence)
      expect(result.engines).toContain('citation')
      expect(result.engines).toContain('scaffold')
    })
  })

  describe('reasons record always covers all engines', () => {
    it('returns a reasons key for every EngineType', () => {
      const result = analyzeSentence('Some neutral sentence with seven words total')
      for (const e of ['socratic', 'interceptor', 'citation', 'scaffold'] as EngineType[]) {
        expect(result.reasons).toHaveProperty(e)
      }
    })
  })
})

describe('extractLastSentence', () => {
  it('returns the last sentence ending in punctuation', () => {
    expect(extractLastSentence('First one. Second one.')).toBe('Second one.')
  })

  it('returns the only sentence if there is one', () => {
    expect(extractLastSentence('Just a single sentence.')).toBe('Just a single sentence.')
  })

  it('returns empty string for text with no terminal punctuation', () => {
    expect(extractLastSentence('no punctuation here')).toBe('')
  })

  it('returns empty string for empty input', () => {
    expect(extractLastSentence('')).toBe('')
  })

  it('handles ? and ! terminators', () => {
    expect(extractLastSentence('A statement! A question?')).toBe('A question?')
  })
})

describe('ENGINE_COOLDOWNS', () => {
  it('defines a cooldown for every EngineType', () => {
    const engines: EngineType[] = ['socratic', 'interceptor', 'citation', 'scaffold']
    for (const e of engines) {
      expect(ENGINE_COOLDOWNS[e]).toBeTypeOf('number')
      expect(ENGINE_COOLDOWNS[e]).toBeGreaterThan(0)
    }
  })

  it('orders citation > interceptor (citation is the expensive RAG engine)', () => {
    expect(ENGINE_COOLDOWNS.citation).toBeGreaterThan(ENGINE_COOLDOWNS.interceptor)
  })
})
