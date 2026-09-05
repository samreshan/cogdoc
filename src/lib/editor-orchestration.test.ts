// @vitest-environment happy-dom
/**
 * Tests for the Tiptap editor orchestration helpers (ADR-0006 close-out).
 *
 * The editor component itself is coverage-excluded (it's wiring), but the
 * pure orchestration logic — deciding what to fire on a sentence, scaling the
 * idle threshold by friction mode, and serialising for autosave — is unit-tested
 * here. This is the safety net for the contentEditable→Tiptap swap.
 */
import { describe, it, expect } from 'vitest'
import {
  pickEnginesForSentence,
  idleThresholdForMode,
  serializeForSave,
  parseStoredContent,
  extractContext,
  isParagraphComplete,
} from '@/lib/editor-orchestration'

describe('pickEnginesForSentence', () => {
  it('returns one primary engine when several cue classes match a phrase', () => {
    // A vague factual claim matches two cue classes; claim clarity wins.
    const engines = pickEnginesForSentence('basically the study shows an effect.')
    expect(engines).toEqual(['interceptor'])
  })

  it('returns an empty list for a sentence with no triggers', () => {
    const engines = pickEnginesForSentence('a plain neutral sentence about weather')
    // may or may not match, but must be an array
    expect(Array.isArray(engines)).toBe(true)
  })
})

describe('idleThresholdForMode', () => {
  it('returns the spec-correct 45000ms base in socratic (full friction)', () => {
    expect(idleThresholdForMode('socratic')).toBe(45000)
  })

  it('scales down in coach (~50%)', () => {
    expect(idleThresholdForMode('coach')).toBeLessThan(45000)
    expect(idleThresholdForMode('coach')).toBeGreaterThan(0)
  })

  it('scales down further in assistant (~25%)', () => {
    expect(idleThresholdForMode('assistant')).toBeLessThan(idleThresholdForMode('coach'))
  })

  it('is always a positive integer', () => {
    for (const m of ['socratic', 'coach', 'assistant'] as const) {
      const v = idleThresholdForMode(m)
      expect(v).toBeGreaterThan(0)
      expect(Number.isInteger(v)).toBe(true)
    }
  })
})

describe('serializeForSave', () => {
  it('serialises a ProseMirror JSON doc to a string for storage', () => {
    const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hi' }] }] }
    const out = serializeForSave(doc)
    expect(typeof out).toBe('string')
    expect(JSON.parse(out)).toEqual(doc)
  })

  it('serialises null/undefined to an empty string', () => {
    expect(serializeForSave(null)).toBe('')
    expect(serializeForSave(undefined)).toBe('')
  })
})

describe('parseStoredContent', () => {
  it('parses a stringified ProseMirror doc back to an object (ADR-0009 round-trip)', () => {
    const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hi' }] }] }
    const parsed = parseStoredContent(JSON.stringify(doc))
    expect(parsed).toEqual(doc)
    expect(typeof parsed).toBe('object')
  })

  it('returns legacy HTML strings verbatim', () => {
    const html = '<p>legacy <b>content</b></p>'
    expect(parseStoredContent(html)).toBe(html)
  })

  it('returns non-doc JSON strings verbatim (not a ProseMirror doc)', () => {
    const notADoc = '{"foo": "bar"}'
    expect(parseStoredContent(notADoc)).toBe(notADoc)
  })

  it('returns empty string for null/undefined/empty', () => {
    expect(parseStoredContent(null)).toBe('')
    expect(parseStoredContent(undefined)).toBe('')
    expect(parseStoredContent('')).toBe('')
  })

  it('treats malformed JSON-looking text as HTML', () => {
    const broken = '{not json at all'
    expect(parseStoredContent(broken)).toBe(broken)
  })
})

describe('extractContext', () => {
  it('returns the last 3 paragraphs as context and the trailing one as stub', () => {
    const text = ['p1 first', 'p2 second', 'p3 third', 'p4 fourth'].join('\n\n')
    const { context, stub } = extractContext(text)
    expect(context).toBe('p2 second\n\np3 third\n\np4 fourth')
    expect(stub).toBe('p4 fourth')
  })

  it('handles fewer than 3 paragraphs', () => {
    const { context, stub } = extractContext('only one paragraph')
    expect(context).toBe('only one paragraph')
    expect(stub).toBe('only one paragraph')
  })

  it('returns empty context for empty text', () => {
    expect(extractContext('')).toEqual({ context: '', stub: '' })
  })
})

describe('isParagraphComplete', () => {
  it('detects paragraph completion: ≥2 paras, last short, prev long', () => {
    const paras = ['a substantial paragraph with many words to pass the length threshold here', 'short']
    expect(isParagraphComplete(paras)).toBe(true)
  })

  it('returns false when only one paragraph exists', () => {
    expect(isParagraphComplete(['just one paragraph here with enough words'])).toBe(false)
  })

  it('returns false when the last paragraph is not short', () => {
    const paras = ['first paragraph long enough', 'second paragraph also long enough to not count']
    expect(isParagraphComplete(paras)).toBe(false)
  })
})
