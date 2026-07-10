/**
 * RED→GREEN — tests for Devil's Autocomplete (PRODUCT.md §7.1).
 *
 * An autocomplete that shows the next phrase as ghost text but physically will
 * not commit unless the user types it themselves (socratic mode) — creating
 * productive temptation while preserving the act of production. The
 * suggestion length is capped so it can never become a paragraph generator.
 */
import { describe, it, expect } from 'vitest'
import {
  MAX_SUGGESTION_WORDS,
  sanitizeSuggestion,
  isSuggestionValid,
  resolveCommitAction,
} from '@/lib/autocomplete'
import type { FrictionMode } from '@/lib/friction'

describe('MAX_SUGGESTION_WORDS', () => {
  it('is ≤ 12 (never a paragraph)', () => {
    expect(MAX_SUGGESTION_WORDS).toBeLessThanOrEqual(12)
  })
})

describe('sanitizeSuggestion', () => {
  it('truncates to the word cap', () => {
    const long = 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen'
    const out = sanitizeSuggestion(long)
    expect(out.split(/\s+/).length).toBeLessThanOrEqual(MAX_SUGGESTION_WORDS)
  })

  it('returns short suggestions unchanged', () => {
    expect(sanitizeSuggestion('a short phrase')).toBe('a short phrase')
  })

  it('strips trailing whitespace', () => {
    expect(sanitizeSuggestion('phrase   ')).toBe('phrase')
  })

  it('truncates at a sentence boundary when present within the cap', () => {
    // Stop at the first sentence terminator so we never auto-suggest a full
    // sentence + more.
    const out = sanitizeSuggestion('First sentence. then more words after the boundary here')
    expect(out.endsWith('.')).toBe(true)
  })

  it('returns empty string for blank input', () => {
    expect(sanitizeSuggestion('   ')).toBe('')
  })
})

describe('isSuggestionValid', () => {
  it('accepts a short phrase', () => {
    expect(isSuggestionValid('a short suggestion')).toBe(true)
  })

  it('rejects a multi-sentence suggestion (would be generation)', () => {
    expect(isSuggestionValid('First sentence. Second sentence.')).toBe(false)
  })

  it('rejects empty/whitespace', () => {
    expect(isSuggestionValid('')).toBe(false)
    expect(isSuggestionValid('   ')).toBe(false)
  })
})

describe('resolveCommitAction', () => {
  it('returns "typed" when the user typed each character (socratic)', () => {
    const action = resolveCommitAction('socratic' as FrictionMode, 'typed')
    expect(action).toBe('typed')
  })

  it('returns "ignored" when the user ignored the suggestion', () => {
    expect(resolveCommitAction('socratic' as FrictionMode, 'ignored')).toBe('ignored')
  })

  it('returns "overruled" when Tab-accept is used in assistant mode', () => {
    expect(resolveCommitAction('assistant' as FrictionMode, 'tab-accept')).toBe('overruled')
  })

  it('rejects Tab-accept in socratic mode, returning "rejected"', () => {
    expect(resolveCommitAction('socratic' as FrictionMode, 'tab-accept')).toBe('rejected')
  })
})
