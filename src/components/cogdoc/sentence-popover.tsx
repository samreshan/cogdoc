'use client'

import { useState } from 'react'
import { useCogdoc } from '@/lib/store'
import { api } from '@/lib/api-client'
import { getInterventionsForKey, ENGINE_COLORS } from '@/lib/sentence-highlight'
import { ENGINE_CHARACTERS, EnginePet } from '@/lib/engine-characters'
import {
  Sparkles, ShieldCheck, ListTree, BookOpen, X,
  Quote, ChevronDown, ChevronUp, AlertTriangle,
  Search, Pencil, ListPlus, MessageCircle, Loader2, Check,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Intervention, EngineType, Verdict } from '@/lib/types'

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
    { id: 'answer', label: 'Answer this', icon: MessageCircle, hint: 'Type your answer in the editor' },
  ],
  socratic: [
    { id: 'answer', label: 'Answer this', icon: MessageCircle, hint: 'Type your answer in the editor' },
    { id: 'scaffold', label: 'Show scaffold', icon: ListPlus, hint: 'Get a structural outline for your answer' },
    { id: 'sources', label: 'Find sources', icon: Search, hint: 'Search your library for relevant evidence' },
  ],
  citation: [
    { id: 'sources', label: 'Find sources', icon: Search, hint: 'Search your library for more evidence' },
    { id: 'rewrite', label: 'Rewrite claim', icon: Pencil, hint: 'Adjust the claim to match the evidence' },
    { id: 'view', label: 'View evidence', icon: Quote, hint: 'Read the cited passages in full' },
  ],
  scaffold: [
    { id: 'apply', label: 'Apply scaffold', icon: ListPlus, hint: 'Insert the scaffold into your draft' },
    { id: 'answer', label: 'Answer this', icon: MessageCircle, hint: 'Fill in the blanks yourself' },
  ],
}

export default function SentencePopover() {
  const interventions = useCogdoc((s) => s.activeInterventions)
  const hoveredKey = useCogdoc((s) => s.hoveredSentenceKey)
  const hoveredPosition = useCogdoc((s) => s.hoveredPosition)
  const setHovered = useCogdoc((s) => s.setHovered)
  const markFading = useCogdoc((s) => s.markInterventionFading)
  const removeIntervention = useCogdoc((s) => s.removeIntervention)
  const bumpAnalytics = useCogdoc((s) => s.bumpAnalytics)
  const project = useCogdoc((s) => s.activeProject)

  const [popoverHovered, setPopoverHovered] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null) // interventionId+actionId
  const [expandedEvidence, setExpandedEvidence] = useState<string | null>(null)

  const visible = hoveredKey !== null && hoveredPosition !== null
  if (!visible) return null

  const sentenceInterventions = hoveredKey
    ? getInterventionsForKey(interventions, hoveredKey)
    : []

  if (sentenceInterventions.length === 0) return null

  async function handleAction(intervention: Intervention, action: Action) {
    const actionKey = `${intervention.id}-${action.id}`
    setActionLoading(actionKey)

    // Mark as engaged
    markFading(intervention.id)
    bumpAnalytics()
    try {
      await api.patchIntervention(intervention.id, { userAction: 'engaged', status: 'resolved' })
    } catch { /* silent */ }

    // Trigger follow-up action if applicable
    if (action.id === 'sources' && project && intervention.promptText) {
      // Open the library modal so the user can search for sources
      useCogdoc.getState().setActiveModal('library')
    }
    if (action.id === 'scaffold' && project && intervention.promptText) {
      // Fire the scaffold engine on this sentence's context
      try {
        const res = await api.scaffold(project.id, 'Provide a structural scaffold for answering this question.', intervention.promptText)
        useCogdoc.getState().pushIntervention(res.intervention)
        bumpAnalytics()
      } catch { /* silent */ }
    }

    setActionLoading(null)
    setTimeout(() => {
      removeIntervention(intervention.id)
      const remaining = sentenceInterventions.filter((i) => i.id !== intervention.id)
      if (remaining.length === 0) {
        setHovered(null, null)
      }
    }, 300)
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

  const top = (hoveredPosition?.top ?? 0) + 8
  const left = Math.max(16, Math.min(hoveredPosition?.left ?? 16, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 360))

  return (
    <div
      className="fixed"
      style={{ top, left, zIndex: 50, width: 340 }}
      onMouseEnter={() => setPopoverHovered(true)}
      onMouseLeave={() => {
        setPopoverHovered(false)
        setHovered(null, null)
      }}
    >
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.96 }}
          transition={{ duration: 0.15 }}
          className="bg-white/98 backdrop-blur-sm rounded-lg shadow-xl border border-stone-200 overflow-hidden"
        >
          {/* Header */}
          <div className="px-3 py-2 border-b border-stone-100 flex items-center justify-between">
            <span className="text-[11px] font-medium text-stone-500 uppercase tracking-wide">
              {sentenceInterventions.length} intervention{sentenceInterventions.length === 1 ? '' : 's'}
            </span>
            <button
              onClick={() => setHovered(null, null)}
              className="text-stone-400 hover:text-stone-700"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Stacked intervention cards */}
          <div className="max-h-[450px] overflow-y-auto">
            {sentenceInterventions.map((i) => {
              const meta = ENGINE_META[i.engineType] ?? ENGINE_META.socratic
              const Icon = meta.icon
              const color = ENGINE_COLORS[i.engineType]
              const verdict = i.verdict ? VERDICT_META[i.verdict] : null
              const actions = ENGINE_ACTIONS[i.engineType] ?? []
              const actionKey = `${i.id}`
              const evidenceExpanded = expandedEvidence === i.id
              const evidences = i.evidences ?? []

              return (
                <div
                  key={i.id}
                  className="px-3 py-2.5 border-b border-stone-100 last:border-b-0"
                  style={{ borderLeft: `3px solid ${color}` }}
                >
                  {/* Card header with pixelated pet */}
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <div
                      className="rounded p-0.5"
                      style={{ backgroundColor: ENGINE_CHARACTERS[i.engineType].bgColor }}
                    >
                      <EnginePet engine={i.engineType} size={20} />
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
                    <p className="text-sm text-stone-800 leading-relaxed mb-1.5">{i.responseText}</p>
                  )}
                  {i.engineType !== 'citation' && i.responseText && (
                    <p className="text-sm text-stone-800 leading-relaxed whitespace-pre-wrap mb-1.5">
                      {i.responseText}
                    </p>
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
