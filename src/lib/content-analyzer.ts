/**
 * Content Analyzer — decides which AI engine to fire based on sentence content.
 *
 * On every sentence completion (`.`, `?`, `!`), the editor calls analyzeSentence()
 * to determine which engine is most relevant. This ensures ALL four engines fire
 * automatically throughout the writing session, not just Socratic Spacer.
 *
 * The classification is purely heuristic (no LLM call) to save tokens. The LLM
 * is only invoked by the chosen engine itself.
 */

export type EngineType = 'socratic' | 'citation' | 'interceptor' | 'scaffold'

export interface AnalysisResult {
  engine: EngineType
  reason: string
}

// Vague / delegative language — triggers the Interceptor
const VAGUE_PATTERNS =
  /\b(basically|etc|and so on|stuff|things|whatever|you know|simply|just|literally|in conclusion|to summarize|overall|generally|it is said|people say|experts say|some say|many believe)\b/i

// Factual claim language — triggers the Citation Sentinel
const CLAIM_PATTERNS =
  /\b(is|are|shows|demonstrates?|proves?|according to|found|reported|study|studies|research|survey|data|evidence|%|percent|increase|decrease|correlates?|causes?|leads? to|results? in|suggests?|indicates?|reveals?|confirms?|establishes?)\b/i

// Question language — triggers Socratic (the writer is already questioning)
const QUESTION_PATTERNS =
  /\b(why|how|what|when|where|who|whether|if|should|could|would|might|may)\b/i

// Absolute / unsupported claims — triggers Interceptor (challenge the absoluteness)
const ABSOLUTE_PATTERNS =
  /\b(always|never|everyone|nobody|all|none|every|no |completely|totally|absolutely|definitely|certainly|undoubtedly|clearly|obviously)\b/i

/**
 * Analyze a completed sentence and decide which engine should fire.
 *
 * Priority (first match wins):
 *  1. Vague/delegative language → Interceptor (challenge the vagueness)
 *  2. Absolute/unsubstantiated claims → Interceptor (challenge the absoluteness)
 *  3. Factual claim with evidence language → Citation Sentinel (verify the claim)
 *  4. Default → Socratic Spacer (provoke deeper thinking)
 *
 * Scaffold is NOT triggered by sentence analysis — it fires on paragraph
 * completion (double Enter) instead.
 */
export function analyzeSentence(sentence: string): AnalysisResult {
  const trimmed = sentence.trim()
  const words = trimmed.split(/\s+/).filter(Boolean)

  // Too short — probably a heading, fragment, or typo. Don't fire.
  if (words.length < 4) {
    return { engine: 'socratic', reason: 'short_fragment' }
  }

  // 1. Vague language — Interceptor challenges the writer to be specific
  if (VAGUE_PATTERNS.test(trimmed)) {
    return { engine: 'interceptor', reason: 'vague_language' }
  }

  // 2. Absolute claims without hedging — Interceptor challenges the absoluteness
  if (ABSOLUTE_PATTERNS.test(trimmed) && !QUESTION_PATTERNS.test(trimmed)) {
    return { engine: 'interceptor', reason: 'absolute_claim' }
  }

  // 3. Factual claim — Citation Sentinel verifies against the PDF library
  if (CLAIM_PATTERNS.test(trimmed) && words.length >= 6) {
    return { engine: 'citation', reason: 'factual_claim' }
  }

  // 4. Default — Socratic Spacer provokes deeper thinking
  return { engine: 'socratic', reason: 'default' }
}

/**
 * Extract the last completed sentence from a block of text.
 * A "completed" sentence ends with `.`, `?`, or `!`.
 */
export function extractLastSentence(text: string): string {
  // Match all sentences ending with . ! or ?
  const matches = text.match(/[^.!?]*[.!?]/g)
  if (!matches || matches.length === 0) return ''
  return matches[matches.length - 1].trim()
}

/**
 * Per-engine cooldowns (ms). Prevents rapid-fire when multiple sentences
 * trigger the same engine in quick succession.
 */
export const ENGINE_COOLDOWNS: Record<EngineType, number> = {
  socratic: 4_000, // 4s — most frequent, it's the lightest engine
  interceptor: 6_000, // 6s — slightly less frequent
  citation: 12_000, // 12s — most expensive (RAG + LLM), fire less often
  scaffold: 30_000, // 30s — only on paragraph completion, rare
}
