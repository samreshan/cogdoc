'use client'

import { useState } from 'react'
import { useCogdoc } from '@/lib/store'
import { api } from '@/lib/api-client'
import { getInterventionsForKey, ENGINE_COLORS } from '@/lib/sentence-highlight'
import {
  Sparkles, ShieldCheck, ListTree, BookOpen, X, Check,
  Quote, ChevronDown, ChevronUp, AlertTriangle,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Intervention, EngineType, Verdict } from '@/lib/types'

const ENGINE_META: Record<EngineType, {
  label: string; icon: typeof Sparkles
}> = {
  interceptor: { label: 'Interceptor', icon: AlertTriangle },
  socratic:    { label: 'Socratic',    icon: BookOpen },
  citation:    { label: 'Citation Sentinel', icon: ShieldCheck },
  scaffold:    { label: 'Scaffold',    icon: ListTree },
}

const VERDICT_META: Record<Verdict, { label: string; bg: string; color: string }> = {
  supported:              { label: 'Supported',            bg: 'bg-emerald-100', color: 'text-emerald-700' },
  partially_supported:    { label: 'Partially Supported',  bg: 'bg-amber-100',   color: 'text-amber-700' },
  unsupported:            { label: 'Unsupported',          bg: 'bg-rose-100',    color: 'text-rose-700' },
  insufficient_evidence:  { label: 'Insufficient Evidence',bg: 'bg-stone-100',   color: 'text-stone-600' },
}

export default function SentencePopover() {
  const interventions = useCogdoc((s) => s.activeInterventions)
  const hoveredKey = useCogdoc((s) => s.hoveredSentenceKey)
  const hoveredPosition = useCogdoc((s) => s.hoveredPosition)
  const setHovered = useCogdoc((s) => s.setHovered)
  const markFading = useCogdoc((s) => s.markInterventionFading)
  const removeIntervention = useCogdoc((s) => s.removeIntervention)
  const bumpAnalytics = useCogdoc((s) => s.bumpAnalytics)

  const [popoverHovered, setPopoverHovered] = useState(false)

  // The popover stays visible if either the mark is hovered OR the popover itself is hovered
  const visible = hoveredKey !== null && hoveredPosition !== null

  if (!visible) return null

  const sentenceInterventions = hoveredKey
    ? getInterventionsForKey(interventions, hoveredKey)
    : []

  if (sentenceInterventions.length === 0) return null

  async function handleAction(id: string, action: 'engaged' | 'dismissed') {
    markFading(id)
    bumpAnalytics()
    try {
      await api.patchIntervention(id, { userAction: action, status: 'resolved' })
    } catch { /* silent */ }
    setTimeout(() => {
      removeIntervention(id)
      // If no more interventions for this sentence, hide popover
      const remaining = sentenceInterventions.filter((i) => i.id !== id)
      if (remaining.length === 0) {
        setHovered(null, null)
      }
    }, 300)
  }

  // Position: below the hovered mark, aligned left, clamped to viewport
  const top = (hoveredPosition?.top ?? 0) + 8
  const left = Math.max(16, Math.min(hoveredPosition?.left ?? 16, window.innerWidth - 340))

  return (
    <div
      className="fixed"
      style={{ top, left, zIndex: 50, width: 320 }}
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
          <div className="max-h-[400px] overflow-y-auto">
            {sentenceInterventions.map((i, idx) => {
              const meta = ENGINE_META[i.engineType] ?? ENGINE_META.socratic
              const Icon = meta.icon
              const color = ENGINE_COLORS[i.engineType]
              const verdict = i.verdict ? VERDICT_META[i.verdict] : null
              return (
                <div
                  key={i.id}
                  className="px-3 py-2.5 border-b border-stone-100 last:border-b-0"
                  style={{ borderLeft: `3px solid ${color}` }}
                >
                  {/* Card header */}
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Icon className="w-3.5 h-3.5" style={{ color }} />
                    <span className="text-xs font-medium" style={{ color }}>{meta.label}</span>
                    {verdict && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${verdict.bg} ${verdict.color}`}>
                        {verdict.label}
                      </span>
                    )}
                  </div>

                  {/* Prompt that triggered it */}
                  {i.promptText && i.engineType !== 'socratic' && (
                    <p className="text-[11px] text-stone-400 italic mb-1 line-clamp-1">
                      &ldquo;{i.promptText.slice(0, 100)}&hellip;&rdquo;
                    </p>
                  )}

                  {/* Response */}
                  {i.engineType === 'citation' ? (
                    <CitationBody intervention={i} />
                  ) : (
                    <p className="text-sm text-stone-800 leading-relaxed whitespace-pre-wrap">
                      {i.responseText}
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => handleAction(i.id, 'engaged')}
                      className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded border border-stone-300 bg-white hover:bg-stone-50 text-stone-700"
                    >
                      <Check className="w-2.5 h-2.5" /> Engage
                    </button>
                    <button
                      onClick={() => handleAction(i.id, 'dismissed')}
                      className="px-2 py-0.5 text-[11px] text-stone-400 hover:text-stone-600"
                    >
                      Dismiss
                    </button>
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

function CitationBody({ intervention }: { intervention: Intervention }) {
  const [expanded, setExpanded] = useState(false)
  const evidences = intervention.evidences ?? []

  return (
    <div className="space-y-1.5">
      {intervention.responseText && (
        <p className="text-sm text-stone-800 leading-relaxed">{intervention.responseText}</p>
      )}
      {evidences.length > 0 && (
        <div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-[11px] font-medium text-stone-500 hover:text-stone-700"
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {evidences.length} source{evidences.length === 1 ? '' : 's'}
          </button>
          {expanded && (
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
    </div>
  )
}
