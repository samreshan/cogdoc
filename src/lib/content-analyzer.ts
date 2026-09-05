/**
 * Content Analyzer — decides which engines to fire for each completed sentence.
 *
 * Design principles:
 *  1. All four engines evaluate their own cue class throughout a session.
 *  2. A phrase may match several cue classes; editor orchestration selects one
 *     primary engine so the researcher receives one coherent intervention.
 *  3. Per-engine cooldowns remain a second guard against repeated requests.
 */

export type EngineType = 'socratic' | 'citation' | 'interceptor' | 'scaffold'

export interface AnalysisResult {
  engines: EngineType[]   // ALL engines that should fire for this sentence
  reasons: Record<EngineType, string>
}

// ── Vague / delegative language → Interceptor ──────────────────────────────
const VAGUE_PATTERNS =
  /\b(basically|etc|and so on|stuff|things|whatever|you know|simply|just|literally|in conclusion|to summarize|overall|generally|it is said|people say|experts say|some say|many believe|sort of|kind of|very|really|quite|pretty)\b/i

// ── Absolute / unsubstantiated claims → Interceptor ─────────────────────────
const ABSOLUTE_PATTERNS =
  /\b(always|never|everyone|nobody|all|none|every|completely|totally|absolutely|definitely|certainly|undoubtedly|clearly|obviously|undeniably|unquestionably)\b/i

// ── Factual claim language → Citation Sentinel ─────────────────────────────
const CLAIM_PATTERNS =
  /\b(is|are|shows|demonstrates?|proves?|according to|found|reported|study|studies|research|survey|data|evidence|%|percent|increase|decrease|correlates?|causes?|leads? to|results? in|suggests?|indicates?|reveals?|confirms?|establishes?|argues?|claims?|asserts?|concludes?)\b/i

// ── Question language → Socratic (the writer is already questioning) ────────
const QUESTION_PATTERNS =
  /\b(why|how|what|when|where|who|whether|if|should|could|would|might|may)\b/i

// ── Long sentence (good candidate for Scaffold — break it down) ────────────
const LONG_SENTENCE_THRESHOLD = 25 // words

// ── Sentence starters that suggest the writer needs structural help ─────────
const SCAFFOLD_PATTERNS =
  /\b(first|second|third|finally|next|then|in addition|furthermore|moreover|however|therefore|thus|hence|consequently)\b/i

/**
 * Analyze a completed sentence and decide which engines should fire.
 * Multiple engines can match — all of them fire.
 */
export function analyzeSentence(sentence: string): AnalysisResult {
  const trimmed = sentence.trim()
  const words = trimmed.split(/\s+/).filter(Boolean)
  const engines: EngineType[] = []
  const reasons: Record<EngineType, string> = {
    socratic: '', interceptor: '', citation: '', scaffold: '',
  }

  // Too short — probably a heading or fragment. Fire only Socratic.
  if (words.length < 4) {
    engines.push('socratic')
    reasons.socratic = 'short_fragment'
    return { engines, reasons }
  }

  // ── Socratic: fires ONLY on questions (the writer is already questioning,
  // so provoke them further) OR on idle (handled separately by the idle timer).
  // Do NOT fire on every sentence — that was over-firing and spamming the margin.
  const isQuestion = trimmed.endsWith('?') || QUESTION_PATTERNS.test(trimmed)
  if (isQuestion) {
    engines.push('socratic')
    reasons.socratic = 'question_provocation'
  }

  // ── Interceptor: fires on vague language OR absolute claims ───────────────
  if (VAGUE_PATTERNS.test(trimmed)) {
    engines.push('interceptor')
    reasons.interceptor = 'vague_language'
  } else if (ABSOLUTE_PATTERNS.test(trimmed) && !isQuestion) {
    engines.push('interceptor')
    reasons.interceptor = 'absolute_claim'
  }

  // ── Citation Sentinel: fires on factual claims ────────────────────────────
  // Don't fire on questions — those go to Socratic
  if (CLAIM_PATTERNS.test(trimmed) && !isQuestion && words.length >= 6) {
    engines.push('citation')
    reasons.citation = 'factual_claim'
  }

  // ── Scaffold: fires on long sentences OR transition words ─────────────────
  // Suggests the writer may benefit from a structural breakdown
  if (words.length >= LONG_SENTENCE_THRESHOLD) {
    engines.push('scaffold')
    reasons.scaffold = 'long_sentence'
  } else if (SCAFFOLD_PATTERNS.test(trimmed) && !isQuestion) {
    engines.push('scaffold')
    reasons.scaffold = 'transition_word'
  }

  // Guarantee at least one engine fires
  if (engines.length === 0) {
    engines.push('socratic')
    reasons.socratic = 'fallback'
  }

  return { engines, reasons }
}

/**
 * Extract the last completed sentence from a block of text.
 */
export function extractLastSentence(text: string): string {
  const matches = text.match(/[^.!?]*[.!?]/g)
  if (!matches || matches.length === 0) return ''
  return matches[matches.length - 1].trim()
}

/**
 * Per-engine cooldowns (ms). These prevent repeated requests when several
 * phrases are completed rapidly.
 */
export const ENGINE_COOLDOWNS: Record<EngineType, number> = {
  socratic: 2_000,   // 2s — fires on almost every sentence
  interceptor: 4_000, // 4s
  citation: 6_000,    // 6s — more expensive (RAG + LLM)
  scaffold: 8_000,    // 8s
}
