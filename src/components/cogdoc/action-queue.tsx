'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, BookOpen, Check, CircleDot, FileUp, Loader2, MapPin, RefreshCw, ScanSearch, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import { useCogdoc } from '@/lib/store'
import { api } from '@/lib/api-client'
import type { Intervention, ReviewItem } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import SourcesResults from './sources-results'

const ENGINE_LABELS: Record<Intervention['engineType'], string> = {
  interceptor: 'Spark Gap',
  socratic: 'Socratic Spacer',
  citation: 'Citation Sentinel',
  scaffold: 'Scaffold',
}

function quoteForReviewItem(item: ReviewItem): string | null {
  if (!item.anchorJson) return null
  try {
    const parsed = JSON.parse(item.anchorJson) as { quote?: unknown }
    return typeof parsed.quote === 'string' && parsed.quote.trim() ? parsed.quote.trim() : null
  } catch {
    return null
  }
}

export default function ActionQueue() {
  const workspace = useCogdoc((state) => state.activeProject)
  const activeInterventions = useCogdoc((state) => state.activeInterventions)
  const focusEditorText = useCogdoc((state) => state.focusEditorText)
  const bumpLibrary = useCogdoc((state) => state.bumpLibrary)
  const [items, setItems] = useState<ReviewItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [response, setResponse] = useState('')
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [acting, setActing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [scanStale, setScanStale] = useState(false)
  const [sourceQuery, setSourceQuery] = useState('')
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const uploadInputRef = useRef<HTMLInputElement>(null)
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

  useEffect(() => { void refresh().catch(() => {}) }, [workspace?.id])

  const liveSignals = useMemo(
    () => activeInterventions.filter((item) => item.status === 'active' && item.promptText).slice(-6).reverse(),
    [activeInterventions],
  )
  const openItems = useMemo(
    () => items.filter((item) => !['resolved', 'dismissed'].includes(item.state)),
    [items],
  )
  const selected = items.find((item) => item.id === selectedId) ?? null
  const selectedQuote = selected ? quoteForReviewItem(selected) : null
  const needsEvidenceLink = Boolean(selected && ['claim_needs_evidence', 'evidence_passage_required'].includes(selected.type))
  const needsDocumentRecheck = Boolean(selected && ['citation_missing_reference', 'bibliography_missing', 'quotation_locator_missing'].includes(selected.type))

  useEffect(() => {
    setCandidates(null)
    if (!selected?.claimId || !needsEvidenceLink) return
    api.getEvidenceCandidates(selected.claimId).then(setCandidates).catch(() => setCandidates({ passages: [], code: [] }))
  }, [selected?.claimId, needsEvidenceLink])

  function focusQuote(quote: string | null) {
    if (!quote) return
    setSourceQuery(quote)
    focusEditorText(quote)
  }

  function selectItem(item: ReviewItem) {
    setSelectedId(item.id)
    setResponse('')
    focusQuote(quoteForReviewItem(item))
  }

  async function startReview(scope: 'full' | 'changed_blocks' = 'full') {
    if (!workspace) return
    setScanning(true)
    try {
      const result = await api.startReview(workspace.id, scope)
      setItems(result.reviewRun.items ?? [])
      setScanStale(false)
      setSelectedId(result.reviewRun.items?.find((item) => item.state !== 'resolved')?.id ?? null)
      toast.success('Review ready', { description: String(result.reviewRun.items?.length ?? 0) + ' actions prioritized.' })
    } catch (error) {
      toast.error('Review failed', { description: (error as Error).message })
    } finally {
      setScanning(false)
    }
  }

  async function uploadSource(file: File) {
    if (!workspace) return
    setUploading(true)
    try {
      await api.uploadPdfFile(workspace.id, file)
      bumpLibrary()
      toast.success('Source uploaded', { description: file.name + ' is indexed and ready for citation checks.' })
    } catch (error) {
      toast.error('Upload failed', { description: (error as Error).message })
    } finally {
      setUploading(false)
    }
  }

  async function resolveItem(action: 'resolve' | 'dismiss') {
    if (!selected) return
    setActing(true)
    try {
      await api.respondToReviewItem(selected.id, {
        action,
        responseText: response,
        resolution: action === 'dismiss' ? 'dismissed_by_student' : 'student_revised_or_confirmed',
      })
      setResponse('')
      await refresh()
      toast.success(action === 'dismiss' ? 'Action dismissed' : 'Action recorded')
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
      else toast.warning('Evidence recorded; revise the claim or use stronger support, then recheck.')
    } catch (error) {
      toast.error('Could not link this evidence', { description: (error as Error).message })
    } finally {
      setActing(false)
    }
  }

  if (!workspace) return null

  return (
    <aside className="flex h-full min-h-0 flex-col border-l border-stone-300 bg-[#f8f6f0]" aria-label="Review action queue">
      <header className="border-b border-stone-300 p-4">
        <div className="flex items-center justify-between gap-3">
          <div><h2 className="font-serif text-lg font-semibold">Action queue</h2><p className="mt-0.5 text-[11px] text-stone-500">Click a signal or review item to open its passage.</p></div>
          <Button size="icon" variant="ghost" onClick={() => startReview(items.length ? 'changed_blocks' : 'full')} disabled={scanning} aria-label="Run document review">
            {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : items.length ? <RefreshCw className="h-4 w-4" /> : <ScanSearch className="h-4 w-4" />}
          </Button>
        </div>
        {scanStale && <button onClick={() => startReview('changed_blocks')} className="mt-3 w-full rounded bg-amber-50 px-3 py-2 text-left text-[11px] leading-4 text-amber-800">The draft changed after this scan. Recheck changed work.</button>}
      </header>

      <section className="border-b border-stone-300 bg-white p-4" aria-label="Source tools">
        <div className="flex items-center justify-between"><div><h3 className="text-sm font-semibold text-stone-800">Sources</h3><p className="text-[11px] text-stone-500">Upload evidence or search from a claim.</p></div><BookOpen className="h-4 w-4 text-[#386c5c]" /></div>
        <Button size="sm" variant="outline" onClick={() => uploadInputRef.current?.click()} disabled={uploading} className="mt-3 h-8 w-full border-stone-300 text-xs">
          {uploading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <FileUp className="mr-1.5 h-3.5 w-3.5" />}Upload PDF source
        </Button>
        <input ref={uploadInputRef} type="file" accept="application/pdf" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void uploadSource(file) }} />
        <div className="mt-2 flex gap-2">
          <Input value={sourceQuery} onChange={(event) => setSourceQuery(event.target.value)} placeholder="Claim or research question" className="h-8 text-xs" />
          <Button size="sm" onClick={() => setSourcesOpen(true)} disabled={sourceQuery.trim().length < 10} className="h-8 bg-[#173f35] px-2 hover:bg-[#245548]" aria-label="Find sources"><Search className="h-3.5 w-3.5" /></Button>
        </div>
      </section>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {liveSignals.length > 0 && <section className="border-b border-stone-300" aria-label="Writing signals">
          <div className="px-4 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[#28614f]">Writing signals · {liveSignals.length}</div>
          {liveSignals.map((signal) => <button key={signal.id} onClick={() => focusQuote(signal.promptText)} className="w-full border-l-2 border-[#386c5c] px-3 py-3 text-left hover:bg-[#eef3ef] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#386c5c]">
            <div className="flex items-start gap-2"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#386c5c]" /><div className="min-w-0"><p className="text-xs font-medium text-stone-800">{ENGINE_LABELS[signal.engineType]}</p><p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-stone-500">{signal.responseText ?? signal.promptText}</p><span className="mt-1 block text-[10px] text-[#28614f]">Open underlined passage</span></div></div>
          </button>)}
        </section>}

        {loading ? <div className="space-y-2 p-4">{[0, 1, 2].map((key) => <div key={key} className="h-16 animate-pulse rounded bg-stone-200" />)}</div> : openItems.length === 0 ? <div className="p-6 text-center"><ScanSearch className="mx-auto h-7 w-7 text-[#386c5c]" /><p className="mt-4 text-sm font-medium">Ready when the draft is</p><p className="mt-2 text-xs leading-5 text-stone-500">Run one scan to create calm, prioritized review actions.</p><Button size="sm" onClick={() => startReview()} disabled={scanning} className="mt-5 bg-[#173f35] hover:bg-[#245548]">Review document</Button></div> : <section>
          <div className="px-4 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-amber-700">Review actions · {openItems.length}</div>
          {openItems.map((item) => {
            const quote = quoteForReviewItem(item)
            const selectedClass = selectedId === item.id ? 'border-[#386c5c] bg-[#eef3ef]' : item.blocksCertification ? 'border-rose-400 hover:bg-stone-50' : 'border-amber-400 hover:bg-stone-50'
            return <button key={item.id} onClick={() => selectItem(item)} className={'w-full border-l-2 px-3 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#386c5c] ' + selectedClass}>
              <div className="flex items-start gap-2"><CircleDot className={'mt-0.5 h-3.5 w-3.5 shrink-0 ' + (item.blocksCertification ? 'text-rose-600' : 'text-amber-600')} /><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><p className="text-xs font-medium leading-5 text-stone-800">{item.title}</p>{quote && <MapPin className="mt-1 h-3.5 w-3.5 shrink-0 text-[#386c5c]" />}</div><p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-stone-500">{item.detail}</p>{quote && <span className="mt-1 block text-[10px] text-[#28614f]">Open in draft</span>}</div></div>
            </button>
          })}
        </section>}
      </div>

      {selected && !['resolved', 'dismissed'].includes(selected.state) && <footer className="max-h-[48vh] overflow-y-auto border-t border-stone-300 bg-white p-4">
        <div className="flex items-start justify-between gap-3"><div><span className={'font-mono text-[9px] uppercase tracking-[0.15em] ' + (selected.blocksCertification ? 'text-rose-700' : 'text-amber-700')}>{selected.blocksCertification ? 'Blocks verification' : 'Advisory'}</span><h3 className="mt-1 text-sm font-semibold">{selected.title}</h3></div><button onClick={() => setSelectedId(null)} aria-label="Close action"><X className="h-4 w-4 text-stone-400" /></button></div>
        <p className="mt-2 text-xs leading-5 text-stone-500">{selected.detail}</p>
        {selectedQuote && <Button size="sm" variant="outline" onClick={() => focusQuote(selectedQuote)} className="mt-3 h-8 border-[#386c5c] text-xs text-[#28614f]"><MapPin className="mr-1.5 h-3.5 w-3.5" />Locate in draft</Button>}
        {needsEvidenceLink && <div className="mt-3 space-y-2">
          {!candidates && <div className="flex items-center gap-2 py-3 text-xs text-stone-500"><Loader2 className="h-3 w-3 animate-spin" />Finding candidate evidence…</div>}
          {candidates?.passages.map((passage) => <button key={passage.chunkId} onClick={() => confirmEvidence({ pdfChunkId: passage.chunkId, confidence: passage.similarityScore })} disabled={acting} className="block w-full rounded border border-stone-200 p-2 text-left hover:border-[#386c5c]"><span className="text-[10px] font-medium text-[#28614f]">{passage.pdfFilename} · page ~{passage.pageApprox}</span><span className="mt-1 line-clamp-3 block text-[11px] leading-4 text-stone-500">{passage.content}</span></button>)}
          {candidates?.code.map((file) => <button key={file.codeFileId + ':' + file.startLine} onClick={() => confirmEvidence({ codeFileId: file.codeFileId, startLine: file.startLine, endLine: file.endLine, confidence: file.score })} disabled={acting} className="block w-full rounded border border-stone-200 p-2 text-left hover:border-[#386c5c]"><span className="text-[10px] font-medium text-sky-700">{file.path}:{file.startLine}–{file.endLine}</span><span className="mt-1 line-clamp-3 block whitespace-pre-wrap font-mono text-[10px] leading-4 text-stone-500">{file.excerpt}</span></button>)}
          {candidates && !candidates.passages.length && !candidates.code.length && <p className="rounded bg-amber-50 p-2 text-[11px] leading-4 text-amber-800">No candidate passage was found. Upload a source or use Find sources, then run the review again.</p>}
        </div>}
        {!needsEvidenceLink && !needsDocumentRecheck && <Textarea value={response} onChange={(event) => setResponse(event.target.value)} rows={3} className="mt-3 resize-none text-xs" placeholder="Optional note about what you changed or confirmed…" />}
        <div className="mt-3 flex gap-2">
          {needsDocumentRecheck ? <Button size="sm" onClick={() => startReview('changed_blocks')} disabled={acting || scanning} className="flex-1 bg-[#173f35] hover:bg-[#245548]"><RefreshCw className="mr-1 h-3 w-3" />Recheck after editing</Button> : !needsEvidenceLink && <Button size="sm" onClick={() => resolveItem('resolve')} disabled={acting} className="flex-1 bg-[#173f35] hover:bg-[#245548]">{acting ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Check className="mr-1 h-3 w-3" />}Record action</Button>}
          <Button size="sm" variant="ghost" onClick={() => resolveItem('dismiss')} disabled={acting} title={selected.blocksCertification ? 'Keeps this item unresolved' : 'Dismiss advisory'}><AlertTriangle className="h-3.5 w-3.5" /></Button>
        </div>
      </footer>}

      <SourcesResults open={sourcesOpen} onOpenChange={setSourcesOpen} claim={sourceQuery} />
    </aside>
  )
}
