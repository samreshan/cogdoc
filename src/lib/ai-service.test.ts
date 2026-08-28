/**
 * Characterization tests for ai-service.ts
 *
 * Two layers:
 *  1. Pure helpers (fillTemplate, isHeuristicDelegative, parseVerdictJSON) —
 *     no mocks, fast. These encode the critical contracts: the delegation
 *     heuristic and the verdict fallback logic.
 *  2. GeminiAdapter methods — mocked DB + stubbed fetch (Gemini REST shape),
 *     asserting the adapter wires inputs/outputs correctly.
 *
 * Maps to PRODUCT.md §15.2 U-03, U-04, U-05, U-06, U-09.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────────────
// Gemini fetch stub — mockLLM resolves to the raw text the "model" returns.
const mockLLM = vi.fn<() => Promise<string>>()
const fetchMock = vi.fn(async (input: string | URL | Request) => {
  const text = await mockLLM()
  return {
    ok: true,
    json: async () => String(input).includes('generateContent')
      ? { candidates: [{ content: { parts: [{ text }] } }] }
      : { choices: [{ message: { content: text } }] },
  }
})
vi.stubGlobal('fetch', fetchMock)

vi.mock('@/lib/db', () => ({
  db: {
    promptTemplate: { findUnique: vi.fn() },
  },
}))

import {
  fillTemplate,
  isHeuristicDelegative,
  parseVerdictJSON,
  geminiModel,
  configuredAIProvider,
  compatibleModel,
  GeminiAdapter,
  getAIService,
} from '@/lib/ai-service'
import { db } from '@/lib/db'

const templateMock = db.promptTemplate.findUnique as ReturnType<typeof vi.fn>

beforeEach(() => {
  mockLLM.mockReset()
  fetchMock.mockClear()
  templateMock.mockReset()
  process.env.GEMINI_API_KEY = 'test-key'
  delete process.env.GEMINI_MODEL
  delete process.env.AI_MODEL
  delete process.env.AI_PROVIDER
  delete process.env.AI_BASE_URL
})

describe('geminiModel', () => {
  it('uses the current Flash-Lite baseline', () => {
    expect(geminiModel()).toBe('gemini-3.5-flash-lite')
  })

  it('upgrades the retired generic 2.0 default', () => {
    process.env.AI_MODEL = 'gemini-2.0-flash'
    expect(geminiModel()).toBe('gemini-3.5-flash-lite')
  })

  it('respects an explicit provider-specific model', () => {
    process.env.GEMINI_MODEL = 'gemini-custom'
    expect(geminiModel()).toBe('gemini-custom')
  })
})

describe('provider configuration', () => {
  it('uses Gemini by default and accepts a local Ollama provider', () => {
    expect(configuredAIProvider()).toBe('gemini')
    process.env.AI_PROVIDER = 'ollama'
    expect(configuredAIProvider()).toBe('ollama')
    expect(compatibleModel('ollama')).toBe('qwen3:8b')
  })

  it('uses an explicit local model instead of the default', () => {
    process.env.AI_MODEL = 'gemma3:12b'
    expect(compatibleModel('ollama')).toBe('gemma3:12b')
  })
})

afterAll(() => {
  vi.unstubAllGlobals()
})

// ── Pure helpers ───────────────────────────────────────────────────────────

describe('fillTemplate', () => {
  it('replaces {var} placeholders with provided values', () => {
    expect(fillTemplate('Hello {name}!', { name: 'Sam' })).toBe('Hello Sam!')
  })

  it('replaces multiple placeholders', () => {
    expect(fillTemplate('{a} and {b}', { a: '1', b: '2' })).toBe('1 and 2')
  })

  it('replaces missing vars with empty string', () => {
    expect(fillTemplate('Hello {name}!', {})).toBe('Hello !')
  })

  it('leaves non-brace text untouched', () => {
    expect(fillTemplate('no placeholders here', {})).toBe('no placeholders here')
  })
})

describe('isHeuristicDelegative', () => {
  it('flags "write a paragraph about X"', () => {
    expect(isHeuristicDelegative('write a paragraph about cognitive load')).toBe(true)
  })

  it('flags "draft an essay on Y"', () => {
    expect(isHeuristicDelegative('draft an essay on climate change')).toBe(true)
  })

  it('flags "generate the introduction section"', () => {
    expect(isHeuristicDelegative('generate the introduction section')).toBe(true)
  })

  it('does NOT flag legitimate questions', () => {
    expect(isHeuristicDelegative('what are counterarguments to dualism?')).toBe(false)
  })

  it('does NOT flag metacognitive prompts', () => {
    expect(isHeuristicDelegative('is my argument here circular?')).toBe(false)
  })

  it('flags "produce a literature review"', () => {
    expect(isHeuristicDelegative('produce a literature review')).toBe(true)
  })
})

describe('parseVerdictJSON', () => {
  it('parses clean JSON', () => {
    const raw = '{"verdict":"supported","explanation":"yes","supported_claims":["c1"],"unsupported_claims":[]}'
    const r = parseVerdictJSON(raw, true)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.verdict).toBe('supported')
      expect(r.explanation).toBe('yes')
      expect(r.supported_claims).toEqual(['c1'])
    }
  })

  it('extracts JSON embedded in surrounding prose', () => {
    const raw = 'Here is my verdict:\n{"verdict":"unsupported","explanation":"no"}\nThanks.'
    const r = parseVerdictJSON(raw, true)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.verdict).toBe('unsupported')
  })

  it('falls back to insufficient_evidence when JSON is broken AND no evidence', () => {
    const r = parseVerdictJSON('this is not json at all', false)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.fallback.verdict).toBe('insufficient_evidence')
  })

  it('falls back to partially_supported when JSON is broken BUT evidence exists', () => {
    const raw = 'unparseable model output'
    const r = parseVerdictJSON(raw, true)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.fallback.verdict).toBe('partially_supported')
      expect(r.fallback.explanation).toBe(raw)
    }
  })

  it('defaults missing verdict field to insufficient_evidence', () => {
    const r = parseVerdictJSON('{"explanation":"hmm"}', true)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.verdict).toBe('insufficient_evidence')
  })

  it('coerces non-array supported_claims to empty array', () => {
    const r = parseVerdictJSON('{"verdict":"supported","supported_claims":"not an array"}', true)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.supported_claims).toEqual([])
  })
})

// ── GeminiAdapter (with mocks) ─────────────────────────────────────────────

describe('GeminiAdapter.classifyPrompt', () => {
  it('short-circuits on heuristic delegative prompt (no LLM call)', async () => {
    const ai = new GeminiAdapter()
    const result = await ai.classifyPrompt('write a paragraph about cats', '')
    expect(result.isDelegative).toBe(true)
    expect(result.confidence).toBe(0.95)
    expect(result.raw).toBe('heuristic_match')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns isDelegative=false when LLM responds with PASS', async () => {
    mockLLM.mockResolvedValue('PASS — legitimate question.')
    const ai = new GeminiAdapter()
    templateMock.mockResolvedValue({ template: 'classify {prompt}' })
    const result = await ai.classifyPrompt('what is photosynthesis?', '')
    expect(result.isDelegative).toBe(false)
    expect(result.confidence).toBe(0.9)
  })

  it('returns isDelegative=true when LLM does not PASS', async () => {
    mockLLM.mockResolvedValue('This is delegative.')
    const ai = new GeminiAdapter()
    templateMock.mockResolvedValue({ template: 'classify {prompt}' })
    const result = await ai.classifyPrompt('help me with something', '')
    expect(result.isDelegative).toBe(true)
  })
})

describe('GeminiAdapter.generateSocratic', () => {
  it('strips QUESTION: prefix and surrounding quotes', async () => {
    mockLLM.mockResolvedValue('QUESTION: "What evidence supports this?"')
    templateMock.mockResolvedValue({ template: 'ask a {context} question' })
    const ai = new GeminiAdapter()
    const result = await ai.generateSocratic('Provocation', 'some context')
    expect(result.question).toBe('What evidence supports this?')
  })

  it('throws if the template is missing from DB', async () => {
    templateMock.mockResolvedValue(null)
    const ai = new GeminiAdapter()
    await expect(ai.generateSocratic('Provocation', 'ctx')).rejects.toThrow(
      /No active prompt template/,
    )
  })

  it('uses the local OpenAI-compatible endpoint without an API key', async () => {
    process.env.AI_PROVIDER = 'ollama'
    process.env.AI_BASE_URL = 'http://localhost:11434/v1'
    process.env.AI_MODEL = 'qwen3:8b'
    delete process.env.AI_API_KEY
    delete process.env.GEMINI_API_KEY
    mockLLM.mockResolvedValue('QUESTION: What evidence would change your conclusion?')
    templateMock.mockResolvedValue({ template: 'ask about {context}' })

    const result = await new GeminiAdapter().generateSocratic('Provocation', 'the argument')

    expect(result.question).toBe('What evidence would change your conclusion?')
    expect(fetchMock).toHaveBeenLastCalledWith('http://localhost:11434/v1/chat/completions', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }))
  })
})

describe('GeminiAdapter.verifyClaim', () => {
  it('returns the parsed verdict', async () => {
    mockLLM.mockResolvedValue(
      '{"verdict":"supported","explanation":"Found in source.","supported_claims":[],"unsupported_claims":[]}',
    )
    templateMock.mockResolvedValue({ template: 'verify {claim} against {evidence}' })
    const ai = new GeminiAdapter()
    const result = await ai.verifyClaim('some claim', [{ chunkId: 'c1', content: 'evidence text' }])
    expect(result.verdict).toBe('supported')
    expect(result.explanation).toBe('Found in source.')
  })
})

describe('GeminiAdapter.generateScaffold', () => {
  it('returns the raw LLM output as the scaffold', async () => {
    mockLLM.mockResolvedValue('Claim: __ Evidence: __')
    templateMock.mockResolvedValue({ template: 'scaffold for {prompt}' })
    const ai = new GeminiAdapter()
    const result = await ai.generateScaffold('build an argument', 'ctx')
    expect(result.scaffold).toBe('Claim: __ Evidence: __')
  })
})

describe('getAIService singleton', () => {
  it('returns the same instance on repeated calls', () => {
    const a = getAIService()
    const b = getAIService()
    expect(a).toBe(b)
  })
})
