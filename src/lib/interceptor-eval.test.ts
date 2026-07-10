/**
 * Tests for the Interceptor blocking evaluation harness.
 *
 * Verifies the harness runs, produces well-formed metrics, and reports the
 * blocking precision / delegative recall against the labeled prompt set.
 * The acceptance targets (PRODUCT.md §14.5) are checked here.
 */
import { describe, it, expect } from 'vitest'
import { evaluateInterceptor } from '@/lib/interceptor-eval'

describe('evaluateInterceptor', () => {
  const result = evaluateInterceptor()

  it('evaluates every labeled prompt', () => {
    expect(result.total).toBeGreaterThan(10)
    expect(result.perPrompt.length).toBe(result.total)
  })

  it('reports blocking precision between 0 and 1', () => {
    expect(result.blockingPrecision).toBeGreaterThanOrEqual(0)
    expect(result.blockingPrecision).toBeLessThanOrEqual(1)
  })

  it('reports delegative recall between 0 and 1', () => {
    expect(result.delegativeRecall).toBeGreaterThanOrEqual(0)
    expect(result.delegativeRecall).toBeLessThanOrEqual(1)
  })

  it('counts false blocks (non-delegative prompts wrongly blocked)', () => {
    expect(typeof result.falseBlocks).toBe('number')
    expect(result.falseBlocks).toBeGreaterThanOrEqual(0)
  })

  it('meets the blocking precision target (>= 0.90)', () => {
    // The heuristic must rarely false-block — a wrongly-blocked legitimate
    // question destroys user trust. PRODUCT.md §14.5 target.
    expect(result.blockingPrecision).toBeGreaterThanOrEqual(0.9)
  })

  it('meets the delegative recall target (>= 0.90)', () => {
    // The heuristic must catch the obvious delegative patterns.
    expect(result.delegativeRecall).toBeGreaterThanOrEqual(0.9)
  })

  it('each per-prompt entry has the required fields', () => {
    for (const p of result.perPrompt) {
      expect(p).toHaveProperty('prompt')
      expect(p).toHaveProperty('label')
      expect(p).toHaveProperty('blocked')
      expect(typeof p.blocked).toBe('boolean')
    }
  })
})
