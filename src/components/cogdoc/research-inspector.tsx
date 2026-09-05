'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, BookOpen, BrainCircuit, Check, Clock3, FileText, Link2, Loader2, MapPin, NotebookPen, Pin, PinOff, Quote, Search, ShieldCheck, Sparkles, X } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { useCogdoc } from '@/lib/store'
import type { PriorityFactors, Project, ReferenceSummary, ResearchAction, ResearchWorkspaceSnapshot } from '@/lib/types'
import { structuredCitationForReference } from '@/lib/citation-insertion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import InterventionTest from './intervention-test'

interface Props { project: Project; data: ResearchWorkspaceSnapshot | null; loading: boolean; onRefresh: () => void }

export default function ResearchInspector({ project, data, loading, onRefresh }: Props) {
  const context = useCogdoc((state) => state.editorContext)
  const requestCitationInsertion = useCogdoc((state) => state.requestCitationInsertion)
  const openIdeTab = useCogdoc((state) => state.openIdeTab)
  const activeInterventionCount = useCogdoc((state) => state.activeInterventions.filter((item) => item.status === 'active').length)
  const [sourceDetail, setSourceDetail] = useState<Awaited<ReturnType<typeof api.getResearchSource>> | null>(null)
  const [locator, setLocator] = useState('')
  const [acting, setActing] = useState(false)
  const [testOpen, setTestOpen] = useState(false)
  const selectedSource = data?.sources.find((item) => item.id === context?.entityId) ?? null
  const selectedPassage = sourceDetail?.passages.find((item) => item.id === context?.passageId) ?? null
  const selectedAction = data?.actions.find((item) => item.id === context?.entityId) ?? null
  const selectedClaim = data?.claims.find((item) => item.id === context?.entityId) ?? null
  const selectedNote = data?.notes.find((item) => item.id === context?.entityId) ?? null

  useEffect(() => {
    if (!selectedSource) { setSourceDetail(null); return }
    api.getResearchSource(project.id, selectedSource.id).then(setSourceDetail).catch(() => setSourceDetail(null))
  }, [project.id, selectedSource?.id])

  const reference = useMemo(() => selectedSource ? data?.references.find((item) =>
    (item.doi && selectedSource.source.doi && item.doi.toLowerCase() === selectedSource.source.doi.toLowerCase()) ||
    (item.url && selectedSource.source.canonicalUrl && item.url === selectedSource.source.canonicalUrl),
  ) ?? null : null, [data?.references, selectedSource])

  async function mutateAction(action: ResearchAction, patch: Record<string, unknown>, message: string) {
    setActing(true)
    try { await api.updateResearchAction(project.id, action.id, patch); onRefresh(); toast.success(message) } catch (error) { toast.error('Could not update action', { description: (error as Error).message }) } finally { setActing(false) }
  }

  async function createPassageNote() {
    if (!selectedSource || !selectedPassage) return
    setActing(true)
    try {
      await api.createResearchNote(project.id, { workspaceSourceId: selectedSource.id, passageId: selectedPassage.id, kind: 'excerpt', title: `Excerpt from ${selectedSource.source.title}`, body: 'Interpret this passage in your own words.', exactExcerpt: selectedPassage.content, sourceAnchor: { page: selectedPassage.pageApprox, passageId: selectedPassage.id } })
      onRefresh(); toast.success('Passage linked to notebook')
    } catch (error) { toast.error('Could not create note', { description: (error as Error).message }) } finally { setActing(false) }
  }

  async function synthesize(kind: 'summary' | 'comparison' | 'counterevidence') {
    if (!selectedPassage) return
    setActing(true)
    try {
      await api.requestSynthesis(project.id, { kind, prompt: kind === 'summary' ? 'Summarize the research finding in this passage without drafting submission prose.' : kind === 'comparison' ? 'Compare the selected evidence with other indexed findings.' : 'Identify counterevidence or limits grounded in indexed passages.', passageIds: [selectedPassage.id] })
      onRefresh(); toast.success('Grounded synthesis queued', { description: 'Every finding must retain its passage link.' })
    } catch (error) { toast.error('Could not start synthesis', { description: (error as Error).message }) } finally { setActing(false) }
  }

  function insertCitation(item: ReferenceSummary) {
    const citation = structuredCitationForReference(item, locator)
    if (!citation) { toast.error('Verify citation metadata before inserting it'); return }
    requestCitationInsertion(citation)
    openIdeTab({ id: 'document', kind: 'document', label: 'Working document', closable: false })
  }

  if (loading) return <InspectorState icon={Loader2} title="Reading context" detail="Loading project evidence…" spinning />
  return <aside className="research-pane flex h-full min-h-0 flex-col border-l border-[#e5e1d8] bg-[#fbfaf7]" aria-label="Contextual evidence inspector">
    <header className="border-b border-[#e5e1d8] px-5 pb-4 pt-5"><p className="text-[10px] font-medium text-stone-500">Evidence inspector</p><h2 className="mt-1 font-serif text-base font-semibold tracking-[-0.01em] text-stone-800">{selectedPassage ? `Passage · page ${selectedPassage.pageApprox}` : selectedSource ? selectedSource.source.title : selectedAction ? 'Action rationale' : selectedClaim ? 'Claim status' : selectedNote ? 'Notebook backlink' : context?.activeKind === 'document' ? 'Document context' : 'Current selection'}</h2></header>
    {activeInterventionCount > 0 && <section className="border-b border-[#e5e1d8] p-4">
      <Button variant="outline" onClick={() => setTestOpen(true)} className="h-auto w-full justify-between border-[#ddd8ce] bg-white px-3 py-3 text-left text-stone-700 hover:bg-[#f3f1ec]">
        <span className="flex items-center gap-2.5"><BrainCircuit className="h-4 w-4 text-[#386c5c]" /><span><span className="block text-[11px] font-semibold">Review highlighted questions</span><span className="block text-[9px] font-normal text-stone-400">Talk through the reasoning, one passage at a time</span></span></span>
        <span className="grid h-5 min-w-5 place-items-center bg-[#edf2ee] px-1.5 font-mono text-[9px] text-[#386c5c]">{activeInterventionCount}</span>
      </Button>
    </section>}
    <div className="min-h-0 flex-1 overflow-y-auto">
      {selectedPassage && selectedSource ? <>
        <Section label="Exact passage"><blockquote className="border-l-2 border-[#bba37b] pl-3 font-serif text-[13px] leading-6 text-stone-700">{selectedPassage.content}</blockquote><p className="mt-2 flex items-center gap-1 font-mono text-[9px] text-stone-500"><MapPin className="h-3 w-3" />{selectedSource.source.title} · page {selectedPassage.pageApprox}</p></Section>
        <Section label="Research actions"><div className="grid grid-cols-2 gap-2"><Button variant="outline" size="sm" onClick={createPassageNote} disabled={acting} className="h-8 justify-start text-[10px]"><NotebookPen className="mr-1.5 h-3 w-3" />Link note</Button><Button variant="outline" size="sm" onClick={() => synthesize('summary')} disabled={acting} className="h-8 justify-start text-[10px]"><Sparkles className="mr-1.5 h-3 w-3" />Summarize</Button><Button variant="outline" size="sm" onClick={() => synthesize('comparison')} disabled={acting} className="h-8 justify-start text-[10px]"><Link2 className="mr-1.5 h-3 w-3" />Compare</Button><Button variant="outline" size="sm" onClick={() => synthesize('counterevidence')} disabled={acting} className="h-8 justify-start text-[10px]"><Search className="mr-1.5 h-3 w-3" />Counterevidence</Button></div><p className="mt-3 text-[10px] leading-4 text-stone-500">These tools organize findings. Use Think with Cogdoc after you have worked through what the passages mean.</p></Section>
        <CitationSection reference={reference} locator={locator} setLocator={setLocator} insertCitation={insertCitation} />
      </> : selectedSource ? <>
        <Section label="Source quality"><div className="flex items-end justify-between"><span className="font-mono text-2xl tabular-nums text-[#386c5c]">{Math.round(selectedSource.source.qualityScore * 100)}</span><span className="font-mono text-[9px] uppercase text-stone-500">confidence signal</span></div><div className="mt-2 h-1 bg-stone-200"><div className="h-full bg-[#527d6e]" style={{ width: `${selectedSource.source.qualityScore * 100}%` }} /></div><p className="mt-3 text-[11px] leading-5 text-stone-600">{selectedSource.source.qualityExplanation ?? 'Quality is uncertain. Verify the publication and metadata manually.'}</p><p className="mt-2 text-[10px] text-stone-500">Quality changes ranking; it never silently hides the source.</p></Section>
        <Section label="Metadata"><Meta label="DOI" value={selectedSource.source.doi ?? 'Not available'} /><Meta label="Status" value={selectedSource.status} /><Meta label="Full text" value={selectedSource.source.parseStatus} /><Meta label="Citations used" value={String(selectedSource.citationUsageCount)} /></Section>
        <CitationSection reference={reference} locator={locator} setLocator={setLocator} insertCitation={insertCitation} />
      </> : selectedAction ? <ActionInspector action={selectedAction} acting={acting} mutate={mutateAction} /> : selectedClaim ? <>
        <Section label="Claim"><p className="font-serif text-sm leading-6 text-stone-700">{selectedClaim.text}</p><p className="mt-2 font-mono text-[9px] uppercase text-stone-500">{selectedClaim.central ? 'Central to the document' : 'Supporting claim'}</p></Section>
        <Section label="Evidence status">{selectedClaim.evidenceLinks.length ? selectedClaim.evidenceLinks.map((link) => <div key={link.id} className="mb-3 border-l-2 border-[#527d6e] pl-3"><p className="text-[10px] font-semibold uppercase text-[#386c5c]">{link.supportStatus.replace(/_/g, ' ')}</p><p className="mt-1 line-clamp-4 text-[11px] leading-5 text-stone-600">{link.excerpt ?? 'Indexed passage linked'}</p></div>) : <p className="flex gap-2 text-xs text-amber-800"><AlertTriangle className="h-4 w-4 shrink-0" />No indexed passage is linked to this claim.</p>}</Section>
      </> : selectedNote ? <><Section label="Note"><p className="font-serif text-sm leading-6 text-stone-700">{selectedNote.body}</p></Section><Section label="Backlinks"><Meta label="Source passage" value={selectedNote.passageId ? 'Linked' : 'None'} /><Meta label="Document range" value={selectedNote.documentAnchorJson ? 'Linked' : 'None'} /><Meta label="Anchor state" value={selectedNote.stale ? 'Needs review' : 'Current'} /></Section></> : <>
        <InspectorState icon={FileText} title="Select research material" detail="Choose a claim, source, passage, note, or action. Its evidence, backlinks, quality rationale, and citation controls will appear here." />
        <Section label="Keyboard"><Meta label="Navigator" value="⌘/Ctrl ⇧ B" /><Meta label="Inspector" value="⌘/Ctrl ⇧ I" /><Meta label="Focused panes" value="Alt 1 / 2 / 3" /></Section>
      </>}
    </div>
    <InterventionTest open={testOpen} onOpenChange={setTestOpen} />
  </aside>
}

function ActionInspector({ action, acting, mutate }: { action: ResearchAction; acting: boolean; mutate: (action: ResearchAction, patch: Record<string, unknown>, message: string) => void }) {
  let factors: PriorityFactors | null = null
  try { factors = JSON.parse(action.priorityFactorsJson) as PriorityFactors } catch {}
  return <><Section label="Why this is ranked here"><p className="text-sm font-semibold text-stone-800">{action.title}</p><p className="mt-2 text-[11px] leading-5 text-stone-600">{action.detail}</p><div className="mt-4 space-y-2">{factors && Object.entries(factors).filter(([, value]) => value !== 0).map(([key, value]) => <div key={key} className="flex items-center justify-between border-b border-stone-200 pb-1.5"><span className="text-[10px] capitalize text-stone-500">{key.replace(/([A-Z])/g, ' $1')}</span><span className={`font-mono text-[10px] ${value > 0 ? 'text-[#386c5c]' : 'text-stone-500'}`}>{value > 0 ? '+' : ''}{value}</span></div>)}</div><p className="mt-3 text-[10px] leading-4 text-stone-500">AI relevance is bounded to ±5 and cannot hide deterministic blockers.</p></Section><Section label="Controls"><div className="grid grid-cols-2 gap-2"><Button variant="outline" size="sm" disabled={acting} onClick={() => mutate(action, { pinned: !action.pinned }, action.pinned ? 'Action unpinned' : 'Action pinned')} className="h-8 justify-start text-[10px]">{action.pinned ? <PinOff className="mr-1.5 h-3 w-3" /> : <Pin className="mr-1.5 h-3 w-3" />}{action.pinned ? 'Unpin' : 'Pin'}</Button><Button variant="outline" size="sm" disabled={acting} onClick={() => mutate(action, { snoozedUntil: new Date(Date.now() + 86_400_000).toISOString() }, 'Snoozed for one day')} className="h-8 justify-start text-[10px]"><Clock3 className="mr-1.5 h-3 w-3" />Snooze</Button><Button size="sm" disabled={acting} onClick={() => mutate(action, { state: 'completed' }, 'Action completed')} className="h-8 justify-start bg-[#173f35] text-[10px] hover:bg-[#245548]"><Check className="mr-1.5 h-3 w-3" />Complete</Button><Button variant="ghost" size="sm" disabled={acting} onClick={() => mutate(action, { state: 'dismissed' }, 'Action dismissed')} className="h-8 justify-start text-[10px]"><X className="mr-1.5 h-3 w-3" />Dismiss</Button></div></Section></>
}

function CitationSection({ reference, locator, setLocator, insertCitation }: { reference: ReferenceSummary | null; locator: string; setLocator: (value: string) => void; insertCitation: (reference: ReferenceSummary) => void }) {
  const verified = Boolean(reference && ['matched', 'confirmed'].includes(reference.metadataStatus))
  return <Section label="Citation"><div className="flex items-center gap-2">{verified ? <ShieldCheck className="h-4 w-4 text-[#386c5c]" /> : <AlertTriangle className="h-4 w-4 text-amber-700" />}<p className="text-[11px] text-stone-600">{reference ? verified ? 'Metadata verified' : 'Metadata needs verification' : 'No saved reference is linked'}</p></div>{reference && <><p className="mt-3 line-clamp-4 font-serif text-[11px] leading-5 text-stone-600">{reference.rawText}</p><Input value={locator} onChange={(event) => setLocator(event.target.value)} placeholder="Locator, e.g. p. 14" className="mt-3 h-8 text-[11px]" /><Button onClick={() => insertCitation(reference)} disabled={!verified} size="sm" className="mt-2 h-8 w-full bg-[#173f35] text-[10px] hover:bg-[#245548]"><Quote className="mr-1.5 h-3 w-3" />Insert citation metadata</Button></>}</Section>
}

function Section({ label, children }: { label: string; children: React.ReactNode }) { return <section className="border-b border-[#e5e1d8] px-5 py-5"><h3 className="mb-4 text-[10px] font-medium text-stone-400">{label}</h3>{children}</section> }
function Meta({ label, value }: { label: string; value: string }) { return <div className="flex items-start justify-between gap-4 border-t border-stone-200 py-2 first:border-0"><span className="text-[10px] text-stone-500">{label}</span><span className="max-w-[65%] break-words text-right font-mono text-[9px] text-stone-700">{value}</span></div> }
function InspectorState({ icon: Icon, title, detail, spinning }: { icon: typeof BookOpen; title: string; detail: string; spinning?: boolean }) { return <div className="px-5 py-10 text-center"><Icon className={`mx-auto h-6 w-6 text-[#527d6e] ${spinning ? 'animate-spin motion-reduce:animate-none' : ''}`} /><p className="mt-4 text-sm font-semibold">{title}</p><p className="mt-2 text-[11px] leading-5 text-stone-500">{detail}</p></div> }
