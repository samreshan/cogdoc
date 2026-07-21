/**
 * AI Service Layer — Provider Abstraction (ADR-03)
 *
 * Defines the AIService interface and a single concrete adapter (GeminiAdapter)
 * backed by the Gemini generateContent REST API (same GEMINI_API_KEY as the
 * embedding path). The engines (Interceptor, Socratic Spacer, Citation
 * Sentinel, Scaffold) call this layer; they never touch the API directly.
 * Swapping to OpenAI or a local LLM is a single new adapter class.
 */
import { db } from '@/lib/db'

export type BehaviourTag =
  | 'The Spark Gap'
  | 'Provocation'
  | 'Lens'
  | 'Structural Scaffold'

export interface ClassifyResult {
  isDelegative: boolean
  confidence: number
  raw: string
}

export interface SocraticResponse {
  question: string
  raw: string
}

export interface VerdictResult {
  verdict: 'supported' | 'partially_supported' | 'unsupported' | 'insufficient_evidence'
  explanation: string
  supported_claims: string[]
  unsupported_claims: string[]
}

export interface ScaffoldResult {
  scaffold: string
  raw: string
}

export interface SuggestionResult {
  suggestion: string
  raw: string
}

export interface AIService {
  classifyPrompt(prompt: string, context: string): Promise<ClassifyResult>
  generateSocratic(tag: BehaviourTag, context: string, stub?: string, prompt?: string): Promise<SocraticResponse>
  verifyClaim(claim: string, evidence: { chunkId: string; content: string }[]): Promise<VerdictResult>
  generateScaffold(prompt: string, context: string): Promise<ScaffoldResult>
  generateSuggestion(draft: string): Promise<SuggestionResult>
}

// ─── Helpers ──────────────────────────────────────────────────────────────

async function getTemplate(behaviorTag: BehaviourTag): Promise<string> {
  const t = await db.promptTemplate.findUnique({ where: { behaviorTag } })
  if (!t) throw new Error(`No active prompt template for tag: ${behaviorTag}`)
  return t.template
}

/**
 * Pure template filler. Replaces {varName} placeholders; missing vars → ''.
 * @internal — exported for unit testing.
 */
export function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '')
}

/**
 * The delegation heuristic regex used by classifyPrompt. Tests for the
 * "write me a paragraph/section/essay..." pattern without an LLM call.
 * @internal — exported for unit testing.
 */
export const DELEGATION_REGEX =
  /\b(write|draft|generate|create|produce)\b.*\b(paragraph|section|essay|paper|introduction|conclusion|summary|outline|literature review)\b/i

/**
 * Pure test of the delegation heuristic.
 * @internal — exported for unit testing.
 */
export function isHeuristicDelegative(prompt: string): boolean {
  return DELEGATION_REGEX.test(prompt)
}

/**
 * Parse a verdict JSON blob out of an LLM response, which may contain
 * surrounding prose. Falls back gracefully per the rules in verifyClaim.
 * @internal — exported for unit testing the fallback contract.
 */
export function parseVerdictJSON(
  raw: string,
  hasEvidence: boolean,
):
  | { ok: true; verdict: VerdictResult['verdict']; explanation: string; supported_claims: string[]; unsupported_claims: string[] }
  | { ok: false; fallback: VerdictResult } {
  try {
    const start = raw.indexOf('{')
    const end = raw.lastIndexOf('}')
    if (start === -1 || end === -1) throw new Error('no JSON')
    const parsed = JSON.parse(raw.slice(start, end + 1))
    return {
      ok: true,
      verdict: parsed.verdict ?? 'insufficient_evidence',
      explanation: parsed.explanation ?? '',
      supported_claims: Array.isArray(parsed.supported_claims) ? parsed.supported_claims : [],
      unsupported_claims: Array.isArray(parsed.unsupported_claims) ? parsed.unsupported_claims : [],
    }
  } catch {
    if (hasEvidence === false) {
      return {
        ok: false,
        fallback: {
          verdict: 'insufficient_evidence',
          explanation: 'No relevant evidence was found in your research library.',
          supported_claims: [],
          unsupported_claims: [],
        },
      }
    }
    return {
      ok: false,
      fallback: {
        verdict: 'partially_supported',
        explanation: raw.slice(0, 200),
        supported_claims: [],
        unsupported_claims: [],
      },
    }
  }
}

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models'

/**
 * The generation model. gemini-3.1-flash-lite is the tier with a workable
 * free-quota on this key (see fastapi/app/eval_harness.py) — override with
 * GEMINI_MODEL when running on a paid key.
 */
function geminiModel(): string {
  return process.env.GEMINI_MODEL ?? 'gemini-3.1-flash-lite'
}

async function geminiGenerate(prompt: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY is not set')
  const res = await fetch(`${GEMINI_ENDPOINT}/${geminiModel()}:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 1024,
        // Engine outputs are short (a question, a verdict JSON, a scaffold);
        // thinking only burns latency + quota here.
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Gemini generateContent failed: ${res.status} ${detail.slice(0, 200)}`)
  }
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
  return data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
}

async function callLLM(systemPrompt: string): Promise<string> {
  try {
    return await geminiGenerate(systemPrompt)
  } catch (e) {
    // If rate-limited (429), wait 2s and retry once
    if ((e as Error).message.includes('429')) {
      await new Promise((r) => setTimeout(r, 2000))
      return await geminiGenerate(systemPrompt)
    }
    throw e
  }
}

// ─── GeminiAdapter (concrete implementation) ──────────────────────────────

export class GeminiAdapter implements AIService {
  async classifyPrompt(prompt: string, context: string): Promise<ClassifyResult> {
    // Heuristic pre-check: regex catches the obvious delegative patterns
    // without an LLM call, saving token budget.
    if (isHeuristicDelegative(prompt)) {
      // Skip LLM call — save tokens for higher-value queries
      return { isDelegative: true, confidence: 0.95, raw: 'heuristic_match' }
    }

    // Non-obvious prompt — let the LLM classify
    const template = await getTemplate('The Spark Gap')
    const filled = fillTemplate(template, { prompt, context })
    const raw = await callLLM(filled)

    if (raw.trim().toUpperCase().startsWith('PASS')) {
      return { isDelegative: false, confidence: 0.9, raw }
    }
    return { isDelegative: true, confidence: 0.85, raw }
  }

  async generateSocratic(
    tag: BehaviourTag,
    context: string,
    stub?: string,
    prompt?: string,
  ): Promise<SocraticResponse> {
    const template = await getTemplate(tag)
    const filled = fillTemplate(template, {
      prompt: prompt ?? '',
      context,
      stub: stub ?? '',
      evidence: '',
      claim: '',
    })
    const raw = await callLLM(filled)
    // Extract the question (strip the "QUESTION:" prefix if present)
    const question = raw
      .replace(/^QUESTION:\s*/i, '')
      .replace(/^"|"$/g, '')
      .trim()
    return { question, raw }
  }

  async verifyClaim(
    claim: string,
    evidence: { chunkId: string; content: string }[],
  ): Promise<VerdictResult> {
    const template = await getTemplate('Lens')
    const evidenceStr = evidence.length === 0
      ? '(no evidence retrieved)'
      : evidence.map((e, i) => `[${i + 1}] ${e.content}`).join('\n\n')
    const filled = fillTemplate(template, {
      claim,
      evidence: evidenceStr,
      prompt: '',
      context: '',
      stub: '',
    })
    const raw = await callLLM(filled)

    const result = parseVerdictJSON(raw, evidence.length > 0)
    if (result.ok) {
      return {
        verdict: result.verdict,
        explanation: result.explanation,
        supported_claims: result.supported_claims,
        unsupported_claims: result.unsupported_claims,
      }
    }
    return result.fallback
  }

  async generateScaffold(prompt: string, context: string): Promise<ScaffoldResult> {
    const template = await getTemplate('Structural Scaffold')
    const filled = fillTemplate(template, { prompt, context, stub: '', evidence: '', claim: '' })
    const raw = await callLLM(filled)
    return { scaffold: raw, raw }
  }

  async generateSuggestion(draft: string): Promise<SuggestionResult> {
    // Devil's Autocomplete (§7.1): a short continuation phrase shown as ghost
    // text. The prompt is intentionally minimal — sanitizeSuggestion caps the
    // output at ≤12 words and a single sentence, so the model can't generate
    // prose here. No PromptTemplate row is needed for this lightweight call.
    const systemPrompt =
      'You are a Devil\'s Autocomplete. Continue the writer\'s draft with a ' +
      'SHORT phrase (at most 8 words, no full sentence). Do not write prose. ' +
      'Return ONLY the continuation words, nothing else.\n\nDraft: ' +
      draft.slice(-400)
    const raw = await callLLM(systemPrompt)
    return { suggestion: raw.trim(), raw }
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────

let _instance: AIService | null = null

export function getAIService(): AIService {
  if (!_instance) _instance = new GeminiAdapter()
  return _instance
}
