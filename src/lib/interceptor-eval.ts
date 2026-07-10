/**
 * Interceptor blocking evaluation harness (PRODUCT.md §14.5).
 *
 * Runs the heuristic delegation classifier over the labeled prompt set and
 * reports blocking precision (of blocked prompts, how many were truly
 * delegative — a false block destroys user trust) and delegative recall.
 *
 * The heuristic classifier (isHeuristicDelegative) is the fast-path the
 * Interceptor uses before falling back to the LLM. A real LLM classifier would
 * score higher; this measures the heuristic baseline.
 *
 * Runnable: see the test, which asserts the metrics functions and runs the
 * evaluation, printing the report.
 */
import { isHeuristicDelegative } from '@/lib/ai-service'
import { INTERCEPTOR_PROMPTS, type PromptLabel } from '@/lib/interceptor-eval-data'

export interface InterceptorEvalResult {
  /** Of prompts the heuristic blocked, fraction truly delegative. */
  blockingPrecision: number
  /** Of truly delegative prompts, fraction the heuristic blocked. */
  delegativeRecall: number
  /** Total prompts evaluated. */
  total: number
  /** False-block count (non-delegative prompts blocked). */
  falseBlocks: number
  /** Per-prompt detail. */
  perPrompt: Array<{ prompt: string; label: PromptLabel; blocked: boolean }>
}

/**
 * Run the heuristic classifier over the labeled set and compute metrics.
 * A prompt is "blocked" if isHeuristicDelegative returns true.
 */
export function evaluateInterceptor(): InterceptorEvalResult {
  let truePositives = 0 // delegative + blocked
  let falsePositives = 0 // non-delegative + blocked (false block)
  let falseNegatives = 0 // delegative + not blocked
  let falseBlocks = 0
  const perPrompt: InterceptorEvalResult['perPrompt'] = []

  for (const { prompt, label } of INTERCEPTOR_PROMPTS) {
    const blocked = isHeuristicDelegative(prompt)
    perPrompt.push({ prompt, label, blocked })
    const isDelegative = label === 'delegative'
    if (blocked && isDelegative) truePositives++
    if (blocked && !isDelegative) {
      falsePositives++
      falseBlocks++
    }
    if (!blocked && isDelegative) falseNegatives++
  }

  const blockingPrecision = truePositives + falsePositives === 0 ? 0 : truePositives / (truePositives + falsePositives)
  const delegativeRecall = truePositives + falseNegatives === 0 ? 0 : truePositives / (truePositives + falseNegatives)

  return {
    blockingPrecision,
    delegativeRecall,
    total: INTERCEPTOR_PROMPTS.length,
    falseBlocks,
    perPrompt,
  }
}
