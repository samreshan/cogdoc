'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, History, Loader2, MessageCircleQuestion, RefreshCw, UserRound } from 'lucide-react'
import { api } from '@/lib/api-client'
import { plainResearchQuestion } from '@/lib/intervention-language'
import type { ResearchHistoryEvent, ResearchHistorySnapshot } from '@/lib/types'
import { Button } from '@/components/ui/button'

type HistoryFilter = 'decisions' | 'interventions'

export default function ResearchHistory({ projectId, initialFilter }: { projectId: string; initialFilter: HistoryFilter }) {
  const [filter, setFilter] = useState<HistoryFilter>(initialFilter)
  const [data, setData] = useState<ResearchHistorySnapshot | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { setFilter(initialFilter) }, [initialFilter])

  async function load() {
    setLoading(true)
    try { setData(await api.getResearchHistory(projectId)); setError('') }
    catch (reason) { setError((reason as Error).message) }
    finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [projectId])

  return <div className="h-full overflow-y-auto bg-[#f7f4ed] px-5 py-6 sm:px-8 sm:py-8">
    <div className="mx-auto max-w-4xl">
      <header className="flex items-start justify-between gap-4">
        <div><p className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#426458]">Project history</p><h2 className="mt-1 font-serif text-2xl font-semibold">Decisions and interventions</h2><p className="mt-2 max-w-xl text-xs leading-5 text-stone-500">A chronological record of what you chose and how Cogdoc intervened. History records are append-only.</p></div>
        <Button variant="ghost" size="icon" onClick={() => void load()} disabled={loading} aria-label="Refresh project history"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin motion-reduce:animate-none' : ''}`} /></Button>
      </header>

      {data && <div className={`mt-5 flex items-center gap-2 border px-3 py-2 text-[10px] ${data.integrity === 'verified' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : data.integrity === 'legacy_unsealed' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-rose-200 bg-rose-50 text-rose-800'}`} role="status">
        {data.integrity === 'verified' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
        {data.integrity === 'verified' ? 'Audit chain verified.' : data.integrity === 'legacy_unsealed' ? `${data.legacyEventCount} older record${data.legacyEventCount === 1 ? ' is' : 's are'} visible but predate audit sealing.` : 'The audit chain needs verification.'}
      </div>}

      <div className="mt-5 grid grid-cols-2 border border-[#d8d2c6] bg-[#ece8df] p-1" role="tablist" aria-label="History view">
        <button role="tab" aria-selected={filter === 'decisions'} onClick={() => setFilter('decisions')} className={`px-3 py-2 text-xs font-medium ${filter === 'decisions' ? 'bg-[#fffdf8] text-[#28594a]' : 'text-stone-500 hover:text-stone-800'}`}>Decision history <span className="ml-1 font-mono text-[10px]">{data?.events.filter((item) => item.actor === 'student').length ?? 0}</span></button>
        <button role="tab" aria-selected={filter === 'interventions'} onClick={() => setFilter('interventions')} className={`px-3 py-2 text-xs font-medium ${filter === 'interventions' ? 'bg-[#fffdf8] text-[#28594a]' : 'text-stone-500 hover:text-stone-800'}`}>Intervention history <span className="ml-1 font-mono text-[10px]">{data?.interventions.length ?? 0}</span></button>
      </div>

      {loading && !data ? <State icon={Loader2} title="Loading project history" detail="Reading sealed decisions and intervention records…" spinning /> : error ? <State icon={AlertTriangle} title="History unavailable" detail={error} /> : filter === 'decisions' ? <DecisionList events={data?.events.filter((item) => item.actor === 'student') ?? []} /> : <InterventionList data={data} />}
    </div>
  </div>
}

function DecisionList({ events }: { events: ResearchHistoryEvent[] }) {
  if (!events.length) return <State icon={UserRound} title="No decisions recorded yet" detail="Project choices will appear here as you work." />
  return <ol className="mt-5 divide-y divide-[#ded9cf] border-y border-[#d8d2c6]">{events.map((event) => <li key={event.id} className="grid gap-2 bg-[#fffdf8]/55 px-4 py-4 sm:grid-cols-[8.5rem_minmax(0,1fr)]">
    <time className="font-mono text-[9px] leading-4 text-stone-500" dateTime={event.createdAt}>{formatDate(event.createdAt)}</time>
    <div className="min-w-0"><div className="flex items-center gap-2"><UserRound className="h-3.5 w-3.5 shrink-0 text-[#426458]" /><p className="text-xs font-semibold text-stone-800">{eventSummary(event)}</p>{!event.sealed && <span className="font-mono text-[8px] uppercase text-amber-700">legacy</span>}</div><p className="mt-1 font-mono text-[9px] uppercase tracking-[.08em] text-stone-400">{humanize(event.type)}</p>{eventDetail(event) && <p className="mt-2 text-[11px] leading-5 text-stone-600">{eventDetail(event)}</p>}</div>
  </li>)}</ol>
}

function InterventionList({ data }: { data: ResearchHistorySnapshot | null }) {
  if (!data?.interventions.length) return <State icon={MessageCircleQuestion} title="No interventions yet" detail="Questions raised while you write will remain visible here after they are resolved." />
  return <ol className="mt-5 divide-y divide-[#ded9cf] border-y border-[#d8d2c6]">{data.interventions.map((item) => <li key={item.id} className="grid gap-2 bg-[#fffdf8]/55 px-4 py-4 sm:grid-cols-[8.5rem_minmax(0,1fr)]">
    <time className="font-mono text-[9px] leading-4 text-stone-500" dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
    <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><MessageCircleQuestion className="h-3.5 w-3.5 text-[#8a552d]" /><span className="font-mono text-[9px] uppercase tracking-[.1em] text-[#8a552d]">{item.engineType}</span><span className={`px-1.5 py-0.5 font-mono text-[8px] uppercase ${item.status === 'resolved' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{item.status}</span>{item.userAction && <span className="text-[9px] text-stone-500">{item.userAction}</span>}</div><p className="mt-2 text-sm font-medium leading-6 text-stone-800">{plainResearchQuestion(item.responseText, item.engineType, item.promptText ?? item.id)}</p>{item.promptText && <blockquote className="mt-2 line-clamp-3 border-l-2 border-[#c8ad7f] pl-3 font-serif text-[11px] italic leading-5 text-stone-500">{item.promptText}</blockquote>}<p className="mt-2 text-[9px] text-stone-400">{item.evidenceCount} linked passage{item.evidenceCount === 1 ? '' : 's'}{item.resolvedAt ? ` · resolved ${formatDate(item.resolvedAt)}` : ''}</p></div>
  </li>)}</ol>
}

function eventSummary(event: ResearchHistoryEvent): string {
  return typeof event.payload.summary === 'string' && event.payload.summary.trim() ? event.payload.summary : humanize(event.type)
}

function eventDetail(event: ResearchHistoryEvent): string {
  const detail = event.payload.detail
  if (!detail || typeof detail !== 'object' || Array.isArray(detail)) return ''
  return Object.entries(detail).slice(0, 4).map(([key, value]) => `${humanize(key)}: ${String(value)}`).join(' · ')
}

function humanize(value: string) { return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) }
function formatDate(value: string) { return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) }
function State({ icon: Icon, title, detail, spinning }: { icon: typeof History; title: string; detail: string; spinning?: boolean }) { return <div className="px-5 py-14 text-center"><Icon className={`mx-auto h-6 w-6 text-[#527d6e] ${spinning ? 'animate-spin motion-reduce:animate-none' : ''}`} /><p className="mt-4 text-sm font-semibold">{title}</p><p className="mt-2 text-[11px] leading-5 text-stone-500">{detail}</p></div> }
