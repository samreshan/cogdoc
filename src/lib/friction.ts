/**
 * Friction calibration — the research contribution (PRODUCT.md §9).
 *
 * Three modes scale the cadence and accepting-help behaviour of Cogdoc so the
 * tool stays usable under deadline pressure (answering the survey paradox:
 * 78% frustration under deadlines). Crucially, calibration relaxes *cadence
 * and accepting help* — NEVER the non-generation contract. The invariant
 * (isGenerationAllowed) holds across all three modes: Cogdoc never writes
 * paragraph-length prose, period.
 *
 *   socratic  — full friction. Strict cooldowns, Autocomplete typing-only.
 *   coach     — moderate. Cooldowns relaxed ~50%, Autocomplete still typed.
 *   assistant — light. Cooldowns relaxed ~75%, Autocomplete Tab-accept on.
 *
 * The anti-generation guard threshold relaxes (allows longer assistant
 * responses) but the multi-paragraph block is unconditional.
 */
import { ENGINE_COOLDOWNS, type EngineType } from '@/lib/content-analyzer'

export type FrictionMode = 'socratic' | 'coach' | 'assistant'

export const FRICTION_MODES: FrictionMode[] = ['socratic', 'coach', 'assistant']

/** Cooldown multiplier per mode (1.0 = base, < 1.0 = faster). */
export const COOLDOWN_SCALE: Record<FrictionMode, number> = {
  socratic: 1.0,
  coach: 0.5,
  assistant: 0.25,
}

/**
 * Resolve the cooldown (ms) for an engine under a friction mode.
 * Rounded to an integer so timer math is clean.
 */
export function getCooldown(engine: EngineType, mode: FrictionMode): number {
  return Math.max(1, Math.round(ENGINE_COOLDOWNS[engine] * COOLDOWN_SCALE[mode]))
}

/**
 * The max number of declarative sentences an engine response may contain
 * before the anti-generation guard rejects it. Socratic is strictest.
 */
export function getGuardThreshold(mode: FrictionMode): number {
  // socratic allows ≤ 2 sentences; coach ≤ 3; assistant ≤ 4.
  // All three still reject contiguous paragraph-length prose (see below).
  const thresholds: Record<FrictionMode, number> = {
    socratic: 2,
    coach: 3,
    assistant: 4,
  }
  return thresholds[mode]
}

/** Whether Tab-accept of an autocomplete suggestion is permitted. */
export function autocompleteAcceptAllowed(mode: FrictionMode): boolean {
  return mode === 'assistant'
}

/**
 * THE NON-GENERATION CONTRACT.
 *
 * Decides whether a candidate engine response is permitted under a friction
 * mode. Allowed: short questions, structural scaffolds (placeholders), brief
 * pointers. Blocked unconditionally: multi-paragraph declarative prose, in
 * EVERY mode — even assistant never writes the essay for the user.
 *
 * The hard floor is independent of mode: 3+ declarative sentences is always
 * "writing the essay" and is blocked. The mode threshold only relaxes the
 * soft cap for brief 1–2 sentence pointers.
 */
export function isGenerationAllowed(response: string, mode: FrictionMode): boolean {
  const trimmed = response.trim()
  if (!trimmed) return true // empty is trivially allowed

  // Structural scaffolds (placeholders) are always allowed — they're outlines,
  // not prose. Detect the double-underscore fill-in marker.
  if (/__/.test(trimmed)) return true

  // Count declarative sentences (those ending in . or !, not ?).
  const sentenceEnds = trimmed.match(/[^.!?]*[.!?]/g) ?? []
  const declarative = sentenceEnds.filter((s) => /[.!]$/.test(s.trim()))

  // HARD INVARIANT (mode-independent): 3+ declarative sentences = a paragraph =
  // ghostwriting. Blocked in EVERY mode, including assistant.
  if (declarative.length >= 3) return false

  // A short question is always allowed.
  const isSingleQuestion = sentenceEnds.length <= 1 && /\?$/.test(trimmed)
  if (isSingleQuestion) return true

  // Hard token cap: block any contiguous blob over ~60 words regardless of mode.
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length
  if (wordCount > 60) return false

  // Soft cap: declarative sentences within the mode's threshold.
  return declarative.length <= getGuardThreshold(mode)
}
