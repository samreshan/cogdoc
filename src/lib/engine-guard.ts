/**
 * Engine generation guard — server-side enforcement of the non-generation
 * contract (PRODUCT.md §9, friction.ts).
 *
 * Every engine route runs its LLM response through this before persisting. If
 * the response would constitute "writing the essay for the user" (multi-paragraph
 * declarative prose), it is replaced with a short Spark Gap question and the
 * incident is logged. The replacement is itself guard-allowed, so the policy is
 * idempotent.
 *
 * This is the mode-independent hard floor: it rejects in EVERY friction mode,
 * including assistant. The mode only scales cadence + accepting help, never the
 * non-generation invariant (see friction.ts).
 */
import { isGenerationAllowed, type FrictionMode } from '@/lib/friction'

/** The Spark Gap question an over-generating response is replaced with. */
export const SPARK_GAP_FALLBACK = 'What must be true for this to hold?'

export interface GuardResult {
  /** The text to persist (original if allowed, fallback if rejected). */
  text: string
  /** Whether the guard rejected the original response. */
  guardRejected: boolean
}

/**
 * Apply the generation guard to a candidate engine response.
 * On reject: returns the Spark Gap fallback, flags guardRejected, logs the incident.
 */
export function applyGenerationGuard(response: string, mode: FrictionMode): GuardResult {
  if (isGenerationAllowed(response, mode)) {
    return { text: response, guardRejected: false }
  }
  console.warn(
    `[engine-guard] non-generation contract violated (mode=${mode}); replacing with Spark Gap. ` +
      `rejected_length=${response.length}`,
  )
  return { text: SPARK_GAP_FALLBACK, guardRejected: true }
}
