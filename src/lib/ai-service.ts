/**
 * AI Service Layer — Provider Abstraction (ADR-03)
 *
 * Defines the AIService interface and a configured adapter backed by Gemini
 * generateContent or an OpenAI-compatible endpoint (including local Ollama).
 * The engines call this layer; they never touch a provider directly.
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

export type AIProvider = 'gemini' | 'ollama' | 'groq' | 'custom'

export function configuredAIProvider(): AIProvider {
  const value = process.env.AI_PROVIDER?.trim().toLowerCase()
  if (value === 'ollama' || value === 'groq' || value === 'custom') return value
  return 'gemini'
}

/**
 * The generation model. Provider-specific configuration wins, followed by the
 * existing generic AI_MODEL variable. The retired 2.0 default is upgraded to
 * the current Flash-Lite baseline so older local env files keep working.
 */
export function geminiModel(): string {
  const configured = process.env.GEMINI_MODEL ?? process.env.AI_MODEL
  if (!configured || configured === 'gemini-2.0-flash') return 'gemini-3.5-flash-lite'
  return configured
}

async function geminiGenerate(prompt: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY || process.env.AI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY or AI_API_KEY is not set')
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

function compatibleBaseUrl(provider: Exclude<AIProvider, 'gemini'>): string {
  const configured = process.env.AI_BASE_URL?.trim().replace(/\/$/, '')
  if (configured) return configured
  if (provider === 'ollama') return 'http://127.0.0.1:11434/v1'
  if (provider === 'groq') return 'https://api.groq.com/openai/v1'
  throw new Error('AI_BASE_URL is required when AI_PROVIDER=custom')
}

export function compatibleModel(provider: Exclude<AIProvider, 'gemini'>): string {
  const configured = process.env.AI_MODEL?.trim()
  if (provider === 'ollama' && (!configured || configured.startsWith('gemini-'))) return 'qwen3:8b'
  if (!configured) throw new Error(`AI_MODEL is required when AI_PROVIDER=${provider}`)
  return configured
}

async function compatibleGenerate(prompt: string, provider: Exclude<AIProvider, 'gemini'>): Promise<string> {
  const key = process.env.AI_API_KEY?.trim()
  if (provider !== 'ollama' && !key) throw new Error(`AI_API_KEY is required when AI_PROVIDER=${provider}`)
  const res = await fetch(`${compatibleBaseUrl(provider)}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
    },
    body: JSON.stringify({
      model: compatibleModel(provider),
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      max_tokens: 1024,
    }),
    signal: AbortSignal.timeout(45_000),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`${provider} chat completion failed: ${res.status} ${detail.slice(0, 200)}`)
  }
  const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
  return data.choices?.[0]?.message?.content ?? ''
}

async function generateConfigured(prompt: string): Promise<string> {
  const provider = configuredAIProvider()
  return provider === 'gemini' ? geminiGenerate(prompt) : compatibleGenerate(prompt, provider)
}

async function callLLM(systemPrompt: string): Promise<string> {
  try {
    return await generateConfigured(systemPrompt)
  } catch (e) {
    // If rate-limited (429), wait 2s and retry once
    if ((e as Error).message.includes('429')) {
      await new Promise((r) => setTimeout(r, 2000))
      return await generateConfigured(systemPrompt)
    }
    throw e
  }
}

// ─── Configured adapter ───────────────────────────────────────────────────

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
