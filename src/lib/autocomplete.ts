/**
 * Devil's Autocomplete logic (PRODUCT.md §7.1).
 *
 * Shows a short ghost-text continuation that creates productive temptation, but
 * the commit mechanic enforces that the user must type it themselves (socratic)
 * — preserving the act of production as the learning mechanism.
 *
 * Pure logic here (suggestion capping, validity, commit-action resolution);
 * the Tiptap decoration + commit wiring lands with the Sprint 3 surface swap.
 */
import { autocompleteAcceptAllowed, type FrictionMode } from '@/lib/friction'

/** Hard cap: an autocomplete suggestion is never more than this many words. */
export const MAX_SUGGESTION_WORDS = 12

/**
 * Sanitize a raw model suggestion into a valid autocomplete ghost phrase.
 * Truncates to the word cap, stops at the first sentence boundary, trims.
 */
export function sanitizeSuggestion(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  // Stop at the first sentence terminator — never suggest past a sentence end.
  const boundary = trimmed.search(/[.!?]/)
  const stopped = boundary !== -1 ? trimmed.slice(0, boundary + 1) : trimmed
  const words = stopped.split(/\s+/).filter(Boolean)
  return words.slice(0, MAX_SUGGESTION_WORDS).join(' ')
}

/** Whether a sanitized suggestion is valid to show as ghost text. */
export function isSuggestionValid(suggestion: string): boolean {
  const t = suggestion.trim()
  if (!t) return false
  // Reject multi-sentence — that would be generation, not autocomplete.
  const sentenceEnds = t.match(/[^.!?]*[.!?]/g) ?? []
  if (sentenceEnds.length > 1) return false
  return true
}

/**
 * Resolve how a suggestion interaction is logged.
 *   typed     — user typed the suggestion char-by-char (the learning path)
 *   ignored   — user typed something else / deleted the ghost
 *   overruled — Tab-accept used (only valid in assistant mode)
 *   rejected  — Tab-accept attempted in a mode that disallows it (no-op)
 */
export function resolveCommitAction(
  mode: FrictionMode,
  interaction: 'typed' | 'ignored' | 'tab-accept',
): 'typed' | 'ignored' | 'overruled' | 'rejected' {
  if (interaction === 'typed') return 'typed'
  if (interaction === 'ignored') return 'ignored'
  // tab-accept
  return autocompleteAcceptAllowed(mode) ? 'overruled' : 'rejected'
}
