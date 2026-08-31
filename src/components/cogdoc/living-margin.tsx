'use client'

import { useCogdoc } from '@/lib/store'
import { api } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Sparkles, ShieldCheck, ListTree, BookOpen, X, Check, Quote, ExternalLink, Inbox } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import type { Intervention, EngineType, Verdict } from '@/lib/types'

const ENGINE_META: Record<EngineType, { label: string; icon: typeof Sparkles; color: string; bg: string; border: string }> = {
  interceptor: { label: 'Interceptor', icon: Sparkles, color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  socratic:    { label: 'Socratic Spacer', icon: BookOpen, color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200' },
  citation:    { label: 'Citation Sentinel', icon: ShieldCheck, color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  scaffold:    { label: 'Scaffold', icon: ListTree, color: 'text-sky-700', bg: 'bg-sky-50', border: 'border-sky-200' },
}

const VERDICT_META: Record<Verdict, { label: string; color: string; bg: string }> = {
  supported:              { label: 'Supported',            color: 'text-emerald-700', bg: 'bg-emerald-100' },
  partially_supported:    { label: 'Partially Supported',  color: 'text-amber-700',   bg: 'bg-amber-100' },
  unsupported:            { label: 'Unsupported',          color: 'text-rose-700',    bg: 'bg-rose-100' },
  insufficient_evidence:  { label: 'Insufficient Evidence',color: 'text-stone-700',   bg: 'bg-stone-100' },
}

export default function LivingMargin() {
  const interventions = useCogdoc((s) => s.activeInterventions)
  const updateIntervention = useCogdoc((s) => s.updateIntervention)
  const removeIntervention = useCogdoc((s) => s.removeIntervention)
  const bumpAnalytics = useCogdoc((s) => s.bumpAnalytics)
  const [evidenceDialog, setEvidenceDialog] = useState<Intervention | null>(null)

  async function handleAction(i: Intervention, action: 'engaged' | 'dismissed') {
    try {
      const res = await api.patchIntervention(i.id, {
        userAction: action,
        status: 'resolved',
      })
      updateIntervention(i.id, { userAction: action, status: 'resolved' })
      bumpAnalytics()
      // Fade out then remove from active list
      setTimeout(() => removeIntervention(i.id), 600)
      if (action === 'engaged') {
        toast.success('Engaged', { description: 'Glad it helped your thinking.' })
      } else {
        toast('Dismissed', { description: 'You will not be bothered again.' })
      }
    } catch (e) {
      toast.error('Failed to update intervention', { description: (e as Error).message })
    }
  }

  if (interventions.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-6 py-12">
        <div className="w-14 h-14 rounded-full bg-stone-100 flex items-center justify-center mb-4">
          <Inbox className="w-7 h-7 text-stone-400" />
        </div>
        <h3 className="text-sm font-medium text-stone-700 mb-1">The margin is quiet</h3>
        <p className="text-xs text-stone-500 max-w-xs">
          AI interventions will appear here as you write. Try asking a delegative prompt below, selecting text and clicking &ldquo;Verify Claim&rdquo;, or just stop typing for 45 seconds.
        </p>
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-3">
        {interventions.map((i) => {
          const meta = ENGINE_META[i.engineType]
          const Icon = meta.icon
          const verdict = i.verdict ? VERDICT_META[i.verdict] : null
          return (
            <Card
              key={i.id}
              className={`border ${meta.border} ${meta.bg} shadow-sm`}
            >
              <CardHeader className="pb-2 pt-3 px-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${meta.color}`} />
                    <CardTitle className={`text-sm font-medium ${meta.color}`}>
                      {meta.label}
                    </CardTitle>
                    {verdict && (
                      <Badge variant="secondary" className={`${verdict.bg} ${verdict.color} text-[10px] py-0 px-1.5 h-5`}>
                        {verdict.label}
                      </Badge>
                    )}
                  </div>
                  <button
                    onClick={() => handleAction(i, 'dismissed')}
                    className="text-stone-400 hover:text-stone-700"
                    aria-label="Dismiss"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-3 pt-1 space-y-2">
                {/* Prompt that triggered it (if any) */}
                {i.promptText && i.engineType !== 'socratic' && (
                  <p className="text-xs text-stone-500 italic line-clamp-2">
                    &ldquo;{i.promptText.slice(0, 120)}{i.promptText.length > 120 ? '...' : ''}&rdquo;
                  </p>
                )}

                {/* Main response content */}
                {i.engineType === 'citation' ? (
                  <div className="space-y-2">
                    {i.responseText && (
                      <p className="text-sm text-stone-800 leading-relaxed">{i.responseText}</p>
                    )}
                    {i.evidences && i.evidences.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[11px] font-medium text-stone-500 uppercase tracking-wide">
                          Cited evidence ({i.evidences.length})
                        </p>
                        {i.evidences.slice(0, 3).map((e) => (
                          <button
                            key={e.id}
                            onClick={() => setEvidenceDialog(i)}
                            className="block w-full text-left p-2 rounded bg-white/70 hover:bg-white border border-stone-200 transition-colors"
                          >
                            <div className="flex items-center gap-1.5 text-[10px] text-stone-500 mb-1">
                              <Quote className="w-3 h-3" />
                              <span className="truncate">{e.chunk.pdf.filename}</span>
                              <span>· p.{e.chunk.pageApprox}</span>
                              <span className="ml-auto text-emerald-600">
                                {(e.similarityScore * 100).toFixed(0)}% match
                              </span>
                            </div>
                            <p className="text-xs text-stone-700 line-clamp-2">{e.citedExcerpt}</p>
                          </button>
                        ))}
                        {i.evidences.length > 3 && (
                          <button
                            onClick={() => setEvidenceDialog(i)}
                            className="text-[11px] text-stone-500 hover:text-stone-700 flex items-center gap-1"
                          >
                            <ExternalLink className="w-3 h-3" />
                            View all {i.evidences.length} sources
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-stone-800 leading-relaxed whitespace-pre-wrap">
                    {i.responseText}
                  </p>
                )}

                {/* Action buttons */}
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAction(i, 'engaged')}
                    className="h-7 text-xs border-stone-300 hover:bg-stone-100"
                  >
                    <Check className="w-3 h-3 mr-1" />
                    Engage
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleAction(i, 'dismissed')}
                    className="h-7 text-xs text-stone-500 hover:text-stone-700"
                  >
                    Dismiss
                  </Button>
                  <span className="ml-auto text-[10px] text-stone-400">
                    {new Date(i.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Evidence detail dialog */}
      <Dialog open={!!evidenceDialog} onOpenChange={(o) => !o && setEvidenceDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-700" />
              Citation Sentinel: full evidence
            </DialogTitle>
            <DialogDescription>Inspect the saved source passages used to evaluate this citation.</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-2">
            <div className="space-y-3">
              {evidenceDialog?.evidences?.map((e) => (
                <div key={e.id} className="border border-stone-200 rounded-lg p-3 bg-stone-50">
                  <div className="flex items-center justify-between text-xs text-stone-500 mb-2">
                    <span className="font-medium">{e.chunk.pdf.filename}</span>
                    <span>Page {e.chunk.pageApprox} · {(e.similarityScore * 100).toFixed(0)}% match</span>
                  </div>
                  <p className="text-sm text-stone-800 leading-relaxed whitespace-pre-wrap">
                    {e.citedExcerpt}
                  </p>
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </ScrollArea>
  )
}
