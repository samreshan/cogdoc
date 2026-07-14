'use client'

/**
 * useDevilsAutocomplete — ghost-text state + commit mechanic (PRODUCT.md §7.1).
 *
 * Owns the suggestion string shown as ghost text at the caret and resolves how
 * the user's interaction is logged. The commit mechanic IS the friction:
 *   - socratic/coach: the ghost commits ONLY one char at a time when the user
 *     types the matching next character. Tab/Enter accept-all is rejected.
 *   - assistant: Tab/Enter accept-all is allowed (overruled).
 *
 * This is deliberately framework-light: it manages plain state, not DOM. The
 * editor renders the ghost span from `suggestion` and calls typeCommit/tabAccept
 * on key events. This isolation makes the Tiptap port (Phase 5) a contained
 * swap — only the rendering layer changes.
 *
 * The actual commit logging (persisting userAction via PATCH) is the editor's
 * job; this hook surfaces `lastAction` so the editor can PATCH once per
 * interaction.
 */
import { useCallback, useState } from 'react'
import { resolveCommitAction } from '@/lib/autocomplete'
import type { FrictionMode } from '@/lib/friction'
import { api } from '@/lib/api-client'

export type AutocompleteAction = 'typed' | 'ignored' | 'overruled' | 'rejected' | null

export interface DevilsAutocomplete {
  /** The current ghost text to render at the caret ("" when none). */
  suggestion: string
  /** Characters committed so far from the ghost (typed or overruled). */
  committed: string
  /** The last resolved interaction (for the editor to PATCH). */
  lastAction: AutocompleteAction
  /** The persisted intervention id (set on load, for PATCH). */
  interventionId: string | null
  /** Fetch a new suggestion for the current draft. */
  load: (projectId: string, draft: string, paragraphId?: string) => Promise<void>
  /** Handle a typed character: commit one matching char, or discard on mismatch. */
  typeCommit: (typedChar: string) => void
  /** Handle Tab/Enter: accept-all in assistant, rejected (no-op) otherwise. */
  tabAccept: () => void
  /** Clear the ghost without an interaction (e.g. caret moved). */
  clear: () => void
}

export function useDevilsAutocomplete(mode: FrictionMode): DevilsAutocomplete {
  const [suggestion, setSuggestion] = useState('')
  const [committed, setCommitted] = useState('')
  const [lastAction, setLastAction] = useState<AutocompleteAction>(null)
  const [interventionId, setInterventionId] = useState<string | null>(null)

  const load = useCallback(
    async (projectId: string, draft: string, paragraphId?: string) => {
      const res = await api.autocomplete(projectId, draft, paragraphId, mode)
      setSuggestion(res.suggestion)
      setCommitted('')
      setLastAction(null)
      setInterventionId(res.intervention?.id ?? null)
    },
    [mode],
  )

  const typeCommit = useCallback(
    (typedChar: string) => {
      setSuggestion((cur) => {
        if (!cur) return cur
        if (cur.startsWith(typedChar)) {
          // matching char → commit it, advance the ghost by one char
          setCommitted((c) => c + typedChar)
          setLastAction('typed')
          return cur.slice(typedChar.length)
        }
        // mismatch → discard the ghost, log ignored
        setLastAction('ignored')
        return ''
      })
    },
    [],
  )

  const tabAccept = useCallback(() => {
    setSuggestion((cur) => {
      if (!cur) return cur
      const action = resolveCommitAction(mode, 'tab-accept')
      setLastAction(action)
      if (action === 'overruled') {
        // assistant: commit the whole remaining ghost
        setCommitted((c) => c + cur)
        return ''
      }
      // rejected (socratic/coach): no-op commit, discard the ghost
      return ''
    })
  }, [mode])

  const clear = useCallback(() => {
    setSuggestion('')
    setCommitted('')
  }, [])

  return { suggestion, committed, lastAction, interventionId, load, typeCommit, tabAccept, clear }
}
