'use client'

/**
 * useEngineFiring — the single home for engine-firing orchestration.
 *
 * Owns the friction-scaled cooldown ledger, the per-engine API dispatch
 * (including the Interceptor's SSE-stream-then-persist path with blocking
 * fallback, ADR-0007), and the once-per-session Blindspot check (§7.2).
 *
 * Extracted from the editor component so the firing rules live in exactly one
 * place — the editor is wiring (when to call), this hook is policy (whether
 * and how to call).
 */
import { useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { useCogdoc } from '@/lib/store'
import { api } from '@/lib/api-client'
import { getCooldown } from '@/lib/friction'
import { extractLastSentence } from '@/lib/content-analyzer'
import { consumeInterceptorStream } from '@/lib/ai-gateway'
import type { EngineType, Intervention } from '@/lib/types'
import { canonicalInterventionPhrase } from '@/lib/intervention-dedupe'

export interface UseEngineFiringResult {
  /**
   * Fire one engine for a sentence + context. Respects the friction-scaled
   * cooldown; for the Socratic idle trigger (empty sentence) it falls back to
   * the last completed sentence of the document so the intervention can be
   * linked to real text.
   */
  fireEngine: (engine: EngineType, sentence: string, context: string) => Promise<void>
  /** Surface ONE overlooked library passage per session (anti-fatigue). */
  checkBlindspot: (draft: string) => void
}

export function useEngineFiring(getText: () => string): UseEngineFiringResult {
  const project = useCogdoc((s) => s.activeProject)
  const pushIntervention = useCogdoc((s) => s.pushIntervention)
  const setEngineLoading = useCogdoc((s) => s.setEngineLoading)
  const bumpAnalytics = useCogdoc((s) => s.bumpAnalytics)
  const frictionMode = useCogdoc((s) => s.frictionMode)
  const blindspotShown = useCogdoc((s) => s.blindspotShownThisSession)
  const markBlindspotShown = useCogdoc((s) => s.markBlindspotShown)

  const lastFireRef = useRef<Record<EngineType, number>>({
    socratic: 0, interceptor: 0, citation: 0, scaffold: 0,
  })
  const phrasesInFlightRef = useRef(new Set<string>())

  const fireEngine = useCallback(
    async (engine: EngineType, sentence: string, context: string) => {
      if (!project) return
      const now = Date.now()
      if (now - lastFireRef.current[engine] < getCooldown(engine, frictionMode)) return
      lastFireRef.current[engine] = now

      let effective = sentence
      if (engine === 'socratic' && !effective) {
        effective = extractLastSentence(getText())
        if (!effective) return
      }

      const phraseKey = canonicalInterventionPhrase(effective)
      if (phraseKey) {
        const alreadyActive = useCogdoc.getState().activeInterventions.some((item) =>
          item.status === 'active' && canonicalInterventionPhrase(item.promptText) === phraseKey,
        )
        if (alreadyActive || phrasesInFlightRef.current.has(phraseKey)) return
        phrasesInFlightRef.current.add(phraseKey)
      }

      setEngineLoading(engine, true)
      try {
        let intervention: Intervention | null = null
        if (engine === 'citation') {
          const res = await api.citationSentinel(project.id, effective, undefined, frictionMode)
          intervention = res.intervention
        } else if (engine === 'interceptor') {
          // ADR-0007: stream token-by-token from FastAPI, persist the
          // assembled text via the blocking route on done; fall back to the
          // blocking path entirely if the stream errors.
          try {
            const stream = await consumeInterceptorStream(
              { project_id: project.id, prompt: effective, context, friction_mode: frictionMode },
              (partial) => toast(`✦ ${partial}`, { id: 'interceptor-stream', duration: 1200 }),
            )
            const res = await api.interceptor(project.id, effective, context, undefined, frictionMode)
            if (res.action === 'pass') return
            if (stream.errorCode) {
              toast.error('Interceptor response replaced (non-generation guard)')
            }
            intervention = res.intervention ?? null
          } catch {
            const res = await api.interceptor(project.id, effective, context, undefined, frictionMode)
            if (res.action === 'pass') return
            intervention = res.intervention ?? null
          }
        } else if (engine === 'scaffold') {
          const res = await api.scaffold(project.id, 'Provide a structural scaffold for my next paragraph.', context, undefined, frictionMode)
          intervention = res.intervention
        } else {
          const res = await api.socraticSpacer(project.id, context, effective, undefined, frictionMode)
          intervention = res.intervention
        }
        if (intervention) {
          pushIntervention(intervention)
          bumpAnalytics()
        }
      } catch (e) {
        console.error(`${engine} failed:`, e)
      } finally {
        if (phraseKey) phrasesInFlightRef.current.delete(phraseKey)
        setEngineLoading(engine, false)
      }
    },
    [project, getText, pushIntervention, setEngineLoading, bumpAnalytics, frictionMode],
  )

  const checkBlindspot = useCallback(
    (draft: string) => {
      if (!project || blindspotShown) return
      if (draft.split(/\s+/).filter(Boolean).length < 30) return
      api.blindspot(project.id, draft)
        .then((res) => {
          if (res.blindspot && res.intervention) {
            pushIntervention(res.intervention)
            bumpAnalytics()
            markBlindspotShown()
          }
        })
        .catch(() => {})
    },
    [project, blindspotShown, pushIntervention, bumpAnalytics, markBlindspotShown],
  )

  return { fireEngine, checkBlindspot }
}
