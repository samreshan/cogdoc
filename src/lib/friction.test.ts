/**
 * RED→GREEN — tests for the friction-calibration module (Sprint 3, research contribution).
 *
 * The central paradox from the survey (PRODUCT.md §2.2): 59% see long-term
 * value in friction, but 78% would find it frustrating under deadline pressure.
 * Friction calibration answers this with three modes that scale cadence and
 * accepting help — WITHOUT ever surrendering the non-generation contract.
 *
 * The load-bearing test is the INVARIANT: no mode ever permits multi-paragraph
 * generation. If this test ever fails, the project's thesis is broken.
 */
import { describe, it, expect } from 'vitest'
import {
  FRICTION_MODES,
  getCooldown,
  getGuardThreshold,
  autocompleteAcceptAllowed,
  isGenerationAllowed,
  COOLDOWN_SCALE,
  FrictionMode,
} from '@/lib/friction'
import { ENGINE_COOLDOWNS } from '@/lib/content-analyzer'

describe('FRICTION_MODES', () => {
  it('defines the three modes', () => {
    expect(FRICTION_MODES).toEqual(['socratic', 'coach', 'assistant'])
  })
})

describe('getCooldown', () => {
  it('socratic uses the base cooldowns unchanged', () => {
    for (const engine of ['socratic', 'interceptor', 'citation', 'scaffold'] as const) {
      expect(getCooldown(engine, 'socratic')).toBe(ENGINE_COOLDOWNS[engine])
    }
  })

  it('coach scales cooldowns down by the coach factor (< 1)', () => {
    const factor = COOLDOWN_SCALE.coach
    expect(factor).toBeLessThan(1)
    expect(getCooldown('socratic', 'coach')).toBe(Math.round(ENGINE_COOLDOWNS.socratic * factor))
  })

  it('assistant scales cooldowns down further than coach', () => {
    expect(getCooldown('citation', 'assistant')).toBeLessThan(getCooldown('citation', 'coach'))
    expect(getCooldown('citation', 'assistant')).toBeLessThan(getCooldown('citation', 'socratic'))
  })

  it('cooldowns are always positive integers in every mode', () => {
    const engines = ['socratic', 'interceptor', 'citation', 'scaffold'] as const
    for (const mode of FRICTION_MODES) {
      for (const engine of engines) {
        const cd = getCooldown(engine, mode)
        expect(cd).toBeGreaterThan(0)
        expect(Number.isInteger(cd)).toBe(true)
      }
    }
  })
})

describe('getGuardThreshold', () => {
  it('socratic has the strictest anti-generation threshold', () => {
    expect(getGuardThreshold('socratic')).toBeLessThanOrEqual(getGuardThreshold('coach'))
  })

  it('thresholds relax monotonically socratic → coach → assistant', () => {
    expect(getGuardThreshold('socratic')).toBeLessThanOrEqual(getGuardThreshold('coach'))
    expect(getGuardThreshold('coach')).toBeLessThanOrEqual(getGuardThreshold('assistant'))
  })
})

describe('autocompleteAcceptAllowed', () => {
  it('disallows Tab-accept in socratic (must type each char)', () => {
    expect(autocompleteAcceptAllowed('socratic')).toBe(false)
  })

  it('allows Tab-accept in assistant', () => {
    expect(autocompleteAcceptAllowed('assistant')).toBe(true)
  })
})

// ── THE INVARIANT ──────────────────────────────────────────────────────────
describe('INVARIANT: no mode ever permits multi-paragraph generation', () => {
  it('isGenerationAllowed rejects paragraph-length prose in ALL modes', () => {
    // A multi-sentence declarative blob that would constitute "writing the
    // essay for the user". This must be blocked in every friction mode.
    const generatedParagraph =
      'Cognitive load theory holds that working memory is limited. ' +
      'When extraneous information exceeds that capacity, learning suffers. ' +
      'Therefore, instructional designers should minimise unnecessary detail. ' +
      'This principle underpins the design of worked examples and guided discovery.'

    for (const mode of FRICTION_MODES) {
      expect(
        isGenerationAllowed(generatedParagraph, mode),
        `mode=${mode} must not allow multi-paragraph generation`,
      ).toBe(false)
    }
  })

  it('isGenerationAllowed allows short Socratic questions in ALL modes', () => {
    const question = 'What evidence would make this claim false?'
    for (const mode of FRICTION_MODES) {
      expect(isGenerationAllowed(question, mode)).toBe(true)
    }
  })

  it('isGenerationAllowed allows structural scaffolds (placeholders) in ALL modes', () => {
    const scaffold = 'Claim: __ Evidence: __ Limitation: __'
    for (const mode of FRICTION_MODES) {
      expect(isGenerationAllowed(scaffold, mode)).toBe(true)
    }
  })
})
