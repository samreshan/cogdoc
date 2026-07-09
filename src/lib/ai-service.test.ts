/**
 * Characterization tests for ai-service.ts
 *
 * Two layers:
 *  1. Pure helpers (fillTemplate, isHeuristicDelegative, parseVerdictJSON) —
 *     no mocks, fast. These encode the critical contracts: the delegation
 *     heuristic and the verdict fallback logic.
 *  2. ZAIAdapter methods — mocked DB + mocked ZAI SDK, asserting the adapter
 *     wires inputs/outputs correctly and persists the right shapes.
 *
 * Maps to PRODUCT.md §15.2 U-03, U-04, U-05, U-06, U-09.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────────────
// ZAI SDK mock — the chat completion returns whatever we set per-test.
const mockCreate = vi.fn()
vi.mock('z-ai-web-dev-sdk', () => ({
  default: { create: async () => ({ chat: { completions: { create: mockCreate } } }) },
}))

vi.mock('@/lib/db', () => ({
  db: {
    promptTemplate: { findUnique: vi.fn() },
  },
}))

import {
  fillTemplate,
  isHeuristicDelegative,
  parseVerdictJSON,
  ZAIAdapter,
  getAIService,
} from '@/lib/ai-service'
import { db } from '@/lib/db'

const templateMock = db.promptTemplate.findUnique as ReturnType<typeof vi.fn>

beforeEach(() => {
  mockCreate.mockReset()
  templateMock.mockReset()
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

// ── ZAIAdapter (with mocks) ────────────────────────────────────────────────

describe('ZAIAdapter.classifyPrompt', () => {
  it('short-circuits on heuristic delegative prompt (no LLM call)', async () => {
    const ai = new ZAIAdapter()
    const result = await ai.classifyPrompt('write a paragraph about cats', '')
    expect(result.isDelegative).toBe(true)
    expect(result.confidence).toBe(0.95)
    expect(result.raw).toBe('heuristic_match')
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('returns isDelegative=false when LLM responds with PASS', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'PASS — legitimate question.' } }],
    })
    const ai = new ZAIAdapter()
    templateMock.mockResolvedValue({ template: 'classify {prompt}' })
    const result = await ai.classifyPrompt('what is photosynthesis?', '')
    expect(result.isDelegative).toBe(false)
    expect(result.confidence).toBe(0.9)
  })

  it('returns isDelegative=true when LLM does not PASS', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'This is delegative.' } }],
    })
    const ai = new ZAIAdapter()
    templateMock.mockResolvedValue({ template: 'classify {prompt}' })
    const result = await ai.classifyPrompt('help me with something', '')
    expect(result.isDelegative).toBe(true)
  })
})

describe('ZAIAdapter.generateSocratic', () => {
  it('strips QUESTION: prefix and surrounding quotes', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'QUESTION: "What evidence supports this?"' } }],
    })
    templateMock.mockResolvedValue({ template: 'ask a {context} question' })
    const ai = new ZAIAdapter()
    const result = await ai.generateSocratic('Provocation', 'some context')
    expect(result.question).toBe('What evidence supports this?')
  })

  it('throws if the template is missing from DB', async () => {
    templateMock.mockResolvedValue(null)
    const ai = new ZAIAdapter()
    await expect(ai.generateSocratic('Provocation', 'ctx')).rejects.toThrow(
      /No active prompt template/,
    )
  })
})

describe('ZAIAdapter.verifyClaim', () => {
  it('returns the parsed verdict', async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: '{"verdict":"supported","explanation":"Found in source.","supported_claims":[],"unsupported_claims":[]}',
          },
        },
      ],
    })
    templateMock.mockResolvedValue({ template: 'verify {claim} against {evidence}' })
    const ai = new ZAIAdapter()
    const result = await ai.verifyClaim('some claim', [{ chunkId: 'c1', content: 'evidence text' }])
    expect(result.verdict).toBe('supported')
    expect(result.explanation).toBe('Found in source.')
  })
})

describe('ZAIAdapter.generateScaffold', () => {
  it('returns the raw LLM output as the scaffold', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'Claim: __ Evidence: __' } }],
    })
    templateMock.mockResolvedValue({ template: 'scaffold for {prompt}' })
    const ai = new ZAIAdapter()
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
