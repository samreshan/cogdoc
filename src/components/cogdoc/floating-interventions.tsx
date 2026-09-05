'use client'

import { useEffect, useState } from 'react'
import { useCogdoc } from '@/lib/store'
import { api } from '@/lib/api-client'
import {
  Sparkles, ShieldCheck, ListTree, BookOpen, X, Check,
  Quote, ChevronDown, ChevronUp, AlertTriangle,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { EngineType, Intervention, Verdict } from '@/lib/types'
import { interventionQuestion } from '@/lib/intervention-language'

const ENGINE_META: Record<EngineType, {
  label: string; icon: typeof Sparkles; color: string; bg: string; border: string; accent: string
}> = {
  interceptor: {
    label: 'Interceptor', icon: AlertTriangle,
    color: 'text-amber-700', bg: 'bg-amber-50/95', border: 'border-amber-300', accent: 'bg-amber-400',
  },
  socratic: {
    label: 'Socratic', icon: BookOpen,
    color: 'text-rose-700', bg: 'bg-rose-50/95', border: 'border-rose-300', accent: 'bg-rose-400',
  },
  citation: {
    label: 'Citation Sentinel', icon: ShieldCheck,
    color: 'text-emerald-700', bg: 'bg-emerald-50/95', border: 'border-emerald-300', accent: 'bg-emerald-400',
  },
  scaffold: {
    label: 'Scaffold', icon: ListTree,
    color: 'text-sky-700', bg: 'bg-sky-50/95', border: 'border-sky-300', accent: 'bg-sky-400',
  },
}

const VERDICT_META: Record<Verdict, { label: string; color: string; bg: string }> = {
  supported:              { label: 'Supported',            color: 'text-emerald-700', bg: 'bg-emerald-100' },
  partially_supported:    { label: 'Partially Supported',  color: 'text-amber-700',   bg: 'bg-amber-100' },
  unsupported:            { label: 'Unsupported',          color: 'text-rose-700',    bg: 'bg-rose-100' },
  insufficient_evidence:  { label: 'Insufficient Evidence',color: 'text-stone-600',   bg: 'bg-stone-100' },
}

export default function FloatingInterventions() {
  const interventions = useCogdoc((s) => s.positionedInterventions)
  const markFading = useCogdoc((s) => s.markInterventionFading)
  const removeIntervention = useCogdoc((s) => s.removePositionedIntervention)
  const bumpAnalytics = useCogdoc((s) => s.bumpAnalytics)

  async function handleAction(id: string, action: 'engaged' | 'dismissed') {
    markFading(id)
    bumpAnalytics()
    try {
      await api.patchIntervention(id, { userAction: action, status: 'resolved' })
    } catch { /* silent — the UI already updated */ }
    setTimeout(() => removeIntervention(id), 300)
  }

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
      <AnimatePresence>
        {interventions.map((i) => {
          const meta = ENGINE_META[i.engineType] ?? ENGINE_META.socratic
          const Icon = meta.icon
          const verdict = i.verdict ? VERDICT_META[i.verdict] : null
          return (
            <motion.div
              key={i.id}
              initial={{ opacity: 0, x: 30, scale: 0.95 }}
              animate={{ opacity: i.fadingOut ? 0 : 1, x: i.fadingOut ? 30 : 0, scale: 1 }}
              exit={{ opacity: 0, x: 30, scale: 0.95 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className={`absolute pointer-events-auto ${meta.bg} ${meta.border} border-l-4 rounded-lg shadow-lg backdrop-blur-sm overflow-hidden`}
              style={{
                top: i.position.top,
                left: 'calc(50% + 360px)',
                width: '300px',
                maxWidth: 'calc(100vw - 50%)',
              }}
            >
              {/* Connection line to the text */}
              <div
                className={`absolute left-0 top-1/2 -translate-x-full w-6 h-px ${meta.accent} opacity-40`}
              />

              {/* Header */}
              <div className="flex items-center justify-between px-3 py-2 border-b border-stone-200/60">
                <div className="flex items-center gap-1.5">
                  <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
                  <span className={`text-xs font-medium ${meta.color}`}>{meta.label}</span>
                  {verdict && (
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${verdict.bg} ${verdict.color}`}>
                      {verdict.label}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleAction(i.id, 'dismissed')}
                  className="text-stone-400 hover:text-stone-700 transition-colors"
                  aria-label="Dismiss"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Body */}
              <div className="px-3 py-2.5">
                {/* Prompt that triggered it (for non-socratic engines) */}
                {i.promptText && i.engineType !== 'socratic' && (
                  <p className="text-[11px] text-stone-500 italic mb-1.5 line-clamp-2">
                    &ldquo;{i.promptText.slice(0, 120)}{i.promptText.length > 120 ? '…' : ''}&rdquo;
                  </p>
                )}

                {/* Main response */}
                {i.engineType === 'citation' ? (
                  <CitationBody intervention={i} />
                ) : (
                  <p className="text-sm text-stone-800 leading-relaxed whitespace-pre-wrap">
                    {interventionQuestion(i)}
                  </p>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 mt-2.5">
                  <button
                    onClick={() => handleAction(i.id, 'engaged')}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border border-stone-300 bg-white hover:bg-stone-50 text-stone-700 transition-colors"
                  >
                    <Check className="w-3 h-3" /> Engage
                  </button>
                  <button
                    onClick={() => handleAction(i.id, 'dismissed')}
                    className="px-2.5 py-1 text-xs text-stone-400 hover:text-stone-600 transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}

function CitationBody({ intervention }: { intervention: Intervention }) {
  const [expanded, setExpanded] = useState(false)
  const evidences = intervention.evidences ?? []

  return (
    <div className="space-y-2">
      {intervention.responseText && (
        <p className="text-sm text-stone-800 leading-relaxed">{interventionQuestion(intervention)}</p>
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
            <div className="mt-1.5 space-y-1.5 max-h-48 overflow-y-auto">
              {evidences.map((e) => (
                <div key={e.id} className="p-2 rounded bg-white/70 border border-stone-200">
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
