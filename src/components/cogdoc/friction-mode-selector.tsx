'use client'

/**
 * Friction-mode segmented control (PRODUCT.md §9).
 *
 * A 3-position Socratic ⇄ Coach ⇂ Assistant switch in the editor top bar. It is
 * the visible surface of friction calibration: the chosen mode flows into the
 * store, into every engine request body (friction_mode), and the server-side
 * cooldown/guard logic honours it. The choice is persisted per-user via the
 * settings PUT so it survives a reload.
 *
 *   socratic  — full friction. Strict cooldowns, autocomplete typing-only.
 *   coach     — moderate. Cooldowns relaxed ~50%.
 *   assistant — light. Cooldowns relaxed ~75%, autocomplete Tab-accept on.
 *
 * NOTE: no mode ever permits multi-paragraph generation (the non-generation
 * invariant is mode-independent — see friction.ts + engine-guard.ts).
 */
import { useCogdoc } from '@/lib/store'
import { api } from '@/lib/api-client'
import { FRICTION_MODES, type FrictionMode } from '@/lib/friction'

const MODE_LABELS: Record<FrictionMode, string> = {
  socratic: 'Socratic',
  coach: 'Coach',
  assistant: 'Assistant',
}

const MODE_TOOLTIPS: Record<FrictionMode, string> = {
  socratic: 'Full friction — strict cooldowns, type each character yourself.',
  coach: 'Moderate friction — engines fire more often, still typed help.',
  assistant: 'Light friction — fast engines, Tab-accept autocomplete on.',
}

export default function FrictionModeSelector() {
  const frictionMode = useCogdoc((s) => s.frictionMode)
  const setFrictionMode = useCogdoc((s) => s.setFrictionMode)

  function choose(mode: FrictionMode) {
    if (mode === frictionMode) return
    setFrictionMode(mode)
    // Persist per-user; a failure is non-fatal (store already updated locally).
    api.setFrictionMode(mode).catch(() => {})
  }

  return (
    <div
      role="group"
      aria-label="Friction mode"
      className="flex items-center rounded-md border border-stone-200 overflow-hidden"
    >
      {FRICTION_MODES.map((mode) => {
        const active = mode === frictionMode
        return (
          <button
            key={mode}
            type="button"
            onClick={() => choose(mode)}
            aria-pressed={active}
            title={MODE_TOOLTIPS[mode]}
            className={`h-8 px-2.5 text-xs transition-colors ${
              active
                ? 'bg-stone-800 text-stone-50'
                : 'bg-white text-stone-500 hover:text-stone-900 hover:bg-stone-50'
            }`}
          >
            {MODE_LABELS[mode]}
          </button>
        )
      })}
    </div>
  )
}
