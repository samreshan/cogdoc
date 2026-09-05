'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowRight, BookOpen, Check, FileSearch, FileUp, Globe2, Library, Link2, Loader2, Quote, Search, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { useCogdoc } from '@/lib/store'
import type { Project, ResearchWorkspaceSnapshot, SourceMapPassage, SourceMapResult } from '@/lib/types'
import { structuredCitationForReference } from '@/lib/citation-insertion'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import SourcesResults from './sources-results'

interface Props { project: Project; data: ResearchWorkspaceSnapshot | null; onRefresh: () => void }

export default function SourceMapper({ project, data, onRefresh }: Props) {
  const storedQuery = useCogdoc((state) => state.sourceMapperQuery)
  const setStoredQuery = useCogdoc((state) => state.setSourceMapperQuery)
  const openIdeTab = useCogdoc((state) => state.openIdeTab)
  const selectResearchEntity = useCogdoc((state) => state.selectResearchEntity)
  const requestCitationInsertion = useCogdoc((state) => state.requestCitationInsertion)
  const bumpLibrary = useCogdoc((state) => state.bumpLibrary)
  const [question, setQuestion] = useState(storedQuery)
  const [result, setResult] = useState<SourceMapResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [webOpen, setWebOpen] = useState(false)
  const uploadRef = useRef<HTMLInputElement>(null)
  const lastAutoQuery = useRef('')

  async function ask(query = question) {
    const prompt = query.trim()
    if (prompt.length < 5) return
    setQuestion(prompt)
    lastAutoQuery.current = prompt
    setStoredQuery(prompt)
    setLoading(true)
    setError('')
    try { setResult(await api.mapSources(project.id, prompt)) }
    catch (reason) { setError((reason as Error).message) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    if (!storedQuery || storedQuery === lastAutoQuery.current) return
    lastAutoQuery.current = storedQuery
    setQuestion(storedQuery)
    void ask(storedQuery)
  // The store value is the explicit handoff from a selected passage or intervention.
  }, [storedQuery])

  async function upload(file: File) {
    setUploading(true)
    try {
      const response = await api.uploadPdfFile(project.id, file) as { vectorIngest?: string }
      bumpLibrary(); onRefresh()
      toast.success('Source indexed', { description: `${file.name} is chunked and ${response.vectorIngest === 'ok' ? 'embedded' : 'ready for exact retrieval'}.` })
    } catch (reason) { toast.error('Could not ingest source', { description: (reason as Error).message }) }
    finally { setUploading(false); if (uploadRef.current) uploadRef.current.value = '' }
  }

  function openPassage(passage: SourceMapPassage) {
    if (!passage.workspaceSourceId) return
    openIdeTab({ id: `source:${passage.workspaceSourceId}`, kind: 'source', label: passage.sourceTitle, entityId: passage.workspaceSourceId, closable: true })
    selectResearchEntity('source', passage.workspaceSourceId, passage.chunkId)
  }

  function cite(passage: SourceMapPassage) {
    const reference = data?.references.find((item) => item.id === passage.referenceId)
    if (!reference) { toast('No reference metadata is linked to this full text yet.'); return }
    const citation = structuredCitationForReference(reference)
    if (!citation) { toast('Verify this reference in the References tab before citing it.'); return }
    requestCitationInsertion(citation)
    openIdeTab({ id: 'document', kind: 'document', label: 'Draft', closable: false })
  }

  const cited = new Set(result?.answer?.passageIds ?? [])
  return <main className="flex h-full min-h-0 flex-col bg-[#f7f4ed]" aria-label="Source mapper">
    <header className="border-b border-[#d8d2c6] bg-[#faf8f2] px-5 pb-5 pt-6 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-start justify-between gap-4">
          <div><p className="font-mono text-[9px] uppercase tracking-[.19em] text-[#426458]">Source mapper</p><h2 className="mt-1 font-serif text-2xl font-semibold tracking-[-.02em] text-stone-900">Ask your research, not a blank chatbot.</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-stone-500">Cogdoc searches indexed passages first, keeps every answer linked to evidence, and offers scholarly web discovery only when your library falls short.</p></div>
          <div className="hidden shrink-0 text-right sm:block"><p className="font-mono text-lg tabular-nums text-[#386c5c]">{data?.sources.length ?? 0}</p><p className="text-[9px] text-stone-500">project sources</p></div>
        </div>
        <div className="mt-5 flex items-end gap-2 border-y border-[#cfc8bb] bg-[#fffdf8] p-2">
          <Textarea value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void ask() } }} rows={2} placeholder="What does my evidence say about…" aria-label="Question for indexed sources" className="min-h-14 flex-1 resize-none border-0 bg-transparent font-serif text-base leading-6 shadow-none focus-visible:ring-0" />
          <Button onClick={() => void ask()} disabled={loading || question.trim().length < 5} className="h-10 shrink-0 bg-[#173f35] px-4 hover:bg-[#245548]">{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Search className="mr-2 h-4 w-4" />}Map sources</Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input ref={uploadRef} type="file" accept="application/pdf" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file) }} />
          <button onClick={() => uploadRef.current?.click()} disabled={uploading} className="flex items-center gap-1.5 text-[10px] font-medium text-stone-600 hover:text-[#28594a] disabled:opacity-50">{uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileUp className="h-3 w-3" />}Ingest PDF</button>
          <span className="text-stone-300">·</span>
          <button onClick={() => openIdeTab({ id: 'references', kind: 'references', label: 'References', closable: true })} className="flex items-center gap-1.5 text-[10px] font-medium text-stone-600 hover:text-[#28594a]"><Library className="h-3 w-3" />Manage sources and references</button>
        </div>
      </div>
    </header>

    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8">
      <div className="mx-auto max-w-4xl">
        {error && <div role="alert" className="border-l-2 border-rose-600 bg-rose-50 px-4 py-3 text-xs text-rose-800">{error}</div>}
        {!result && !loading && !error && <EmptyMapper hasSources={Boolean(data?.sources.length)} onUpload={() => uploadRef.current?.click()} />}
        {loading && <div className="space-y-3" aria-label="Searching indexed sources"><div className="h-24 animate-pulse bg-[#ece8df] motion-reduce:animate-none" /><div className="h-28 animate-pulse bg-[#efebe3] motion-reduce:animate-none" /><div className="h-28 animate-pulse bg-[#efebe3] motion-reduce:animate-none" /></div>}
        {result && !loading && <>
          <section className="border-b border-[#cfc8bb] pb-6" aria-label="Grounded answer">
            <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-[#386c5c]" /><h3 className="text-xs font-semibold text-stone-800">Grounded research note</h3>{result.answer && <span className="ml-auto font-mono text-[9px] uppercase text-stone-500">{result.answer.confidence} confidence</span>}</div>
            {result.answer ? <><p className="mt-3 max-w-3xl font-serif text-[17px] leading-7 text-stone-700">{result.answer.answer}</p><div className="mt-3 flex flex-wrap gap-1.5">{result.answer.passageIds.map((id, index) => { const passage = result.passages.find((item) => item.chunkId === id); return passage ? <button key={id} onClick={() => openPassage(passage)} className="border border-[#b9c9c2] bg-[#edf2ee] px-2 py-1 font-mono text-[9px] text-[#28594a] hover:bg-[#e3ebe6]">[{index + 1}] {passage.sourceTitle} · p.{passage.pageApprox}</button> : null })}</div>{result.answer.followUpQuestion && <button onClick={() => { setQuestion(result.answer!.followUpQuestion!); void ask(result.answer!.followUpQuestion!) }} className="mt-4 flex items-center gap-1 text-left text-[11px] font-medium text-[#386c5c] hover:underline">Ask next: {result.answer.followUpQuestion}<ArrowRight className="h-3 w-3" /></button>}</> : <p className="mt-3 text-xs leading-5 text-stone-600">{result.answerError ?? 'No grounded answer could be formed from the indexed material.'}</p>}
            <p className="mt-3 text-[10px] leading-4 text-stone-500">This answer is a map back to the evidence. Read the matched passages, then decide what they mean for your argument.</p>
          </section>

          {(result.needsWebSearch || result.passages.length === 0) && <section className="my-5 flex flex-col gap-3 border-l-2 border-[#a77745] bg-[#f3ecdf] px-4 py-3 sm:flex-row sm:items-center"><Globe2 className="h-5 w-5 shrink-0 text-[#8a552d]" /><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-stone-800">Your indexed library may not be enough</p><p className="mt-0.5 text-[10px] leading-4 text-stone-600">Search scholarly registries and grounded web results, then save metadata or ingest a legal full-text copy.</p></div><Button onClick={() => setWebOpen(true)} variant="outline" size="sm" className="h-8 shrink-0 border-[#c5a984] bg-[#fffaf1] text-[10px]"><Globe2 className="mr-1.5 h-3 w-3" />Search scholarly web</Button></section>}

          <section className="pt-2" aria-label="Matching source passages">
            <div className="flex items-baseline justify-between"><h3 className="font-serif text-lg font-semibold">Matching passages</h3><p className="font-mono text-[9px] uppercase text-stone-500">{result.retrieval.join(' + ') || 'no local match'} retrieval</p></div>
            <div className="mt-3 divide-y divide-[#d8d2c6] border-y border-[#d8d2c6]">{result.passages.map((passage, index) => {
              const reference = data?.references.find((item) => item.id === passage.referenceId)
              const verified = Boolean(reference && ['matched', 'confirmed'].includes(reference.metadataStatus))
              return <article key={passage.chunkId} className={`grid gap-3 py-4 sm:grid-cols-[2.25rem_minmax(0,1fr)_auto] ${cited.has(passage.chunkId) ? 'bg-[#f2f5f2]' : ''}`}>
                <span className="font-mono text-[10px] tabular-nums text-[#527d6e]">{String(index + 1).padStart(2, '0')}</span>
                <button onClick={() => openPassage(passage)} disabled={!passage.workspaceSourceId} className="min-w-0 text-left disabled:cursor-default"><div className="flex flex-wrap items-center gap-2"><span className="truncate text-[11px] font-semibold text-stone-800">{passage.sourceTitle}</span><span className="font-mono text-[8px] uppercase text-[#527d6e]">{passage.matchType}</span><span className="font-mono text-[8px] text-stone-400">p.{passage.pageApprox} · {Math.round(passage.similarityScore * 100)}%</span></div><p className="mt-1.5 line-clamp-4 font-serif text-sm leading-6 text-stone-600">{passage.content}</p></button>
                <div className="flex items-start gap-1"><Button variant="ghost" size="sm" onClick={() => openPassage(passage)} disabled={!passage.workspaceSourceId} className="h-7 px-2 text-[9px]"><BookOpen className="mr-1 h-3 w-3" />Open</Button><Button variant="ghost" size="sm" onClick={() => cite(passage)} className={`h-7 px-2 text-[9px] ${verified ? 'text-[#28594a]' : 'text-stone-400'}`} title={verified ? 'Insert verified citation at saved cursor' : 'Verify metadata in References before citing'}><Quote className="mr-1 h-3 w-3" />Cite</Button></div>
              </article>
            })}{result.passages.length === 0 && <div className="py-10 text-center"><FileSearch className="mx-auto h-6 w-6 text-stone-300" /><p className="mt-3 text-xs text-stone-600">No relevant passage was found in your indexed sources.</p></div>}</div>
          </section>
        </>}
      </div>
    </div>
    <SourcesResults open={webOpen} onOpenChange={setWebOpen} claim={question} />
  </main>
}

function EmptyMapper({ hasSources, onUpload }: { hasSources: boolean; onUpload: () => void }) {
  return <div className="grid gap-8 py-8 sm:grid-cols-[minmax(0,1fr)_15rem]"><div><FileSearch className="h-7 w-7 text-[#527d6e]" /><h3 className="mt-4 font-serif text-xl font-semibold">{hasSources ? 'Start with a research question.' : 'Build a searchable evidence base.'}</h3><p className="mt-2 max-w-lg text-xs leading-5 text-stone-500">{hasSources ? 'Ask about a concept, disagreement, method, result, or gap. Cogdoc returns the passages it used so you can inspect the evidence yourself.' : 'Upload a PDF or paste source text. Cogdoc chunks it into passages and prepares exact and semantic retrieval.'}</p>{!hasSources && <Button onClick={onUpload} size="sm" className="mt-4 bg-[#173f35] hover:bg-[#245548]"><FileUp className="mr-1.5 h-3.5 w-3.5" />Ingest your first PDF</Button>}</div><ol className="border-l border-[#cfc8bb] pl-5 text-[10px] leading-5 text-stone-500"><li className="flex gap-2"><Check className="mt-1 h-3 w-3 shrink-0 text-[#527d6e]" />Local passages searched first</li><li className="mt-2 flex gap-2"><Link2 className="mt-1 h-3 w-3 shrink-0 text-[#527d6e]" />Every answer retains passage links</li><li className="mt-2 flex gap-2"><Globe2 className="mt-1 h-3 w-3 shrink-0 text-[#527d6e]" />Web discovery is explicit</li></ol></div>
}
