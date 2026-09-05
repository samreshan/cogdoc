/**
 * AI Service Layer — Provider Abstraction (ADR-03)
 *
 * Defines the AIService interface and a configured adapter backed by Gemini
 * generateContent or an OpenAI-compatible endpoint (including local Ollama).
 * The engines call this layer; they never touch a provider directly.
 */
import { db } from '@/lib/db'
import type { EngineType, ResearchDialogueAnswers, ResearchDialogueDraft, ResearchKickoffDraft, ResearchKickoffOutlineItem, ResearchKickoffPlan, ResearchKickoffQuestion } from '@/lib/types'
import { parseInterventionAnswerEvaluation, type InterventionAnswerEvaluation } from '@/lib/intervention-response'
import { plainResearchQuestion } from '@/lib/intervention-language'

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

export interface GroundedResearchAnswer {
  answer: string
  passageIds: string[]
  confidence: 'high' | 'medium' | 'low'
  followUpQuestion: string | null
}

export interface AIService {
  classifyPrompt(prompt: string, context: string): Promise<ClassifyResult>
  generateSocratic(tag: BehaviourTag, context: string, stub?: string, prompt?: string): Promise<SocraticResponse>
  verifyClaim(claim: string, evidence: { chunkId: string; content: string }[]): Promise<VerdictResult>
  generateScaffold(prompt: string, context: string): Promise<ScaffoldResult>
  generateSuggestion(draft: string): Promise<SuggestionResult>
  answerFromEvidence(question: string, evidence: { chunkId: string; content: string }[]): Promise<GroundedResearchAnswer | null>
  evaluateInterventionAnswer(input: {
    engineType: EngineType
    passage: string
    intervention: string
    answer: string
    evidence: Array<{ chunkId: string; content: string }>
  }): Promise<InterventionAnswerEvaluation>
  draftFromResearchDialogue(
    answers: ResearchDialogueAnswers,
    documentContext: string,
  ): Promise<ResearchDialogueDraft>
  planResearchKickoff(topic: string, conversation?: Array<{ question: string; answer: string }>): Promise<ResearchKickoffPlan>
  draftResearchKickoff(input: {
    topic: string
    outline: ResearchKickoffOutlineItem[]
    responses: Array<{ question: string; answer: string }>
  }): Promise<ResearchKickoffDraft>
  restructureFromIntervention(input: {
    passage: string
    intervention: string
    answer: string
    rationale: string
  }): Promise<string>
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

/** Parse the explicit Q&A drafting response while rejecting empty model output. */
export function parseResearchDialogueDraft(raw: string): ResearchDialogueDraft {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end <= start) throw new Error('The assistant returned an invalid research draft')
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as Partial<ResearchDialogueDraft>
    const draft = typeof parsed.draft === 'string' ? parsed.draft.trim() : ''
    if (!draft) throw new Error('empty draft')
    return {
      draft,
      reflection: typeof parsed.reflection === 'string' && parsed.reflection.trim()
        ? parsed.reflection.trim()
        : 'Review the draft against your evidence and revise anything that does not match your view.',
      sourceNeeds: Array.isArray(parsed.sourceNeeds)
        ? parsed.sourceNeeds.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).map((item) => item.trim()).slice(0, 6)
        : [],
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'empty draft') {
      throw new Error('The assistant returned an empty research draft')
    }
    throw new Error('The assistant returned an invalid research draft')
  }
}

function jsonObject(raw: string): Record<string, unknown> {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('The assistant returned invalid JSON')
  return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>
}

export function parseResearchKickoffPlan(raw: string): ResearchKickoffPlan {
  try {
    const parsed = jsonObject(raw)
    const outline = Array.isArray(parsed.outline) ? parsed.outline.flatMap((item) => {
      if (!item || typeof item !== 'object') return []
      const row = item as Record<string, unknown>
      const heading = typeof row.heading === 'string' ? row.heading.trim() : ''
      const purpose = typeof row.purpose === 'string' ? row.purpose.trim() : ''
      return heading && purpose ? [{ heading: heading.slice(0, 120), purpose: purpose.slice(0, 300) }] : []
    }).slice(0, 7) : []
    const questions = Array.isArray(parsed.questions) ? parsed.questions.flatMap((item, index) => {
      if (!item || typeof item !== 'object') return []
      const row = item as Record<string, unknown>
      const rawQuestion = typeof row.question === 'string' ? row.question.trim() : ''
      const why = typeof row.why === 'string' ? row.why.trim() : ''
      const question = rawQuestion ? plainResearchQuestion(rawQuestion, 'socratic', `${index}:${rawQuestion}`) : ''
      return question ? [{ id: `q${index + 1}`, question, why: (why || 'This helps shape the outline.').slice(0, 160) }] : []
    }).slice(0, 4) : []
    const title = typeof parsed.title === 'string' ? parsed.title.trim().slice(0, 160) : ''
    const description = typeof parsed.description === 'string' ? parsed.description.trim().slice(0, 500) : ''
    if (!title || outline.length < 3 || questions.length < 3) throw new Error('incomplete plan')
    return { title, description, outline, questions }
  } catch {
    throw new Error('The assistant returned an invalid research plan')
  }
}

export function parseResearchKickoffDraft(raw: string): ResearchKickoffDraft {
  try {
    const parsed = jsonObject(raw)
    const sections = Array.isArray(parsed.sections) ? parsed.sections.flatMap((item) => {
      if (!item || typeof item !== 'object') return []
      const row = item as Record<string, unknown>
      const heading = typeof row.heading === 'string' ? row.heading.trim() : ''
      const content = typeof row.content === 'string' ? row.content.trim() : ''
      return heading && content ? [{ heading: heading.slice(0, 160), content: content.slice(0, 5_000) }] : []
    }).slice(0, 8) : []
    if (sections.length < 2) throw new Error('incomplete draft')
    return {
      sections,
      reflection: typeof parsed.reflection === 'string' && parsed.reflection.trim()
        ? parsed.reflection.trim().slice(0, 500)
        : 'Which sentence in this working draft least accurately represents your own view?',
      sourceNeeds: Array.isArray(parsed.sourceNeeds)
        ? parsed.sourceNeeds.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).map((item) => item.trim()).slice(0, 6)
        : [],
    }
  } catch {
    throw new Error('The assistant returned an invalid kickoff draft')
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
        // Do not send model-specific thinking controls here. Gemini 2.5 uses
        // thinkingBudget while Gemini 3.x uses thinkingLevel, and unsupported
        // combinations make generateContent reject the entire request. These
        // engines work with the provider default across both model families.
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
    const raw = await callLLM(`${filled}\n\nUse everyday language. Ask one direct question of no more than 16 words. Do not use labels, academic jargon, or multiple clauses.`)
    const engineType: EngineType = tag === 'The Spark Gap' ? 'interceptor' : 'socratic'
    const question = plainResearchQuestion(raw, engineType, stub || prompt || context)
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

  async answerFromEvidence(
    question: string,
    evidence: { chunkId: string; content: string }[],
  ): Promise<GroundedResearchAnswer | null> {
    if (evidence.length === 0) return null
    const passages = evidence.map((item) => `[${item.chunkId}] ${item.content}`).join('\n\n')
    const raw = await callLLM(
      'You are Cogdoc Source Mapper. Answer a researcher\'s question only from the indexed passages below. ' +
      'Do not draft submission prose, invent facts, or cite a passage that does not support the answer. ' +
      'Return only JSON with keys: answer (a concise research note), passage_ids (supporting chunk IDs), ' +
      'confidence (high, medium, or low), and follow_up_question (a useful question or null).\n\n' +
      `QUESTION:\n${question}\n\nINDEXED PASSAGES:\n${passages}`,
    )
    const { parseGroundedAnswer } = await import('@/lib/source-mapper')
    return parseGroundedAnswer(raw, evidence.map((item) => item.chunkId))
  }

  async evaluateInterventionAnswer(input: {
    engineType: EngineType
    passage: string
    intervention: string
    answer: string
    evidence: Array<{ chunkId: string; content: string }>
  }): Promise<InterventionAnswerEvaluation> {
    const evidence = input.evidence.length
      ? input.evidence.map((item) => `[${item.chunkId}] ${item.content}`).join('\n\n')
      : '(no indexed passage attached)'
    const raw = await callLLM(
      'You are having a simple research conversation. Check whether the researcher answered the question in their own words. ' +
      'Accept a short answer when it gives one clear reason, example, source, or honest uncertainty. Do not rewrite their work. ' +
      'Return only JSON with keys satisfied (boolean), rationale (one friendly sentence under 12 words), and ' +
      'follow_up_question (one everyday question under 12 words, or null). Never use labels or academic jargon.\n\n' +
      `ENGINE: ${input.engineType}\nPASSAGE: ${input.passage}\nINTERVENTION: ${input.intervention}\nRESEARCHER ANSWER: ${input.answer}\nINDEXED EVIDENCE:\n${evidence}`,
    )
    const parsed = parseInterventionAnswerEvaluation(raw)
    if (!parsed) throw new Error('The assistant returned an invalid intervention evaluation')
    if (!parsed.satisfied && !parsed.followUpQuestion) {
      return { ...parsed, followUpQuestion: plainResearchQuestion('', input.engineType, input.passage) }
    }
    return parsed.satisfied
      ? parsed
      : { ...parsed, followUpQuestion: plainResearchQuestion(parsed.followUpQuestion, input.engineType, input.passage) }
  }

  async draftFromResearchDialogue(
    answers: ResearchDialogueAnswers,
    documentContext: string,
  ): Promise<ResearchDialogueDraft> {
    const raw = await callLLM(
      'You are Cogdoc, a learning and research assistant designed to prevent cognitive atrophy. ' +
      'The researcher has earned drafting help by explaining their own reasoning through a structured dialogue. ' +
      'Create a concise WORKING DRAFT from their ideas, not a finished authoritative answer. Preserve uncertainty, ' +
      'represent the counter-position fairly, and never invent evidence or citations. Mark unsupported factual claims ' +
      'with [source needed]. Return only JSON with keys: draft (2-4 coherent paragraphs), reflection (one question that ' +
      'makes the researcher check whether the wording still represents their thinking), and sourceNeeds (an array of ' +
      'specific evidence gaps).\n\n' +
      `RESEARCH FOCUS:\n${answers.focus}\n\n` +
      `RESEARCHER'S EVIDENCE OR REASONS:\n${answers.evidence}\n\n` +
      `COUNTER-POSITION OR LIMITATION:\n${answers.tension}\n\n` +
      `INTENDED CONTRIBUTION:\n${answers.contribution}\n\n` +
      `NEARBY DOCUMENT CONTEXT (may be empty; do not treat it as verified evidence):\n${documentContext.slice(-4_000)}`,
    )
    return parseResearchDialogueDraft(raw)
  }

  async planResearchKickoff(topic: string, conversation: Array<{ question: string; answer: string }> = []): Promise<ResearchKickoffPlan> {
    const conversationText = conversation.length
      ? conversation.map((item) => `Cogdoc: ${item.question}\nResearcher: ${item.answer}`).join('\n\n')
      : '(No conversation was supplied.)'
    const raw = await callLLM(
      'You are Cogdoc, a friendly research partner. Build a clear document structure from the researcher\'s own conversation. ' +
      'Use plain language, short section titles, and one-sentence purposes. Do not sound like an examiner and do not add claims ' +
      'the researcher did not make. Return only JSON with title, description, outline (3-6 objects with heading and purpose), ' +
      'and questions (exactly 3 short, everyday follow-up questions with question and why). Each question must contain at most ' +
      '12 words.\n\n' +
      `TOPIC:\n${topic.slice(0, 2_000)}\n\nCONVERSATION:\n${conversationText.slice(0, 8_000)}`,
    )
    return parseResearchKickoffPlan(raw)
  }

  async draftResearchKickoff(input: {
    topic: string
    outline: ResearchKickoffOutlineItem[]
    responses: Array<{ question: string; answer: string }>
  }): Promise<ResearchKickoffDraft> {
    const raw = await callLLM(
      'You are Cogdoc, a research partner designed to resist cognitive atrophy. The researcher has reviewed an outline ' +
      'and answered preliminary questions. Write an editable WORKING DRAFT that follows the outline and faithfully reflects ' +
      'their demonstrated understanding. Include uncertainty and competing views. Never invent evidence, sources, quotations, ' +
      'or citations; mark claims needing support with [source needed]. Return only JSON with sections (objects with heading and ' +
      'content, one concise paragraph per outline section), reflection (one question that tests whether the draft still matches ' +
      'the researcher\'s view), and sourceNeeds (specific evidence gaps).\n\n' +
      `TOPIC:\n${input.topic}\n\nOUTLINE:\n${input.outline.map((item) => `${item.heading}: ${item.purpose}`).join('\n')}\n\n` +
      `RESEARCHER RESPONSES:\n${input.responses.map((item) => `Q: ${item.question}\nA: ${item.answer}`).join('\n\n')}`,
    )
    return parseResearchKickoffDraft(raw)
  }

  async restructureFromIntervention(input: {
    passage: string
    intervention: string
    answer: string
    rationale: string
  }): Promise<string> {
    const raw = await callLLM(
      'Restructure one research passage using the researcher\'s own satisfactory answer. Preserve their meaning and voice, ' +
      'make the reasoning explicit, retain honest uncertainty, and do not add facts or citations. Return only the revised ' +
      'passage at roughly the same scope—no preface, labels, or commentary.\n\n' +
      `ORIGINAL PASSAGE:\n${input.passage}\n\nINTERVENTION:\n${input.intervention}\n\n` +
      `RESEARCHER ANSWER:\n${input.answer}\n\nEVALUATION:\n${input.rationale}`,
    )
    return raw.replace(/^REVISED(?: PASSAGE)?:\s*/i, '').replace(/^"|"$/g, '').trim().slice(0, 5_000)
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────

let _instance: AIService | null = null

export function getAIService(): AIService {
  if (!_instance) _instance = new GeminiAdapter()
  return _instance
}
