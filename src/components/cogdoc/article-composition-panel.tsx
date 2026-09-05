'use client'

import { useState } from 'react'
import { FilePenLine, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface ArticleCandidate {
  findingRevisionId: string
  label: string
  uncertainty: string | null
  eligible: boolean
  reason?: string | null
  question?: string
}

export function ArticleCompositionPanel({ candidates, onCreate, generatedLabel = 'Generate review-needed draft' }: {
  candidates: ArticleCandidate[]
  onCreate: (input: { path: 'manual_outline' | 'generated_draft'; title: string; audience: string; purpose: string; findingRevisionIds: string[] }) => Promise<void> | void
  generatedLabel?: string
}) {
  const [selected, setSelected] = useState<string[]>([])
  const [title, setTitle] = useState('')
  const [audience, setAudience] = useState('')
  const [purpose, setPurpose] = useState('')
  const [pending, setPending] = useState(false)
  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id])
  async function create(path: 'manual_outline' | 'generated_draft') {
    setPending(true)
    try { await onCreate({ path, title, audience, purpose, findingRevisionIds: selected }) } finally { setPending(false) }
  }
  return <section className="rounded-xl border border-slate-200 bg-[#f7f6f3] p-5 text-slate-900" aria-label="Article composition">
    <p className="text-xs font-semibold uppercase tracking-[.14em] text-violet-700">Optional article</p>
    <h3 className="mt-1 text-lg font-semibold">Write from reviewed findings</h3>
    <p className="mt-1 text-sm text-slate-600">Findings remain your research record. An article is a separate draft and never publishes automatically.</p>
    <div className="mt-4 space-y-2">{candidates.map((candidate) => <label key={candidate.findingRevisionId} className="flex gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm"><input type="checkbox" checked={selected.includes(candidate.findingRevisionId)} disabled={!candidate.eligible || pending} onChange={() => toggle(candidate.findingRevisionId)} /><span><span className="font-medium">{candidate.label}</span>{candidate.question ? <span className="mt-1 block text-xs text-slate-500">{candidate.question}</span> : null}<span className="mt-1 block text-slate-600">{candidate.eligible ? candidate.uncertainty || 'Review the saved uncertainty before writing.' : candidate.reason || 'This finding is not current and reviewed.'}</span></span></label>)}</div>
    <div className="mt-4 grid gap-2"><input className="rounded-md border bg-white px-3 py-2 text-sm" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Article title" /><input className="rounded-md border bg-white px-3 py-2 text-sm" value={audience} onChange={(event) => setAudience(event.target.value)} placeholder="Audience (optional)" /><textarea className="rounded-md border bg-white px-3 py-2 text-sm" value={purpose} onChange={(event) => setPurpose(event.target.value)} placeholder="Purpose (optional)" /></div>
    <div className="mt-4 flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={pending || !selected.length} onClick={() => void create('manual_outline')}><FilePenLine className="mr-2 h-4 w-4" />Create manual outline</Button><Button type="button" disabled={pending || !selected.length} onClick={() => void create('generated_draft')}><Sparkles className="mr-2 h-4 w-4" />{generatedLabel}</Button></div>
  </section>
}
