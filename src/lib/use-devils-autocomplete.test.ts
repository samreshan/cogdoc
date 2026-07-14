// @vitest-environment happy-dom
/**
 * Tests for useDevilsAutocomplete — the ghost-text commit-mechanic hook (§7.1).
 *
 * The hook owns the suggestion state and resolves how an interaction is logged:
 *  - typed:     user types the next char matching the ghost → commit one char
 *  - ignored:   user types a different char / deletes → ghost discarded
 *  - tab-accept:resolved via resolveCommitAction(mode, 'tab-accept') →
 *               'overruled' (assistant) or 'rejected' (socratic/coach, a no-op)
 *
 * The non-generation invariant holds: in socratic/coach the ghost NEVER commits
 * on Tab — the user must type each character. Only assistant allows accept-all.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDevilsAutocomplete } from '@/lib/use-devils-autocomplete'
import type { FrictionMode } from '@/lib/friction'

// Default mock fetch for the autocomplete route.
function mockAutocompleteResponse(suggestion: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ suggestion, intervention: { id: 'iv-1' } }),
  } as unknown as Response
}

let fetchMock: ReturnType<typeof vi.fn>
beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue(mockAutocompleteResponse('the study found'))
  globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('useDevilsAutocomplete', () => {
  it('loads a suggestion when given a draft', async () => {
    const { result } = renderHook(() => useDevilsAutocomplete('socratic' as FrictionMode))
    await act(async () => {
      await result.current.load('proj-1', 'according to')
    })
    expect(result.current.suggestion).toBe('the study found')
  })

  it('commits one matching character on typeCommit (socratic — type each char)', async () => {
    const { result } = renderHook(() => useDevilsAutocomplete('socratic' as FrictionMode))
    await act(async () => {
      await result.current.load('proj-1', 'according to')
    })
    expect(result.current.suggestion).toBe('the study found')
    // type the first char 't' → it matches, commit it
    act(() => result.current.typeCommit('t'))
    expect(result.current.suggestion).toBe('he study found')
    expect(result.current.committed).toBe('t')
  })

  it('discards the ghost when a non-matching char is typed (ignored)', async () => {
    const { result } = renderHook(() => useDevilsAutocomplete('socratic' as FrictionMode))
    await act(async () => {
      await result.current.load('proj-1', 'according to')
    })
    act(() => result.current.typeCommit('x')) // doesn't match 't'
    expect(result.current.suggestion).toBe('')
    expect(result.current.lastAction).toBe('ignored')
  })

  it('REJECTS Tab-accept in socratic (no-op, logs rejected)', async () => {
    const { result } = renderHook(() => useDevilsAutocomplete('socratic' as FrictionMode))
    await act(async () => {
      await result.current.load('proj-1', 'according to')
    })
    const accepted = act(() => result.current.tabAccept())
    expect(result.current.lastAction).toBe('rejected')
    // suggestion is discarded on a rejected tab
    expect(result.current.suggestion).toBe('')
  })

  it('ACCEPTS Tab-accept in assistant (overruled — commits the whole ghost)', async () => {
    const { result } = renderHook(() => useDevilsAutocomplete('assistant' as FrictionMode))
    await act(async () => {
      await result.current.load('proj-1', 'according to')
    })
    act(() => result.current.tabAccept())
    expect(result.current.lastAction).toBe('overruled')
    expect(result.current.committed).toBe('the study found')
    expect(result.current.suggestion).toBe('')
  })
})
