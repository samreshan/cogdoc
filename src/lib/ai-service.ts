/**
 * AI Service Layer — Provider Abstraction (ADR-03)
 *
 * Defines the AIService interface and a single concrete adapter (ZAIAdapter)
 * backed by z-ai-web-dev-sdk. The engines (Interceptor, Socratic Spacer,
 * Citation Sentinel, Scaffold) call this layer; they never touch the SDK
 * directly. Swapping to OpenAI or a local LLM is a single new adapter class.
 */
import ZAI from 'z-ai-web-dev-sdk'
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

export interface AIService {
  classifyPrompt(prompt: string, context: string): Promise<ClassifyResult>
  generateSocratic(tag: BehaviourTag, context: string, stub?: string, prompt?: string): Promise<SocraticResponse>
  verifyClaim(claim: string, evidence: { chunkId: string; content: string }[]): Promise<VerdictResult>
  generateScaffold(prompt: string, context: string): Promise<ScaffoldResult>
}

// ─── Helpers ──────────────────────────────────────────────────────────────

async function getTemplate(behaviorTag: BehaviourTag): Promise<string> {
  const t = await db.promptTemplate.findUnique({ where: { behaviorTag } })
  if (!t) throw new Error(`No active prompt template for tag: ${behaviorTag}`)
  return t.template
}

function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '')
}

async function callLLM(systemPrompt: string): Promise<string> {
  const zai = await ZAI.create()
  try {
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: systemPrompt },
        { role: 'user', content: 'Respond now.' },
      ],
      thinking: { type: 'disabled' },
    })
    return completion.choices[0]?.message?.content ?? ''
  } catch (e) {
    // If rate-limited (429), wait 2s and retry once
    if ((e as Error).message.includes('429')) {
      await new Promise((r) => setTimeout(r, 2000))
      const completion = await zai.chat.completions.create({
        messages: [
          { role: 'assistant', content: systemPrompt },
          { role: 'user', content: 'Respond now.' },
        ],
        thinking: { type: 'disabled' },
      })
      return completion.choices[0]?.message?.content ?? ''
    }
    throw e
  }
}

// ─── ZAIAdapter (concrete implementation) ─────────────────────────────────

export class ZAIAdapter implements AIService {
  async classifyPrompt(prompt: string, context: string): Promise<ClassifyResult> {
    // Heuristic pre-check: regex catches the obvious delegative patterns
    // without an LLM call, saving token budget.
    const delegativeRegex = /\b(write|draft|generate|create|produce)\b.*\b(paragraph|section|essay|paper|introduction|conclusion|summary|outline|literature review)\b/i
    const isHeuristicDelegative = delegativeRegex.test(prompt)

    if (isHeuristicDelegative) {
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

    // Try to parse JSON; fall back gracefully
    try {
      // Find the first { and last } in case there's surrounding prose
      const start = raw.indexOf('{')
      const end = raw.lastIndexOf('}')
      if (start === -1 || end === -1) throw new Error('no JSON')
      const jsonStr = raw.slice(start, end + 1)
      const parsed = JSON.parse(jsonStr)
      return {
        verdict: parsed.verdict ?? 'insufficient_evidence',
        explanation: parsed.explanation ?? '',
        supported_claims: Array.isArray(parsed.supported_claims) ? parsed.supported_claims : [],
        unsupported_claims: Array.isArray(parsed.unsupported_claims) ? parsed.unsupported_claims : [],
      }
    } catch {
      // Heuristic fallback: if no evidence was retrieved, it's insufficient
      if (evidence.length === 0) {
        return {
          verdict: 'insufficient_evidence',
          explanation: 'No relevant evidence was found in your research library.',
          supported_claims: [],
          unsupported_claims: [],
        }
      }
      return {
        verdict: 'partially_supported',
        explanation: raw.slice(0, 200),
        supported_claims: [],
        unsupported_claims: [],
      }
    }
  }

  async generateScaffold(prompt: string, context: string): Promise<ScaffoldResult> {
    const template = await getTemplate('Structural Scaffold')
    const filled = fillTemplate(template, { prompt, context, stub: '', evidence: '', claim: '' })
    const raw = await callLLM(filled)
    return { scaffold: raw, raw }
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────

let _instance: AIService | null = null

export function getAIService(): AIService {
  if (!_instance) _instance = new ZAIAdapter()
  return _instance
}
