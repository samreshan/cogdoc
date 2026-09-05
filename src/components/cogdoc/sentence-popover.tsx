'use client'

import { useEffect, useRef, useState } from 'react'
import { useCogdoc } from '@/lib/store'
import { api } from '@/lib/api-client'
import { getInterventionsForKey, ENGINE_COLORS } from '@/lib/sentence-highlight'
import { ENGINE_CHARACTERS, EnginePet } from '@/lib/engine-characters'
import {
  Sparkles, ShieldCheck, ListTree, BookOpen, X,
  Quote, ChevronDown, ChevronUp, AlertTriangle,
  Search, Pencil, ListPlus, MessageCircle, Loader2, Check,
  Link2, PanelLeft, Send,
} from 'lucide-react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import type { Intervention, EngineType, Verdict } from '@/lib/types'
import { quoteForReviewItem } from '@/lib/research-document-anchors'
import { interventionQuestion } from '@/lib/intervention-language'

// Use the character names from engine-characters.tsx
const ENGINE_META: Record<EngineType, {
  label: string; icon: typeof Sparkles
}> = {
  interceptor: { label: ENGINE_CHARACTERS.interceptor.name, icon: AlertTriangle },
  socratic:    { label: ENGINE_CHARACTERS.socratic.name,    icon: BookOpen },
  citation:    { label: ENGINE_CHARACTERS.citation.name,    icon: ShieldCheck },
  scaffold:    { label: ENGINE_CHARACTERS.scaffold.name,    icon: ListTree },
}

const VERDICT_META: Record<Verdict, { label: string; bg: string; color: string }> = {
  supported:              { label: 'Supported',            bg: 'bg-emerald-100', color: 'text-emerald-700' },
  partially_supported:    { label: 'Partially Supported',  bg: 'bg-amber-100',   color: 'text-amber-700' },
  unsupported:            { label: 'Unsupported',          bg: 'bg-rose-100',    color: 'text-rose-700' },
  insufficient_evidence:  { label: 'Insufficient Evidence',bg: 'bg-stone-100',   color: 'text-stone-600' },
}

// ── Actionable insights per engine ─────────────────────────────────────────
// Instead of generic "Engage/Dismiss", each engine offers specific next-steps
// the writer can take. Clicking an action marks the intervention as engaged
// and (optionally) triggers a follow-up.
interface Action {
  id: string
  label: string
  icon: typeof Search
  hint: string
}

const ENGINE_ACTIONS: Record<EngineType, Action[]> = {
  interceptor: [
    { id: 'rewrite', label: 'Rewrite this', icon: Pencil, hint: 'Make the claim specific and evidenced' },
    { id: 'evidence', label: 'Find evidence', icon: Search, hint: 'Search your library for supporting sources' },
    { id: 'answer', label: 'Answer this', icon: MessageCircle, hint: 'Respond here and let Cogdoc evaluate your reasoning' },
  ],
  socratic: [
    { id: 'answer', label: 'Answer this', icon: MessageCircle, hint: 'Respond here and let Cogdoc evaluate your reasoning' },
    { id: 'scaffold', label: 'Show scaffold', icon: ListPlus, hint: 'Get a structural outline for your answer' },
    { id: 'sources', label: 'Find sources', icon: Search, hint: 'Search your library for relevant evidence' },
  ],
  citation: [
    { id: 'answer', label: 'Answer evidence check', icon: MessageCircle, hint: 'Explain what supports the claim and what remains uncertain' },
    { id: 'sources', label: 'Find sources', icon: Search, hint: 'Search your library for more evidence' },
    { id: 'view', label: 'View evidence', icon: Quote, hint: 'Read the cited passages in full' },
  ],
  scaffold: [
    { id: 'apply', label: 'Apply scaffold', icon: ListPlus, hint: 'Insert the scaffold into your draft' },
    { id: 'answer', label: 'Answer this', icon: MessageCircle, hint: 'Fill the structure in your own words and evaluate it' },
  ],
}

export default function SentencePopover() {
  const interventions = useCogdoc((s) => s.activeInterventions)
  const hoveredKey = useCogdoc((s) => s.hoveredSentenceKey)
  const hoveredPosition = useCogdoc((s) => s.hoveredPosition)
  const setHovered = useCogdoc((s) => s.setHovered)
  const markFading = useCogdoc((s) => s.markInterventionFading)
  const removeIntervention = useCogdoc((s) => s.removeIntervention)
  const updateIntervention = useCogdoc((s) => s.updateIntervention)
  const bumpAnalytics = useCogdoc((s) => s.bumpAnalytics)
  const project = useCogdoc((s) => s.activeProject)
  const researchActions = useCogdoc((s) => s.researchActions)
  const reviewItems = useCogdoc((s) => s.reviewItems)
  const showNavigator = useCogdoc((s) => s.showNavigator)
  const selectResearchEntity = useCogdoc((s) => s.selectResearchEntity)
  const openIdeTab = useCogdoc((s) => s.openIdeTab)
  const setMobilePane = useCogdoc((s) => s.setMobilePane)
  const setSourceMapperQuery = useCogdoc((s) => s.setSourceMapperQuery)
  const focusEditorText = useCogdoc((s) => s.focusEditorText)
  const bumpLibrary = useCogdoc((s) => s.bumpLibrary)

  const [actionLoading, setActionLoading] = useState<string | null>(null) // interventionId+actionId
  const [expandedEvidence, setExpandedEvidence] = useState<string | null>(null)
  const [answeringId, setAnsweringId] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [feedback, setFeedback] = useState<Record<string, { satisfied: boolean; rationale: string; evaluator: 'ai' | 'local' }>>({})
  const closeTimer = useRef<number | null>(null)
  const reduceMotion = useReducedMotion()

  const visible = hoveredKey !== null && hoveredPosition !== null

  // Close behaviour: leaving both the underlined sentence and the popover
  // schedules a close (with a grace period so the cursor can cross the gap);
  // re-entering either cancels it. Escape and scrolling close immediately —
  // the popover is position: fixed, so it goes stale as soon as the page moves.
  useEffect(() => {
    if (!visible) return
    const cancelClose = () => {
      if (closeTimer.current !== null) {
        window.clearTimeout(closeTimer.current)
        closeTimer.current = null
      }
    }
    const close = () => setHovered(null, null)
    const onMouseOver = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (t.closest?.('[data-sentence-popover], .cogdoc-mark, .cogdoc-action-mark, .cogdoc-review-mark')) {
        cancelClose()
      } else {
        cancelClose()
        closeTimer.current = window.setTimeout(close, 300)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    const onScroll = (e: Event) => {
      if (e.target instanceof HTMLElement && e.target.closest('[data-sentence-popover]')) return
      close()
    }
    document.addEventListener('mouseover', onMouseOver)
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('scroll', onScroll, true)
    return () => {
      cancelClose()
      document.removeEventListener('mouseover', onMouseOver)
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('scroll', onScroll, true)
    }
  }, [visible, setHovered])

  if (!visible) return null

  const top = (hoveredPosition?.top ?? 0) + 8
  const left = Math.max(16, Math.min(hoveredPosition?.left ?? 16, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 390))
  const contextual = (() => {
    if (!hoveredKey) return null
    if (hoveredKey.startsWith('action:')) {
      const id = hoveredKey.slice('action:'.length)
      const action = researchActions.find((item) => item.id === id)
      return {
        kind: 'Next action',
        title: action?.title ?? 'Research action',
        detail: action?.detail ?? 'Open the project navigator to review this action.',
        meta: action ? `Priority ${action.priority}${action.pinned ? ' · pinned' : ''}` : undefined,
        href: `#action-${id}`,
        open: () => { showNavigator(); selectResearchEntity('action', id); setMobilePane('navigator') },
      }
    }
    if (hoveredKey.startsWith('review:')) {
      const quote = hoveredKey.slice('review:'.length)
      const item = reviewItems.find((candidate) => quoteForReviewItem(candidate)?.slice(0, 300) === quote)
      return {
        kind: 'Review action',
        title: item?.title ?? 'Highlighted review passage',
        detail: item?.detail ?? 'This passage has an unresolved document review action.',
        meta: item ? `${item.severity} · ${item.state.replaceAll('_', ' ')}` : undefined,
        open: () => openIdeTab({ id: 'actions', kind: 'actions', label: 'Next actions', closable: true }),
      }
    }
    return null
  })()

  if (contextual) return <InlineContextCard
    {...contextual}
    top={top}
    left={left}
    onClose={() => setHovered(null, null)}
  />

  const sentenceInterventions = hoveredKey
    ? getInterventionsForKey(interventions, hoveredKey)
    : []

  if (sentenceInterventions.length === 0) return null

  async function handleAction(intervention: Intervention, action: Action) {
    const actionKey = `${intervention.id}-${action.id}`
    if (action.id === 'answer') {
      setAnsweringId((current) => current === intervention.id ? null : intervention.id)
      return
    }
    if (action.id === 'view') {
      setExpandedEvidence((current) => current === intervention.id ? null : intervention.id)
      return
    }
    setActionLoading(actionKey)
    try {
      // Navigation and structural help are engagement, not resolution. The
      // highlight remains until the researcher's answer passes evaluation.
      await api.patchIntervention(intervention.id, { userAction: 'engaged', status: 'active' })
      bumpAnalytics()
      if ((action.id === 'sources' || action.id === 'evidence') && intervention.promptText) {
        setSourceMapperQuery(intervention.promptText)
        openIdeTab({ id: 'sources', kind: 'sources', label: 'Source mapper', closable: true })
        setHovered(null, null)
      } else if ((action.id === 'rewrite' || action.id === 'apply') && intervention.promptText) {
        focusEditorText(intervention.promptText)
        setHovered(null, null)
      } else if (action.id === 'scaffold' && project && intervention.promptText) {
        const res = await api.scaffold(project.id, 'Provide a structural scaffold for answering this question.', intervention.promptText)
        useCogdoc.getState().pushIntervention(res.intervention)
        bumpAnalytics()
      }
    } catch {
      setFeedback((current) => ({ ...current, [intervention.id]: { satisfied: false, rationale: 'Cogdoc could not complete that action. Try again.', evaluator: 'local' } }))
    } finally {
      setActionLoading(null)
    }
  }

  async function submitAnswer(intervention: Intervention) {
    const answer = (answers[intervention.id] ?? '').trim()
    if (answer.length < 5) {
      setFeedback((current) => ({ ...current, [intervention.id]: { satisfied: false, rationale: 'Write a substantive answer before asking Cogdoc to evaluate it.', evaluator: 'local' } }))
      return
    }
    setActionLoading(`${intervention.id}-submit`)
    try {
      const result = await api.answerIntervention(intervention.id, answer)
      setFeedback((current) => ({ ...current, [intervention.id]: {
        satisfied: result.satisfied,
        rationale: result.evaluation.rationale,
        evaluator: result.evaluator,
      } }))
      updateIntervention(intervention.id, result.intervention)
      bumpAnalytics()
      if (result.satisfied) {
        bumpLibrary()
        markFading(intervention.id)
        window.setTimeout(() => {
          removeIntervention(intervention.id)
          const remaining = sentenceInterventions.filter((item) => item.id !== intervention.id)
          if (remaining.length === 0) setHovered(null, null)
        }, 900)
      }
    } catch (error) {
      setFeedback((current) => ({ ...current, [intervention.id]: {
        satisfied: false,
        rationale: (error as Error).message || 'Cogdoc could not evaluate this answer.',
        evaluator: 'local',
      } }))
    } finally {
      setActionLoading(null)
    }
  }

  function handleDismiss(id: string) {
    markFading(id)
    bumpAnalytics()
    api.patchIntervention(id, { userAction: 'dismissed', status: 'resolved' }).catch(() => {})
    setTimeout(() => {
      removeIntervention(id)
      const remaining = sentenceInterventions.filter((i) => i.id !== id)
      if (remaining.length === 0) {
        setHovered(null, null)
      }
    }, 300)
  }

  return (
    <div className="fixed" style={{ top, left, zIndex: 50, width: 370 }}>
      <AnimatePresence>
        <motion.div
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.96 }}
          animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.96 }}
          transition={{ duration: reduceMotion ? 0.05 : 0.15, ease: 'easeOut' }}
          className="bg-white/98 backdrop-blur-sm rounded-lg shadow-xl border border-stone-200 overflow-hidden"
          role="dialog"
          aria-label="Interventions for selected passage"
          aria-live="polite"
        >
          {/* Header */}
          <div className="px-3 py-2 border-b border-stone-100 flex items-center justify-between">
            <span className="text-[11px] font-medium text-stone-500 uppercase tracking-wide">
              {sentenceInterventions.length} intervention{sentenceInterventions.length === 1 ? '' : 's'}
            </span>
            <button
              onClick={() => setHovered(null, null)}
              className="text-stone-400 hover:text-stone-700"
              aria-label="Close interventions"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Stacked intervention cards */}
          <div className="max-h-[540px] overflow-y-auto">
            {sentenceInterventions.map((i) => {
              const meta = ENGINE_META[i.engineType] ?? ENGINE_META.socratic
              const color = ENGINE_COLORS[i.engineType]
              const verdict = i.verdict ? VERDICT_META[i.verdict] : null
              const actions = ENGINE_ACTIONS[i.engineType] ?? []
              const evidenceExpanded = expandedEvidence === i.id
              const evidences = i.evidences ?? []
              const isAnswering = answeringId === i.id
              const answerFeedback = feedback[i.id]

              return (
                <div
                  key={i.id}
                  className="px-3 py-2.5 border-b border-stone-100 last:border-b-0"
                >
                  {/* Card header with pixelated pet (alert state — perked up) */}
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <div
                      className="rounded p-0.5"
                      style={{ backgroundColor: ENGINE_CHARACTERS[i.engineType].bgColor }}
                      title={ENGINE_CHARACTERS[i.engineType].archetype}
                    >
                      <EnginePet engine={i.engineType} size={20} state="alert" />
                    </div>
                    <span className="text-xs font-bold" style={{ color }}>{meta.label}</span>
                    <span className="text-[9px] text-stone-400 uppercase tracking-wide">
                      {ENGINE_CHARACTERS[i.engineType].role}
                    </span>
                    {verdict && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${verdict.bg} ${verdict.color}`}>
                        {verdict.label}
                      </span>
                    )}
                    <button
                      onClick={() => handleDismiss(i.id)}
                      className="ml-auto text-stone-300 hover:text-stone-600"
                      title="Dismiss"
                      aria-label={`Dismiss ${meta.label} intervention`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Prompt that triggered it */}
                  {i.promptText && i.engineType !== 'socratic' && (
                    <p className="text-[11px] text-stone-400 italic mb-1 line-clamp-1">
                      &ldquo;{i.promptText.slice(0, 100)}&hellip;&rdquo;
                    </p>
                  )}

                  {/* Response */}
                  {i.engineType === 'citation' && i.responseText && (
                    <p className="text-sm text-stone-800 leading-relaxed mb-1.5">{interventionQuestion(i)}</p>
                  )}
                  {i.engineType !== 'citation' && i.responseText && (
                    <p className="text-sm text-stone-800 leading-relaxed whitespace-pre-wrap mb-1.5">
                      {interventionQuestion(i)}
                    </p>
                  )}

                  {answerFeedback && (
                    <div className={`mb-2 rounded border px-2.5 py-2 text-[11px] leading-4 ${answerFeedback.satisfied ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`} role="status">
                      <div className="flex items-center gap-1.5 font-medium">
                        {answerFeedback.satisfied ? <Check className="h-3.5 w-3.5" /> : <MessageCircle className="h-3.5 w-3.5" />}
                        {answerFeedback.satisfied ? 'Satisfied · saved as structured research lines' : 'Follow-up needed'}
                        <span className="ml-auto font-mono text-[8px] uppercase opacity-60">{answerFeedback.evaluator}</span>
                      </div>
                      <p className="mt-1">{answerFeedback.rationale}</p>
                    </div>
                  )}

                  {/* Expandable evidence for Citation Sentinel */}
                  {i.engineType === 'citation' && evidences.length > 0 && (
                    <div className="mb-2">
                      <button
                        onClick={() => setExpandedEvidence(evidenceExpanded ? null : i.id)}
                        className="flex items-center gap-1 text-[11px] font-medium text-stone-500 hover:text-stone-700"
                      >
                        {evidenceExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        {evidences.length} source{evidences.length === 1 ? '' : 's'}
                      </button>
                      {evidenceExpanded && (
                        <div className="mt-1.5 space-y-1.5 max-h-32 overflow-y-auto">
                          {evidences.map((e) => (
                            <div key={e.id} className="p-2 rounded bg-stone-50 border border-stone-200">
                              <div className="flex items-center gap-1 text-[10px] text-stone-500 mb-1">
                                <Quote className="w-2.5 h-2.5" />
                                <span className="truncate font-medium">{e.chunk.pdf.filename}</span>
                                <span>· p.{e.chunk.pageApprox}</span>
                                <span className="ml-auto text-emerald-600 font-medium">
                                  {(e.similarityScore * 100).toFixed(0)}%
                                </span>
                              </div>
                              <p className="text-[11px] text-stone-700 line-clamp-3 leading-relaxed">
                                {e.citedExcerpt}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {isAnswering && (
                    <form onSubmit={(event) => { event.preventDefault(); void submitAnswer(i) }} className="mb-2 rounded border border-stone-200 bg-[#faf9f5] p-2.5">
                      <label htmlFor={`intervention-answer-${i.id}`} className="text-[11px] font-medium text-stone-700">Your reasoning</label>
                      <textarea
                        id={`intervention-answer-${i.id}`}
                        value={answers[i.id] ?? ''}
                        onChange={(event) => setAnswers((current) => ({ ...current, [i.id]: event.target.value }))}
                        rows={4}
                        autoFocus
                        placeholder="Answer in your own words. Name the reason, evidence, example, or limitation Cogdoc should evaluate."
                        className="mt-1.5 w-full resize-y rounded border border-stone-300 bg-white px-2.5 py-2 text-xs leading-5 text-stone-800 outline-none focus:border-[#386c5c] focus:ring-2 focus:ring-[#dbe8e1]"
                      />
                      <div className="mt-2 flex gap-1.5">
                        <button type="submit" disabled={actionLoading === `${i.id}-submit`} className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded bg-[#173f35] px-2 text-[11px] font-medium text-white hover:bg-[#245548] disabled:opacity-50">
                          {actionLoading === `${i.id}-submit` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                          Evaluate answer
                        </button>
                        <button type="button" onClick={() => {
                          if (i.promptText) {
                            setSourceMapperQuery(i.promptText)
                            openIdeTab({ id: 'sources', kind: 'sources', label: 'Source mapper', closable: true })
                            setHovered(null, null)
                          }
                        }} className="flex h-8 items-center justify-center gap-1.5 rounded border border-stone-300 bg-white px-2 text-[11px] font-medium text-stone-700 hover:bg-stone-50">
                          <Search className="h-3.5 w-3.5" />Sources
                        </button>
                      </div>
                      <p className="mt-1.5 text-[9px] leading-3 text-stone-500">A satisfactory answer is saved to the notebook as claim, reasoning, evaluation, and supporting passages—not inserted into the draft.</p>
                    </form>
                  )}

                  {/* Actionable insights — replaces Engage/Dismiss */}
                  <div className="mt-2 space-y-1">
                    {actions.map((action) => {
                      const ActionIcon = action.icon
                      const isLoading = actionLoading === `${i.id}-${action.id}`
                      return (
                        <button
                          key={action.id}
                          onClick={() => handleAction(i, action)}
                          disabled={isLoading}
                          className="w-full flex items-start gap-2 px-2 py-1.5 text-left rounded border border-stone-200 bg-white hover:bg-stone-50 hover:border-stone-300 transition-colors group disabled:opacity-50"
                        >
                          {isLoading ? (
                            <Loader2 className="w-3.5 h-3.5 mt-0.5 animate-spin text-stone-400 shrink-0" />
                          ) : (
                            <ActionIcon className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color }} />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-stone-800">{action.label}</div>
                            <div className="text-[10px] text-stone-500 leading-tight">{action.hint}</div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>
      </AnimatePresence>

    </div>
  )
}

function InlineContextCard({ kind, title, detail, meta, href, top, left, open, onClose }: {
  kind: string
  title: string
  detail: string
  meta?: string
  href?: string
  top: number
  left: number
  open: () => void
  onClose: () => void
}) {
  return <div className="fixed" style={{ top, left, zIndex: 50, width: 340 }}>
    <div className="overflow-hidden rounded-lg border border-stone-200 bg-white/98 shadow-xl backdrop-blur-sm" role="dialog" aria-label={`${kind}: ${title}`} aria-live="polite">
      <div className="flex items-center justify-between border-b border-stone-100 px-3 py-2">
        <span className="font-mono text-[9px] font-medium uppercase tracking-[.14em] text-[#426458]">{kind}</span>
        <button onClick={onClose} className="text-stone-400 hover:text-stone-700" aria-label={`Close ${kind.toLowerCase()}`}><X className="h-3.5 w-3.5" /></button>
      </div>
      <div className="px-3 py-3">
        <p className="font-serif text-[15px] font-semibold leading-5 text-stone-850">{title}</p>
        <p className="mt-1.5 text-[11px] leading-5 text-stone-600">{detail}</p>
        {meta && <p className="mt-2 font-mono text-[9px] uppercase tracking-wide text-stone-400">{meta}</p>}
        <div className="mt-3 flex gap-2">
          <button onClick={() => { open(); onClose() }} className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded border border-stone-200 bg-white px-2 text-[11px] font-medium text-stone-700 hover:border-[#8da79d] hover:bg-[#f3f5f2]"><PanelLeft className="h-3.5 w-3.5" />{kind === 'Review action' ? 'Open queue' : 'Show in navigator'}</button>
          {href && <a href={href} onClick={onClose} className="flex h-8 items-center justify-center gap-1.5 rounded border border-stone-200 px-2 text-[11px] font-medium text-[#386c5c] hover:border-[#8da79d] hover:bg-[#f3f5f2]"><Link2 className="h-3.5 w-3.5" />Permalink</a>}
        </div>
      </div>
    </div>
  </div>
}
