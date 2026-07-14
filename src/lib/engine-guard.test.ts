/**
 * Tests for the engine generation guard helper.
 *
 * applyGenerationGuard wraps isGenerationAllowed with the route-side policy:
 * on a guard reject, replace the response with a short Spark Gap fallback and
 * log the incident (PRODUCT.md §9 non-generation contract, enforced server-side
 * so a buggy/over-eager LLM can never persist paragraph-length prose).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { applyGenerationGuard, SPARK_GAP_FALLBACK } from '@/lib/engine-guard'

describe('applyGenerationGuard', () => {
  let warn: ReturnType<typeof vi.spyOn>
  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => warn.mockRestore())

  it('passes a short question through unchanged in every mode', () => {
    for (const mode of ['socratic', 'coach', 'assistant'] as const) {
      const out = applyGenerationGuard('What evidence supports this?', mode)
      expect(out.text).toBe('What evidence supports this?')
      expect(out.guardRejected).toBe(false)
    }
  })

  it('passes a structural scaffold (placeholders) through in every mode', () => {
    const scaffold = 'Claim: __ Evidence: __ Limitation: __'
    for (const mode of ['socratic', 'coach', 'assistant'] as const) {
      expect(applyGenerationGuard(scaffold, mode).guardRejected).toBe(false)
    }
  })

  it('rejects multi-paragraph prose and replaces it with the Spark Gap in EVERY mode', () => {
    const blob =
      'Cognitive load theory holds that memory is limited. ' +
      'Extraneous information exceeds capacity, so learning suffers. ' +
      'Designers must minimise unnecessary detail. ' +
      'This underpins worked examples.'
    for (const mode of ['socratic', 'coach', 'assistant'] as const) {
      const out = applyGenerationGuard(blob, mode)
      expect(out.guardRejected).toBe(true)
      expect(out.text).toBe(SPARK_GAP_FALLBACK)
      expect(out.text).not.toBe(blob)
    }
  })

  it('logs the incident on reject', () => {
    applyGenerationGuard('One. Two. Three. Four.', 'socratic')
    expect(warn).toHaveBeenCalled()
  })

  it('does not log when the response is allowed', () => {
    applyGenerationGuard('Why is that true?', 'socratic')
    expect(warn).not.toHaveBeenCalled()
  })

  it('the fallback is itself a guard-allowed short question', () => {
    // The replacement must satisfy the guard too (idempotent), so a second pass
    // never re-rejects and we don't loop.
    const out = applyGenerationGuard(SPARK_GAP_FALLBACK, 'socratic')
    expect(out.guardRejected).toBe(false)
  })
})
