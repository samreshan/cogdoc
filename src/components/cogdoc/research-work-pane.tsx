'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, BookOpen, ExternalLink, FileCode, FileText, FileType, Link2, Loader2, NotebookPen, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { useCogdoc } from '@/lib/store'
import type { Project, ResearchWorkspaceSnapshot } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import EditorTiptap from './editor-tiptap'
import ResearchLibrary from './research-library'
import ActionQueue from './action-queue'
import SourceMapper from './source-mapper'
import ResearchHistory from './research-history'

interface Props { project: Project; data: ResearchWorkspaceSnapshot | null; onRefresh: () => void }

export default function ResearchWorkPane({ project, data, onRefresh }: Props) {
  const tabs = useCogdoc((state) => state.ideTabs)
  const activeTabId = useCogdoc((state) => state.activeTabId)
  const setActiveTab = useCogdoc((state) => state.setActiveTab)
  const closeIdeTab = useCogdoc((state) => state.closeIdeTab)
  const active = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0]
  const tabRefs = useRef(new Map<string, HTMLButtonElement>())

  function moveTab(event: React.KeyboardEvent, index: number) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
    setActiveTab(tabs[nextIndex].id)
    tabRefs.current.get(tabs[nextIndex].id)?.focus()
  }

  return <main id="main-content" className="flex h-full min-h-0 flex-col bg-[#f7f6f3]" aria-label="Research work area">
    <div role="tablist" aria-label="Open research items" className="flex min-h-11 shrink-0 items-center gap-5 overflow-x-auto border-b border-[#e4e0d8] bg-[#fffefb] px-5">
      {tabs.map((tab, index) => <button key={tab.id} ref={(node) => { if (node) tabRefs.current.set(tab.id, node) }} role="tab" aria-selected={tab.id === activeTabId} tabIndex={tab.id === activeTabId ? 0 : -1} onKeyDown={(event) => moveTab(event, index)} onClick={() => setActiveTab(tab.id)} className={`group relative flex h-11 max-w-48 shrink-0 items-center gap-2 text-[11px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#386c5c] ${tab.id === activeTabId ? 'font-medium text-stone-900 after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-[#386c5c]' : 'text-stone-400 hover:text-stone-700'}`}>
        <span className="truncate">{tab.label}</span>{tab.closable !== false && <span role="button" aria-label={`Close ${tab.label}`} onClick={(event) => { event.stopPropagation(); closeIdeTab(tab.id); requestAnimationFrame(() => tabRefs.current.get('document')?.focus()) }} className="p-0.5 opacity-0 transition-opacity hover:bg-stone-100 group-hover:opacity-70 group-focus-visible:opacity-70"><X className="h-3 w-3" /></span>}
      </button>)}
    </div>
    <section role="tabpanel" className="min-h-0 flex-1">
      {active.kind === 'document' && <EditorTiptap />}
      {active.kind === 'sources' && <SourceMapper project={project} data={data} onRefresh={onRefresh} />}
      {active.kind === 'references' && <ResearchLibrary />}
      {active.kind === 'source' && active.entityId && <SourceViewer key={active.entityId} projectId={project.id} sourceId={active.entityId} />}
      {active.kind === 'notebook' && <Notebook projectId={project.id} data={data} onRefresh={onRefresh} />}
      {active.kind === 'evidence' && <EvidenceMap data={data} />}
      {active.kind === 'actions' && <ActionQueue />}
      {active.kind === 'exports' && <Exports project={project} data={data} />}
      {active.kind === 'history' && <ResearchHistory projectId={project.id} initialFilter={active.id.endsWith('interventions') ? 'interventions' : 'decisions'} />}
    </section>
  </main>
}

function SourceViewer({ projectId, sourceId }: { projectId: string; sourceId: string }) {
  const [result, setResult] = useState<Awaited<ReturnType<typeof api.getResearchSource>> | null>(null)
  const [error, setError] = useState('')
  const select = useCogdoc((state) => state.selectResearchEntity)
  useEffect(() => { api.getResearchSource(projectId, sourceId).then(setResult).catch((reason) => setError((reason as Error).message)) }, [projectId, sourceId])
  if (error) return <State icon={AlertTriangle} title="Source unavailable" detail={error} />
  if (!result) return <State icon={Loader2} title="Opening private source" detail="Loading indexed passages…" spinning />
  return <article className="h-full overflow-y-auto bg-[#f7f4ed]">
    <header className="sticky top-0 z-10 border-b border-[#d8d2c6] bg-[#f7f4ed]/95 px-6 py-4 backdrop-blur">
      <div className="mx-auto flex max-w-4xl items-start justify-between gap-4"><div><p className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#426458]">Private library source</p><h2 className="mt-1 font-serif text-xl font-semibold text-stone-900">{result.workspaceSource.source.title}</h2><p className="mt-1 text-[11px] text-stone-500">{result.passages.length} indexed passages · select one to inspect, cite, annotate, or synthesize</p></div>{result.hasPrivateFile && <Button asChild variant="outline" size="sm" className="h-8"><a href={`/api/workspaces/${projectId}/sources/${sourceId}/content`} target="_blank" rel="noreferrer"><ExternalLink className="mr-1.5 h-3.5 w-3.5" />Open PDF</a></Button>}</div>
    </header>
    <div className="mx-auto max-w-3xl px-6 py-8">
      {result.passages.length ? result.passages.map((passage) => <button key={passage.id} id={`passage-${passage.id}`} onClick={() => select('source', sourceId, passage.id)} className="group mb-4 block w-full border-l-2 border-[#c9c2b6] bg-[#fffdf8] px-5 py-4 text-left transition-colors hover:border-[#386c5c] hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#386c5c]"><span className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#5a766c]">page {passage.pageApprox} · passage {passage.chunkIndex + 1}</span><p className="mt-2 font-serif text-[15px] leading-7 text-stone-700">{passage.content}</p><span className="mt-2 block text-[10px] font-medium text-[#386c5c] opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100">Inspect passage</span></button>) : <State icon={BookOpen} title="Full text is not indexed" detail="This source currently has metadata only. Attach a readable PDF to enable passage-level work." />}
    </div>
  </article>
}

function Notebook({ projectId, data, onRefresh }: { projectId: string; data: ResearchWorkspaceSnapshot | null; onRefresh: () => void }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const select = useCogdoc((state) => state.selectResearchEntity)
  async function save() {
    if (!body.trim()) return
    setSaving(true)
    try { await api.createResearchNote(projectId, { title, body }); setTitle(''); setBody(''); onRefresh(); toast.success('Note linked to this project') } catch (error) { toast.error('Could not save note', { description: (error as Error).message }) } finally { setSaving(false) }
  }
  return <div className="h-full overflow-y-auto bg-[#f7f4ed] px-6 py-7"><div className="mx-auto max-w-3xl"><header><p className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#426458]">Linked notebook</p><h2 className="mt-1 font-serif text-2xl font-semibold">Notes stay connected to sources and draft ranges.</h2></header><div className="mt-6 border-y border-[#d8d2c6] bg-[#fffdf8] p-4"><Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Note title (optional)" className="border-0 border-b border-stone-200 bg-transparent px-0 shadow-none focus-visible:ring-0" /><Textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Capture your interpretation, question, or next move…" rows={5} className="mt-3 resize-none border-0 bg-transparent px-0 font-serif text-base leading-7 shadow-none focus-visible:ring-0" /><div className="mt-3 flex justify-end"><Button onClick={save} disabled={!body.trim() || saving} size="sm" className="bg-[#173f35] hover:bg-[#245548]">{saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}Add note</Button></div></div><div className="mt-6 space-y-3">{data?.notes.map((note) => <button key={note.id} onClick={() => select('note', note.id)} className="block w-full border-b border-[#ded9cf] px-1 py-4 text-left hover:bg-[#fffdf8]"><div className="flex items-center gap-2"><NotebookPen className="h-3.5 w-3.5 text-[#426458]" /><span className="text-xs font-semibold">{note.title ?? (note.kind === 'excerpt' ? 'Source excerpt' : 'Untitled note')}</span>{note.stale && <span className="font-mono text-[9px] text-amber-700">anchor changed</span>}</div><p className="mt-2 line-clamp-3 font-serif text-sm leading-6 text-stone-600">{note.body}</p>{note.exactExcerpt && <blockquote className="mt-2 border-l-2 border-[#bba37b] pl-3 text-[11px] italic text-stone-500">{note.exactExcerpt}</blockquote>}</button>)}{!data?.notes.length && <State icon={NotebookPen} title="The notebook is empty" detail="Add a note here or create one from an indexed source passage." />}</div></div></div>
}

function EvidenceMap({ data }: { data: ResearchWorkspaceSnapshot | null }) {
  const select = useCogdoc((state) => state.selectResearchEntity)
  return <div className="h-full overflow-y-auto bg-[#f7f4ed] px-6 py-7"><div className="mx-auto max-w-4xl"><h2 className="font-serif text-2xl font-semibold">Claims and evidence</h2><p className="mt-1 text-xs text-stone-500">Every link resolves to an indexed passage. Unsupported claims remain visible.</p><div className="mt-7 space-y-1">{data?.claims.map((claim) => <button key={claim.id} onClick={() => select('claim', claim.id)} className="grid w-full grid-cols-[minmax(0,1fr)_10rem] border-t border-[#d8d2c6] px-3 py-4 text-left hover:bg-[#fffdf8]"><div className="pr-6"><span className="font-mono text-[9px] uppercase text-stone-500">{claim.central ? 'Central claim' : 'Claim'}</span><p className="mt-1 font-serif text-sm leading-6 text-stone-700">{claim.text}</p></div><div className="flex items-center justify-end gap-1">{claim.evidenceLinks.length ? claim.evidenceLinks.map((link) => <span key={link.id} className={`h-2.5 w-8 ${link.supportStatus === 'supported' ? 'bg-[#527d6e]' : link.supportStatus === 'contradicted' ? 'bg-[#a1542c]' : 'bg-[#c6a86f]'}`} title={link.supportStatus} />) : <span className="flex items-center gap-1 text-[10px] text-amber-700"><AlertTriangle className="h-3 w-3" />Missing evidence</span>}</div></button>)}{!data?.claims.length && <State icon={Link2} title="No claims mapped yet" detail="Run a document review to identify claims and connect them to exact evidence." />}</div></div></div>
}

function Exports({ project, data }: { project: Project; data: ResearchWorkspaceSnapshot | null }) {
  const formats = [{ key: 'docx', label: 'Word document', icon: FileType }, { key: 'md', label: 'Markdown', icon: FileText }, { key: 'html', label: 'HTML', icon: FileCode }]
  return <div className="h-full overflow-y-auto bg-[#f7f4ed] px-6 py-7"><div className="mx-auto max-w-3xl"><p className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#426458]">Writing & export</p><h2 className="mt-1 font-serif text-2xl font-semibold">Format the research document.</h2><p className="mt-2 max-w-xl text-xs leading-5 text-stone-500">The bibliography is generated from citations actually used in the document. Choose a writing profile, then export the current revision.</p><div className="mt-7 grid gap-px bg-[#d8d2c6] sm:grid-cols-3">{formats.map(({ key, label, icon: Icon }) => <button key={key} onClick={() => window.open(`/api/projects/${project.id}/export?format=${key}`, '_blank')} className="bg-[#fffdf8] p-5 text-left hover:bg-white"><Icon className="h-5 w-5 text-[#386c5c]" /><p className="mt-4 text-sm font-semibold">{label}</p><p className="mt-1 text-[10px] text-stone-500">Download current revision</p></button>)}</div><AcademicProfileForm project={project} profile={data?.profile ?? null} />{Boolean(data?.jobs.length) && <div className="mt-6"><p className="font-mono text-[9px] uppercase tracking-[.16em] text-stone-500">Background work</p>{data?.jobs.map((job) => <div key={job.id} className="mt-2 flex items-center gap-3 text-[11px]"><span className={`h-1.5 w-1.5 ${job.status === 'failed' ? 'bg-rose-600' : 'bg-[#527d6e]'}`} /><span className="flex-1">{job.kind}</span><span className="font-mono text-stone-500">{job.status} · {job.progress}%</span></div>)}</div>}</div></div>
}

function AcademicProfileForm({ project, profile }: { project: Project; profile: ResearchWorkspaceSnapshot['profile'] }) {
  const [name, setName] = useState(profile?.name ?? 'Academic manuscript')
  const [style, setStyle] = useState(profile?.cslStyle ?? project.citationStyle ?? 'harvard')
  const [spacing, setSpacing] = useState(profile?.spacing ?? 2)
  const [margin, setMargin] = useState(() => { try { return Number(JSON.parse(profile?.marginsJson ?? '{}').top ?? 25.4) } catch { return 25.4 } })
  const [saving, setSaving] = useState(false)
  async function save() { setSaving(true); try { await api.saveAcademicProfile(project.id, { profileId: profile?.id, name, cslStyle: style, spacing, margins: { top: margin, right: margin, bottom: margin, left: margin }, bibliography: { hangingIndent: true, source: 'used_citations_only' } }); toast.success('Academic profile saved') } catch (error) { toast.error('Could not save profile', { description: (error as Error).message }) } finally { setSaving(false) } }
  return <section className="mt-8 border-y border-[#d8d2c6] py-5"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold">Academic profile</p><p className="mt-1 text-[10px] text-stone-500">CSL, spacing, margins, headings, captions, tables, and bibliography rules travel with the export.</p></div></div><div className="mt-4 grid gap-3 sm:grid-cols-4"><label className="sm:col-span-2"><span className="text-[10px] text-stone-500">Profile name</span><Input value={name} onChange={(event) => setName(event.target.value)} className="mt-1 h-8 text-xs" /></label><label><span className="text-[10px] text-stone-500">CSL style</span><select value={style} onChange={(event) => setStyle(event.target.value)} className="mt-1 h-8 w-full border border-stone-300 bg-[#fffdf8] px-2 text-xs"><option value="harvard">Harvard</option><option value="apa">APA</option></select></label><label><span className="text-[10px] text-stone-500">Line spacing</span><select value={spacing} onChange={(event) => setSpacing(Number(event.target.value))} className="mt-1 h-8 w-full border border-stone-300 bg-[#fffdf8] px-2 text-xs"><option value={1}>Single</option><option value={1.5}>1.5</option><option value={2}>Double</option></select></label><label><span className="text-[10px] text-stone-500">Margins (mm)</span><Input type="number" min={10} max={50} value={margin} onChange={(event) => setMargin(Number(event.target.value))} className="mt-1 h-8 text-xs" /></label><div className="flex items-end sm:col-start-4"><Button onClick={save} disabled={saving || !name.trim()} size="sm" className="h-8 w-full bg-[#173f35] text-xs hover:bg-[#245548]">{saving && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}Save profile</Button></div></div></section>
}

function State({ icon: Icon, title, detail, spinning }: { icon: typeof BookOpen; title: string; detail: string; spinning?: boolean }) { return <div className="flex min-h-56 flex-col items-center justify-center px-6 text-center"><Icon className={`h-6 w-6 text-[#527d6e] ${spinning ? 'animate-spin motion-reduce:animate-none' : ''}`} /><p className="mt-4 text-sm font-semibold">{title}</p><p className="mt-1 max-w-sm text-xs leading-5 text-stone-500">{detail}</p></div> }
