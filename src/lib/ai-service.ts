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
export type AssistantReadinessStatus =
  | 'configured'
  | 'reachable'
  | 'missing_configuration'
  | 'authentication_failed'
  | 'quota_limited'
  | 'model_unavailable'
  | 'unreachable'

export interface AssistantReadiness {
  provider: AIProvider
  model: string
  configured: boolean
  local: boolean
  status: AssistantReadinessStatus
  message: string
}

const ASSISTANT_ISSUE_TTL_MS = 10 * 60 * 1000
let recentAssistantIssue: {
  provider: AIProvider
  status: Exclude<AssistantReadinessStatus, 'configured' | 'reachable' | 'missing_configuration'>
  message: string
  expiresAt: number
} | null = null

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

/** Public, secret-free configuration summary for readiness UI. */
export function publicAIConfiguration(): AssistantReadiness {
  const provider = configuredAIProvider()
  const local = provider === 'ollama'
  let model = ''
  let configured = false
  try {
    model = provider === 'gemini' ? geminiModel() : compatibleModel(provider)
    if (provider === 'gemini') {
      configured = Boolean((process.env.GEMINI_API_KEY || process.env.AI_API_KEY)?.trim())
    } else if (provider === 'ollama') {
      compatibleBaseUrl(provider)
      configured = true
    } else {
      compatibleBaseUrl(provider)
      configured = Boolean(process.env.AI_API_KEY?.trim())
    }
  } catch {
    configured = false
  }

  return {
    provider,
    model: model || 'not configured',
    configured,
    local,
    status: configured ? 'configured' : 'missing_configuration',
    message: configured
      ? `${providerDisplayName(provider)} is configured. Check availability to verify the model connection.`
      : missingConfigurationMessage(provider),
  }
}

/**
 * Perform a bounded, non-generating provider check. This never returns keys or
 * internal endpoint URLs and does not consume a completion request.
 */
export async function checkAIReadiness(): Promise<AssistantReadiness> {
  const configured = publicAIConfiguration()
  if (!configured.configured) return configured
  if (
    recentAssistantIssue
    && recentAssistantIssue.provider === configured.provider
    && recentAssistantIssue.expiresAt > Date.now()
  ) {
    return readinessResult(configured, recentAssistantIssue.status, recentAssistantIssue.message)
  }

  try {
    const provider = configured.provider
    const res = provider === 'gemini'
      ? await fetch(`${GEMINI_ENDPOINT}/${encodeURIComponent(configured.model)}?key=${encodeURIComponent((process.env.GEMINI_API_KEY || process.env.AI_API_KEY)!)}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(3_500),
      })
      : await fetch(`${compatibleBaseUrl(provider)}/models`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          ...(process.env.AI_API_KEY?.trim()
            ? { Authorization: `Bearer ${process.env.AI_API_KEY.trim()}` }
            : {}),
        },
        signal: AbortSignal.timeout(3_500),
      })

    if (res.status === 401 || res.status === 403 || (provider === 'gemini' && res.status === 400)) {
      return readinessResult(configured, 'authentication_failed', `${providerDisplayName(provider)} rejected the configured credential.`)
    }
    if (res.status === 429) {
      return readinessResult(configured, 'quota_limited', `${providerDisplayName(provider)} is reachable, but its current quota is limited.`)
    }
    if (res.status === 404) {
      return readinessResult(configured, 'model_unavailable', `The configured model “${configured.model}” was not found.`)
    }
    if (!res.ok) {
      return readinessResult(configured, 'unreachable', `${providerDisplayName(provider)} returned status ${res.status}.`)
    }

    if (provider !== 'gemini') {
      const data = await res.json().catch(() => ({})) as { data?: Array<{ id?: string }> }
      const models = (data.data ?? []).map((entry) => entry.id).filter(Boolean)
      if (models.length > 0 && !models.includes(configured.model)) {
        return readinessResult(configured, 'model_unavailable', `The provider is reachable, but “${configured.model}” is not installed or available.`)
      }
    }

    return readinessResult(
      configured,
      'reachable',
      configured.local
        ? 'The local service and configured model are reachable.'
        : `${providerDisplayName(provider)} and the configured model are reachable. Remaining generation quota is checked when guidance is requested.`,
    )
  } catch {
    return readinessResult(
      configured,
      'unreachable',
      configured.local
        ? 'The local assistant is not reachable. Start Ollama and check the configured model.'
        : `${providerDisplayName(configured.provider)} could not be reached.`,
    )
  }
}

function readinessResult(
  configured: AssistantReadiness,
  status: AssistantReadinessStatus,
  message: string,
): AssistantReadiness {
  return { ...configured, status, message }
}

function providerDisplayName(provider: AIProvider): string {
  if (provider === 'ollama') return 'Ollama'
  if (provider === 'groq') return 'Groq'
  if (provider === 'custom') return 'Custom assistant'
  return 'Gemini'
}

function missingConfigurationMessage(provider: AIProvider): string {
  if (provider === 'gemini') return 'Add AI_API_KEY or GEMINI_API_KEY, then restart Cogdoc.'
  if (provider === 'ollama') return 'Set an Ollama model and start the local Ollama service.'
  return `Complete AI_BASE_URL, AI_MODEL, and AI_API_KEY for ${providerDisplayName(provider)}.`
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
  const provider = configuredAIProvider()
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const result = await generateConfigured(systemPrompt)
      recentAssistantIssue = null
      return result
    } catch (error) {
      const message = (error as Error).message
      if (attempt === 0 && message.includes('429')) {
        await new Promise((resolve) => setTimeout(resolve, 2000))
        continue
      }
      rememberAssistantIssue(provider, message)
      throw error
    }
  }
  throw new Error('Assistant request failed')
}

function rememberAssistantIssue(provider: AIProvider, detail: string): void {
  let status: NonNullable<typeof recentAssistantIssue>['status'] = 'unreachable'
  let message = `${providerDisplayName(provider)} could not complete the latest guidance request.`
  if (detail.includes('429')) {
    status = 'quota_limited'
    message = `${providerDisplayName(provider)} rejected the latest guidance request because its quota is currently limited.`
  } else if (/\b(401|403)\b/.test(detail)) {
    status = 'authentication_failed'
    message = `${providerDisplayName(provider)} rejected the configured credential during the latest guidance request.`
  } else if (/\b404\b/.test(detail)) {
    status = 'model_unavailable'
    message = 'The configured model was not available during the latest guidance request.'
  }
  recentAssistantIssue = {
    provider,
    status,
    message,
    expiresAt: Date.now() + ASSISTANT_ISSUE_TTL_MS,
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
