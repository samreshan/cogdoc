'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, ChevronDown, ChevronUp, CircleDot, Loader2, RefreshCw, ScanSearch, X } from 'lucide-react'
import { toast } from 'sonner'
import { useCogdoc } from '@/lib/store'
import { api } from '@/lib/api-client'
import type { ReviewItem } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

export default function ActionQueue() {
  const workspace = useCogdoc((state) => state.activeProject)
  const [items, setItems] = useState<ReviewItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [response, setResponse] = useState('')
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [acting, setActing] = useState(false)
  const [showAllCritical, setShowAllCritical] = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)
  const [scanStale, setScanStale] = useState(false)
  const [candidates, setCandidates] = useState<{
    passages: Array<{ chunkId: string; content: string; similarityScore: number; pageApprox: number; pdfFilename: string }>
    code: Array<{ codeFileId: string; path: string; language: string | null; startLine: number; endLine: number; excerpt: string; score: number }>
  } | null>(null)

  async function refresh() {
    if (!workspace) return
    try {
      const result = await api.listReviewItems(workspace.id)
      setItems(result.reviewItems)
      setScanStale(Boolean(result.stale))
      if (!selectedId) setSelectedId(result.reviewItems.find((item) => item.state !== 'resolved')?.id ?? null)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { refresh().catch(() => {}) }, [workspace?.id])

  const critical = useMemo(() => items.filter((item) => item.blocksCertification && item.state !== 'resolved'), [items])
  const advisory = useMemo(() => items.filter((item) => !item.blocksCertification && !['resolved', 'dismissed'].includes(item.state)), [items])
  const completed = useMemo(() => items.filter((item) => item.state === 'resolved' || item.state === 'dismissed'), [items])
  const selected = items.find((item) => item.id === selectedId) ?? null
  const visibleAdvisory = workspace?.reviewPace === 'rapid' ? [] : advisory
  const needsEvidenceLink = Boolean(selected && ['claim_needs_evidence', 'evidence_passage_required'].includes(selected.type))
  const needsDocumentRecheck = Boolean(selected && ['citation_missing_reference', 'bibliography_missing', 'quotation_locator_missing'].includes(selected.type))

  useEffect(() => {
    setCandidates(null)
    if (!selected?.claimId || !needsEvidenceLink) return
    api.getEvidenceCandidates(selected.claimId).then(setCandidates).catch(() => setCandidates({ passages: [], code: [] }))
  }, [selected?.claimId, needsEvidenceLink])

  async function startReview(scope: 'full' | 'changed_blocks' = 'full') {
    if (!workspace) return
    setScanning(true)
    try {
      const result = await api.startReview(workspace.id, scope)
      setItems(result.reviewRun.items ?? [])
      setScanStale(false)
      setSelectedId(result.reviewRun.items?.find((item) => item.state !== 'resolved')?.id ?? null)
      toast.success('Review ready', { description: `${result.reviewRun.items?.length ?? 0} actions prioritized.` })
    } catch (error) {
      toast.error('Review failed', { description: (error as Error).message })
    } finally {
      setScanning(false)
    }
  }

  async function resolveItem(action: 'resolve' | 'dismiss') {
    if (!selected) return
    setActing(true)
    try {
      await api.respondToReviewItem(selected.id, {
        action,
        responseText: response,
        resolution: action === 'dismiss' ? 'dismissed_by_student' : selected.type === 'comprehension_check' ? 'student_explanation' : 'student_revised_or_confirmed',
      })
      setResponse('')
      await refresh()
      const remaining = items.filter((item) => item.id !== selected.id && item.state !== 'resolved')
      setSelectedId(remaining[0]?.id ?? null)
      toast.success(action === 'dismiss' && selected.blocksCertification ? 'Recorded as unresolved' : 'Action recorded')
    } catch (error) {
      toast.error('Could not record this action', { description: (error as Error).message })
    } finally {
      setActing(false)
    }
  }

  async function confirmEvidence(evidence: Record<string, unknown>) {
    if (!selected?.claimId) return
    setActing(true)
    try {
      const result = await api.linkEvidence(selected.claimId, evidence)
      await refresh()
      if (result.resolved) toast.success('Evidence link confirmed')
      else toast.warning('Link recorded, but support is still insufficient', { description: 'Choose stronger evidence or revise the claim, then recheck.' })
    } catch (error) {
      toast.error('Could not link this evidence', { description: (error as Error).message })
    } finally {
      setActing(false)
    }
  }

  function ItemButton({ item }: { item: ReviewItem }) {
    return <button onClick={() => { setSelectedId(item.id); setResponse('') }} className={`w-full border-l-2 px-3 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#386c5c] ${selectedId === item.id ? 'border-[#386c5c] bg-[#eef3ef]' : item.blocksCertification ? 'border-rose-400 hover:bg-stone-50' : 'border-amber-400 hover:bg-stone-50'}`}><div className="flex items-start gap-2"><CircleDot className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${item.blocksCertification ? 'text-rose-600' : 'text-amber-600'}`} /><div><p className="text-xs font-medium leading-5 text-stone-800">{item.title}</p><p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-stone-500">{item.detail}</p></div></div></button>
  }

  return <aside className="flex h-full min-h-0 flex-col border-l border-stone-300 bg-[#f8f6f0]" aria-label="Review action queue">
    <div className="border-b border-stone-300 p-4"><div className="flex items-center justify-between"><div><h2 className="font-serif text-lg font-semibold">Action queue</h2><p className="mt-0.5 text-[11px] text-stone-500">Critical first. Three at a time.</p></div><Button size="icon" variant="ghost" onClick={() => startReview(items.length ? 'changed_blocks' : 'full')} disabled={scanning} aria-label="Run document review">{scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : items.length ? <RefreshCw className="h-4 w-4" /> : <ScanSearch className="h-4 w-4" />}</Button></div>{scanStale && <button onClick={() => startReview('changed_blocks')} className="mt-3 w-full rounded bg-amber-50 px-3 py-2 text-left text-[11px] leading-4 text-amber-800">The draft changed after this scan. Recheck changed work.</button>}</div>
    <div className="min-h-0 flex-1 overflow-y-auto">
      {loading ? <div className="space-y-2 p-4">{[0, 1, 2].map((key) => <div key={key} className="h-16 animate-pulse rounded bg-stone-200" />)}</div> : items.length === 0 ? <div className="p-6 text-center"><ScanSearch className="mx-auto h-7 w-7 text-[#386c5c]" /><p className="mt-4 text-sm font-medium">Ready when the draft is</p><p className="mt-2 text-xs leading-5 text-stone-500">Run one scan to create a calm, prioritized review instead of filling the page with alerts.</p><Button size="sm" onClick={() => startReview()} disabled={scanning} className="mt-5 bg-[#173f35] hover:bg-[#245548]">Review document</Button></div> : <>
        <div className="border-b border-stone-300"><div className="flex items-center justify-between px-4 py-2"><span className="font-mono text-[10px] uppercase tracking-[0.16em] text-rose-700">Critical · {critical.length}</span>{critical.length > 3 && <button onClick={() => setShowAllCritical((value) => !value)} className="text-[10px] text-stone-500">{showAllCritical ? 'Show less' : 'Show all'}</button>}</div>{critical.slice(0, showAllCritical ? critical.length : 3).map((item) => <ItemButton key={item.id} item={item} />)}</div>
        {visibleAdvisory.length > 0 && <div className="border-b border-stone-300"><div className="px-4 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-amber-700">Improve · {visibleAdvisory.length}</div>{visibleAdvisory.map((item) => <ItemButton key={item.id} item={item} />)}</div>}
        {completed.length > 0 && <div><button onClick={() => setShowCompleted((value) => !value)} className="flex w-full items-center justify-between px-4 py-3 text-left font-mono text-[10px] uppercase tracking-[0.16em] text-[#28614f]">Completed · {completed.length}{showCompleted ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}</button>{showCompleted && completed.map((item) => <div key={item.id} className="flex items-center gap-2 px-4 py-2 text-xs text-stone-500"><Check className="h-3 w-3 text-[#28614f]" />{item.title}</div>)}</div>}
      </>}
    </div>
    {selected && !['resolved', 'dismissed'].includes(selected.state) && <div className="max-h-[48vh] overflow-y-auto border-t border-stone-300 bg-white p-4">
      <div className="flex items-start justify-between gap-3"><div><span className={`font-mono text-[9px] uppercase tracking-[0.15em] ${selected.blocksCertification ? 'text-rose-700' : 'text-amber-700'}`}>{selected.blocksCertification ? 'Blocks verification' : 'Advisory'}</span><h3 className="mt-1 text-sm font-semibold">{selected.title}</h3></div><button onClick={() => setSelectedId(null)} aria-label="Close action"><X className="h-4 w-4 text-stone-400" /></button></div>
      <p className="mt-2 text-xs leading-5 text-stone-500">{selected.detail}</p>
      {needsEvidenceLink && <div className="mt-3 space-y-2">
        {!candidates && <div className="flex items-center gap-2 py-3 text-xs text-stone-500"><Loader2 className="h-3 w-3 animate-spin" />Finding candidate evidence…</div>}
        {candidates?.passages.map((passage) => <button key={passage.chunkId} onClick={() => confirmEvidence({ pdfChunkId: passage.chunkId, confidence: passage.similarityScore })} disabled={acting} className="block w-full rounded border border-stone-200 p-2 text-left hover:border-[#386c5c]"><span className="text-[10px] font-medium text-[#28614f]">{passage.pdfFilename} · page ~{passage.pageApprox}</span><span className="mt-1 line-clamp-3 block text-[11px] leading-4 text-stone-500">{passage.content}</span></button>)}
        {candidates?.code.map((file) => <button key={`${file.codeFileId}:${file.startLine}`} onClick={() => confirmEvidence({ codeFileId: file.codeFileId, startLine: file.startLine, endLine: file.endLine, confidence: file.score })} disabled={acting} className="block w-full rounded border border-stone-200 p-2 text-left hover:border-[#386c5c]"><span className="text-[10px] font-medium text-sky-700">{file.path}:{file.startLine}–{file.endLine}</span><span className="mt-1 line-clamp-3 block whitespace-pre-wrap font-mono text-[10px] leading-4 text-stone-500">{file.excerpt}</span></button>)}
        {candidates && !candidates.passages.length && !candidates.code.length && <p className="rounded bg-amber-50 p-2 text-[11px] leading-4 text-amber-800">No candidate passage was found. Upload the source or code snapshot, then run the review again. You may keep this item explicitly unresolved.</p>}
      </div>}
      {!needsEvidenceLink && !needsDocumentRecheck && <Textarea value={response} onChange={(event) => setResponse(event.target.value)} rows={3} className="mt-3 resize-none text-xs" placeholder={selected.type === 'comprehension_check' ? 'Explain the relationship in your own words…' : selected.type.startsWith('reference_metadata_') ? 'Describe how you checked the original source…' : 'Optional note about what you changed or confirmed…'} />}
      <div className="mt-3 flex gap-2">
        {needsDocumentRecheck ? <Button size="sm" onClick={() => startReview('changed_blocks')} disabled={acting || scanning} className="flex-1 bg-[#173f35] hover:bg-[#245548]"><RefreshCw className="mr-1 h-3 w-3" />Recheck after editing</Button> : !needsEvidenceLink && <Button size="sm" onClick={() => resolveItem('resolve')} disabled={acting || (selected.type === 'comprehension_check' && response.trim().length < 20) || (selected.type.startsWith('reference_metadata_') && response.trim().length < 10)} className="flex-1 bg-[#173f35] hover:bg-[#245548]">{acting ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Check className="mr-1 h-3 w-3" />}Record action</Button>}
        <Button size="sm" variant="ghost" onClick={() => resolveItem('dismiss')} disabled={acting} title={selected.blocksCertification ? 'Keeps this item unresolved' : 'Dismiss advisory'}><AlertTriangle className="h-3.5 w-3.5" /></Button>
      </div>
    </div>}
  </aside>
}
