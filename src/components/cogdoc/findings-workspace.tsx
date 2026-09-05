'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, CircleHelp, ExternalLink, FileWarning, Loader2 } from 'lucide-react'
import { api } from '@/lib/api-client'
import { Button } from '@/components/ui/button'

type Finding = {
  id: string
  reviewState: string
  question: { id: string; wording: string }
  revisions: Array<{ id: string; conclusion: string | null; uncertainty: string | null; limitations: string | null; reviews: Array<{ decision: string }> }>
}

function stateCopy(finding: Finding) {
  const decision = finding.revisions[0]?.reviews[0]?.decision
  if (finding.reviewState === 'reviewed' && decision === 'retain_uncertainty') return { label: 'Uncertainty retained', Icon: CircleHelp, className: 'bg-slate-100 text-slate-700' }
  if (finding.reviewState === 'reviewed') return { label: 'Accepted by researcher', Icon: CheckCircle2, className: 'bg-emerald-50 text-emerald-800' }
  if (finding.reviewState === 'review_needed') return { label: 'Review needed', Icon: FileWarning, className: 'bg-amber-50 text-amber-800' }
  return { label: 'Draft finding', Icon: CircleHelp, className: 'bg-violet-50 text-violet-800' }
}

export default function FindingsWorkspace({ projectId, onOpenFinding }: { projectId: string; onOpenFinding: () => void }) {
  const [findings, setFindings] = useState<Finding[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const response = await fetch(`/api/workspaces/${projectId}/findings?scope=all`)
      const body = await response.json().catch(() => ({})) as { findings?: Finding[]; error?: string }
      if (!response.ok) throw new Error(body.error || 'Could not load your findings.')
      setFindings(body.findings ?? [])
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load your findings.') }
    finally { setLoading(false) }
  }, [projectId])

  useEffect(() => { void load() }, [load])

  async function open(finding: Finding) {
    try {
      await api.updateResearchQuestion(projectId, { action: 'select', questionId: finding.question.id })
      onOpenFinding()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not open this finding.') }
  }

  if (loading) return <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600" role="status"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading findings across your questions…</p>
  return <section className="space-y-3" aria-label="All research findings">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-5"><div><h3 className="text-lg font-semibold text-slate-900">Structured findings</h3><p className="mt-1 text-sm text-slate-600">Each finding remains tied to its question, evidence, uncertainty, and explicit review decision.</p></div><Button type="button" variant="outline" size="sm" onClick={() => void load()}>Refresh</Button></div>
    {error ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
    {!findings.length ? <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">No findings yet. Investigate a question, save your explanation, then capture a tentative answer or explicit evidence gap.</p> : findings.map((finding) => {
      const revision = finding.revisions[0]
      const status = stateCopy(finding)
      return <article key={finding.id} className="rounded-xl border border-slate-200 bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.12em] text-violet-700">Addresses: {finding.question.wording}</p><h4 className="mt-2 font-serif text-lg font-semibold text-slate-900">{revision?.conclusion || 'Inconclusive or unfinished finding'}</h4></div><span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${status.className}`}><status.Icon className="h-3.5 w-3.5" />{status.label}</span></div>{revision?.uncertainty ? <p className="mt-3 text-sm leading-6 text-slate-600"><span className="font-medium text-slate-700">Uncertainty:</span> {revision.uncertainty}</p> : null}{revision?.limitations ? <p className="mt-1 text-sm leading-6 text-slate-600"><span className="font-medium text-slate-700">Limitations:</span> {revision.limitations}</p> : null}<Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => void open(finding)}>Open question and finding <ExternalLink className="ml-2 h-3.5 w-3.5" /></Button></article>
    })}
  </section>
}
