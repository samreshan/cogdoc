'use client'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { DockSourceContext } from '@/lib/document-collaborator-contract'
import { completeGuideAction } from '@/lib/live-research-guide'
import { useCogdoc } from '@/lib/store'

type Status = { chunks: number; embedded: number; demoTopicId?: string | null; error?: string }
export default function RetrievalPanel({ projectId, onChoose }: { projectId: string; onChoose: (source: DockSourceContext) => void }) {
  const [status, setStatus] = useState<Status | null>(null)
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [passages, setPassages] = useState<Array<{ workspaceSourceId: string | null; chunkId: string; content: string; similarityScore: number; pdfFilename: string }>>([])
  const bumpLibrary = useCogdoc((state) => state.bumpLibrary)
  const libraryVersion = useCogdoc((state) => state.libraryVersion)
  const load = useCallback(async () => { try { const response = await fetch(`/api/workspaces/${projectId}/retrieval`); setStatus(await response.json()) } catch { setNotice('Could not check retrieval. Retry when the server is available.') } }, [projectId])
  useEffect(() => { void load() }, [load, libraryVersion])
  async function run(action: 'search' | 'index' | 'prepare') {
    setBusy(true); setNotice('')
    try {
      const response = await fetch(`/api/workspaces/${projectId}/${action === 'prepare' ? 'demo-setup' : 'retrieval'}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, query }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'The operation did not finish.')
      if (action === 'search') { setPassages(data.passages); setNotice(data.passages.length ? 'Real passages ranked by semantic similarity. Similarity is not proof of support.' : 'No indexed passages matched. Load reading material or upload a source, then index it.') }
      else { setNotice(action === 'prepare' && !data.ready ? 'Some sources or embeddings are unavailable. Saved text remains readable; retry when the service recovers.' : 'Source processing finished.'); bumpLibrary(); await load() }
    } catch (error) { setNotice((error as Error).message) } finally { setBusy(false) }
  }
  return <section aria-label="Semantic retrieval" className="my-4 rounded-xl border p-3">
    <h3 className="text-sm font-semibold">Search inside your sources</h3>
    <p className="mt-1 text-xs text-muted-foreground">{status ? `${status.chunks ?? 0} passages · ${status.embedded ?? 0} embedded` : 'Checking index…'} · PostgreSQL / pgvector</p>
    {status?.error ? <p role="status" className="mt-2 text-xs text-amber-800">{status.error}</p> : null}
    <div className="mt-2 flex flex-wrap gap-2">{status?.demoTopicId ? <Button size="sm" variant="outline" disabled={busy} onClick={() => void run('prepare')}>Load demo reading material</Button> : null}<Button size="sm" variant="outline" disabled={busy || !status?.chunks} onClick={() => void run('index')}>Retry indexing</Button><Button size="sm" variant="ghost" disabled={busy} onClick={() => void load()}>Refresh status</Button></div>
    <label className="mt-3 grid gap-1 text-xs font-medium">Search question<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="What does a Service do?" className="rounded-md border bg-background p-2 text-sm" /></label>
    <Button className="mt-2" size="sm" disabled={busy || !query.trim()} onClick={() => void run('search')}>{busy ? 'Working…' : 'Retrieve passages'}</Button>
    {notice ? <p role="status" className="mt-2 text-xs leading-5">{notice}</p> : null}
    {passages.map((passage) => <article key={passage.chunkId} className="mt-3 border-t pt-3"><p className="text-xs font-medium">{passage.pdfFilename} · similarity {passage.similarityScore.toFixed(3)}</p><p className="mt-2 whitespace-pre-wrap text-xs leading-5">{passage.content}</p>{passage.workspaceSourceId ? <Button size="sm" variant="outline" className="mt-2" onClick={() => { onChoose({ workspaceSourceId: passage.workspaceSourceId!, title: passage.pdfFilename, passageId: passage.chunkId, excerpt: passage.content, accessBasis: 'extracted_text', locator: `Passage ${passage.chunkId}` }); completeGuideAction(projectId, 'evidence'); setNotice('Passage chosen. Open Collaborator to discuss it alongside your writing.') }}>Use this passage</Button> : null}</article>)}
  </section>
}
