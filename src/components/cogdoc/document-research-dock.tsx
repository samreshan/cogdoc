'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BookOpen, Check, ChevronLeft, FileOutput, Lightbulb, ListChecks,
  Loader2, MessageSquareText, PanelRightClose, PenLine, Plus, Search,
  Send, ShieldAlert, Sparkles, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import InvestigationPlanPanel from '@/components/cogdoc/investigation-plan-panel'
import ManualFindingPanel from '@/components/cogdoc/manual-finding-panel'
import FindingsWorkspace from '@/components/cogdoc/findings-workspace'
import { ArticleWorkspace } from '@/components/cogdoc/article-workspace'
import {
  loadDocumentCollaborator,
  sendDocumentCollaboratorMessage,
  type PublicAssistantConfiguration,
} from '@/lib/document-collaborator-client'
import type {
  CollaboratorIntent, CollaboratorTurn, DockProposal, DockSourceContext,
  DocumentEditProposal, DocumentResearchDockProps, FindingDraftProposal,
  InvestigationPlanProposal, SourceAccessBasis,
} from '@/lib/document-collaborator-contract'

const sections = [
  { id: 'collaborator', label: 'Collaborator', icon: MessageSquareText },
  { id: 'sources', label: 'Sources', icon: BookOpen },
  { id: 'findings', label: 'Findings', icon: ListChecks },
  { id: 'plan', label: 'Plan', icon: Lightbulb },
  { id: 'share', label: 'Share', icon: FileOutput },
] as const

const shortcuts: Array<{ intent: CollaboratorIntent; label: string; prompt: string }> = [
  { intent: 'explain', label: 'Explain', prompt: 'Explain this in plain language and show what the key idea depends on.' },
  { intent: 'find_evidence', label: 'Find evidence', prompt: 'What evidence would be most useful here, and what should I look for in it?' },
  { intent: 'challenge', label: 'Challenge reasoning', prompt: 'Challenge the reasoning in the context I selected. Name the strongest limitation or alternative.' },
  { intent: 'plan', label: 'Help me plan', prompt: 'Propose a small editable investigation plan for this document.' },
]

function uid() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `request-${Date.now()}`
}

function ContextChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-foreground">
    <span className="truncate">{label}</span>
    <button type="button" onClick={onRemove} aria-label={`Remove ${label} from collaborator context`} className="rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><X className="h-3.5 w-3.5" /></button>
  </span>
}

function ProposalActions({ proposal, onPreview, onApply, onOpenSection }: {
  proposal: DockProposal
  onPreview: (proposal: DocumentEditProposal) => void
  onApply: (proposal: DocumentEditProposal) => Promise<void>
  onOpenSection: (section: 'findings' | 'plan') => void
}) {
  const [applying, setApplying] = useState(false)
  if (proposal.kind === 'document_revision' || proposal.kind === 'document_insertion') {
    return <div className="mt-3 flex flex-wrap gap-2">
      <Button size="sm" variant="outline" onClick={() => onPreview(proposal)}><Search className="mr-1.5 h-3.5 w-3.5" />Preview change</Button>
      <Button size="sm" disabled={applying} onClick={() => { setApplying(true); void onApply(proposal).finally(() => setApplying(false)) }}>{applying ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin motion-reduce:animate-none" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}Apply explicitly</Button>
    </div>
  }
  if (proposal.kind === 'finding_draft') return <Button className="mt-3" size="sm" variant="outline" onClick={() => onOpenSection('findings')}>Edit as finding</Button>
  return <Button className="mt-3" size="sm" variant="outline" onClick={() => onOpenSection('plan')}>Edit this plan</Button>
}

function ConversationPanel({ props, onOpenSection, onFindingProposal, onPlanProposal }: {
  props: DocumentResearchDockProps
  onOpenSection: (section: 'sources' | 'findings' | 'plan') => void
  onFindingProposal: (proposal: FindingDraftProposal) => void
  onPlanProposal: (proposal: InvestigationPlanProposal) => void
}) {
  const draftKey = `cogdoc:collaborator-draft:${props.projectId}`
  const sourcesKey = `cogdoc:collaborator-sources:${props.projectId}`
  const [turns, setTurns] = useState<CollaboratorTurn[]>([])
  const [assistant, setAssistant] = useState<PublicAssistantConfiguration | null>(null)
  const [draft, setDraft] = useState('')
  const [intent, setIntent] = useState<CollaboratorIntent>('ask')
  const [selectionIncluded, setSelectionIncluded] = useState(Boolean(props.documentSelection))
  const [questionIncluded, setQuestionIncluded] = useState(Boolean(props.selectedQuestion))
  const [chosenSources, setChosenSources] = useState<DockSourceContext[]>(props.selectedSources ?? [])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [applyNotice, setApplyNotice] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  const upstreamSourceIds = (props.selectedSources ?? []).map((source) => source.workspaceSourceId).join(':')

  useEffect(() => {
    setSelectionIncluded(Boolean(props.documentSelection))
  }, [props.documentSelection?.selectionId, props.documentSelection])
  useEffect(() => { setQuestionIncluded(Boolean(props.selectedQuestion)) }, [props.selectedQuestion?.id, props.selectedQuestion])
  useEffect(() => {
    const saved = window.localStorage.getItem(draftKey)
    if (saved) setDraft(saved)
    try {
      const storedSources = JSON.parse(window.localStorage.getItem(sourcesKey) || '[]') as DockSourceContext[]
      if (props.selectedSources?.length) setChosenSources(props.selectedSources)
      else if (Array.isArray(storedSources)) setChosenSources(storedSources.filter((source) => source && typeof source.workspaceSourceId === 'string' && typeof source.title === 'string'))
    } catch { /* ignore an invalid local draft cache */ }
    void loadDocumentCollaborator(props.projectId)
      .then((result) => { setTurns(result.turns); setAssistant(result.assistant) })
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : 'Could not load the conversation.'))
      .finally(() => setLoading(false))
  }, [draftKey, props.projectId, sourcesKey])
  useEffect(() => { if (props.selectedSources?.length) setChosenSources(props.selectedSources) }, [upstreamSourceIds])
  useEffect(() => { window.localStorage.setItem(draftKey, draft) }, [draft, draftKey])
  useEffect(() => {
    window.localStorage.setItem(sourcesKey, JSON.stringify(chosenSources))
    props.onSelectedSourcesChange?.(chosenSources)
  }, [chosenSources, props.onSelectedSourcesChange, sourcesKey])
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'nearest' }) }, [turns.length])

  async function send() {
    if (!draft.trim() || sending) return
    setSending(true); setError(''); setApplyNotice('')
    try {
      const result = await sendDocumentCollaboratorMessage(props.projectId, {
        message: draft, intent, requestId: uid(),
        context: {
          topic: props.projectTitle,
          activeQuestion: questionIncluded ? props.selectedQuestion ?? null : null,
          selection: selectionIncluded ? props.documentSelection ?? null : null,
          sources: chosenSources,
        },
      })
      setTurns((current) => [...current, result.researcherTurn, result.assistantTurn])
      setAssistant(result.assistant); setDraft(''); setIntent('ask')
      window.localStorage.removeItem(draftKey)
      if (result.assistantTurn.proposal?.kind === 'finding_draft') onFindingProposal(result.assistantTurn.proposal)
      if (result.assistantTurn.proposal?.kind === 'plan') onPlanProposal(result.assistantTurn.proposal)
    } catch (requestError) {
      setError(`${requestError instanceof Error ? requestError.message : 'The request failed.'} Your message is still here.`)
    } finally { setSending(false) }
  }

  async function apply(proposal: DocumentEditProposal) {
    const result = await props.onApplyProposal({
      proposal,
      expectedDocumentRevision: proposal.kind === 'document_revision' ? proposal.selection.documentRevision : proposal.expectedDocumentRevision,
      expectedSelectionId: proposal.kind === 'document_revision' ? proposal.selection.selectionId : undefined,
    })
    setApplyNotice(result.applied ? 'Change applied to the document.' : result.reason === 'stale_selection' || result.reason === 'stale_revision' ? 'The document changed. Preview this proposal against the current text before applying it.' : 'The change was not applied.')
  }

  return <div className="flex min-h-0 flex-1 flex-col">
    <div className="border-b border-border px-4 py-3">
      <div className="flex items-center justify-between gap-3"><div><h2 className="text-sm font-semibold text-foreground">Research collaborator</h2><p className="mt-0.5 text-xs text-muted-foreground">Ask freely. Only the context shown below is sent.</p></div><span className="max-w-32 truncate text-xs text-muted-foreground">{assistant?.configured ? `${assistant.provider} / ${assistant.model}` : 'Assistant not configured'}</span></div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {questionIncluded && props.selectedQuestion ? <ContextChip label={`Question: ${props.selectedQuestion.wording}`} onRemove={() => setQuestionIncluded(false)} /> : null}
        {selectionIncluded && props.documentSelection ? <ContextChip label={`Selection: ${props.documentSelection.exactText.slice(0, 48)}${props.documentSelection.exactText.length > 48 ? '…' : ''}`} onRemove={() => setSelectionIncluded(false)} /> : null}
        {chosenSources.map((source) => <ContextChip key={source.workspaceSourceId} label={`Source: ${source.title}`} onRemove={() => setChosenSources((current) => current.filter((item) => item.workspaceSourceId !== source.workspaceSourceId))} />)}
        {!questionIncluded && !selectionIncluded && chosenSources.length === 0 ? <span className="text-xs text-muted-foreground">Project topic only</span> : null}
      </div>
    </div>
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4" aria-live="polite">
      {loading ? <div className="space-y-3" role="status"><div className="h-16 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" /><div className="ml-8 h-24 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" /><span className="sr-only">Loading conversation</span></div> : null}
      {!loading && turns.length === 0 ? <div className="py-8"><Sparkles className="h-5 w-5 text-primary" /><h3 className="mt-3 text-base font-semibold text-foreground">Work through the next part</h3><p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Ask for an explanation, test your reasoning, find evidence, or plan a useful next step.</p></div> : null}
      {turns.map((turn) => <article key={turn.id} className={turn.role === 'researcher' ? 'ml-8 rounded-xl bg-primary px-3.5 py-3 text-primary-foreground' : 'mr-3'}>
        <p className="whitespace-pre-wrap text-sm leading-6">{turn.content}</p>
        {turn.role === 'assistant' && turn.hypothetical ? <p className="mt-2 text-xs font-medium text-muted-foreground">Hypothetical example, not evidence</p> : null}
        {turn.role === 'assistant' && turn.providerStatus === 'unavailable' ? <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><ShieldAlert className="h-3.5 w-3.5" />Provider unavailable. No AI analysis was substituted.</p> : null}
        {turn.role === 'assistant' && turn.nextStep ? <p className="mt-2 text-xs leading-5 text-muted-foreground"><span className="font-medium text-foreground">Useful next step:</span> {turn.nextStep}</p> : null}
        {turn.proposal ? <ProposalActions proposal={turn.proposal} onPreview={props.onRequestPreview} onApply={apply} onOpenSection={(section) => onOpenSection(section)} /> : null}
      </article>)}
      <div ref={endRef} />
    </div>
    <div className="border-t border-border bg-background px-4 py-3">
      <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">{shortcuts.map((item) => <Button key={item.intent} type="button" size="sm" variant={intent === item.intent ? 'secondary' : 'ghost'} className="shrink-0" onClick={() => { setIntent(item.intent); if (!draft.trim()) setDraft(item.prompt) }}>{item.label}</Button>)}</div>
      <label className="sr-only" htmlFor={`collaborator-message-${props.projectId}`}>Message the research collaborator</label>
      <div className="relative"><Textarea id={`collaborator-message-${props.projectId}`} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send() } }} placeholder="Ask about your writing or research…" rows={3} className="resize-none pr-12 text-sm" /><Button type="button" size="icon" aria-label="Send message" disabled={sending || !draft.trim()} className="absolute bottom-2 right-2 h-8 w-8" onClick={() => void send()}>{sending ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Send className="h-4 w-4" />}</Button></div>
      {error ? <p className="mt-2 text-xs text-destructive" role="alert">{error}</p> : null}
      {applyNotice ? <p className="mt-2 text-xs text-muted-foreground" role="status">{applyNotice}</p> : null}
      <div className="mt-2 flex items-center justify-between gap-2"><button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => onOpenSection('sources')}>Choose sources</button><button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={props.onFocusDocument}>Return to document</button></div>
    </div>
  </div>
}

interface WorkspaceSourceRow {
  id: string
  source: { title: string; canonicalUrl?: string | null; parseStatus: string; metadataJson: string }
}

function sourceBasis(source: WorkspaceSourceRow['source']): SourceAccessBasis {
  if (source.parseStatus === 'ready') return 'extracted_text'
  if (source.parseStatus === 'manual_excerpt') return 'manual_excerpt'
  try {
    const metadata = JSON.parse(source.metadataJson) as Record<string, unknown>
    if (source.parseStatus === 'transcript_ready' && typeof metadata.transcript === 'string' && metadata.transcript.trim()) return 'transcript'
    if (metadata.abstract) return 'abstract'
  } catch { /* metadata remains metadata */ }
  return 'metadata'
}

function SourcesPanel({ projectId, selected, onSelected, onOpenSource }: {
  projectId: string
  selected: DockSourceContext[]
  onSelected: (sources: DockSourceContext[]) => void
  onOpenSource: (source: DockSourceContext) => void
}) {
  const [sources, setSources] = useState<WorkspaceSourceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const response = await fetch(`/api/workspaces/${encodeURIComponent(projectId)}/sources`, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not load sources.')
      setSources(data.sources ?? [])
    } catch (requestError) { setError((requestError as Error).message) }
    finally { setLoading(false) }
  }, [projectId])
  useEffect(() => { void load() }, [load])
  async function addUrl() {
    if (!title.trim() || !url.trim()) return
    setSaving(true); setError('')
    try {
      const response = await fetch(`/api/workspaces/${encodeURIComponent(projectId)}/sources`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title, canonicalUrl: url, metadata: { accessState: 'metadata_only', inspectedContent: false } }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not save the source.')
      setTitle(''); setUrl(''); setShowAdd(false); await load()
    } catch (requestError) { setError((requestError as Error).message) }
    finally { setSaving(false) }
  }
  return <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
    <div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-semibold">Sources</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Choose only material you want in collaborator context. Access labels describe what CogDoc can inspect.</p></div><Button size="sm" variant="outline" onClick={() => setShowAdd((value) => !value)}><Plus className="mr-1.5 h-3.5 w-3.5" />Add</Button></div>
    {showAdd ? <div className="mt-4 space-y-2 rounded-xl border border-border bg-muted/30 p-3"><label className="grid gap-1 text-xs font-medium">Source title<Input value={title} onChange={(event) => setTitle(event.target.value)} /></label><label className="grid gap-1 text-xs font-medium">URL<Input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://" /></label><Button size="sm" disabled={saving || !title.trim() || !url.trim()} onClick={() => void addUrl()}>{saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}Save metadata</Button></div> : null}
    {loading ? <p className="mt-6 text-sm text-muted-foreground" role="status">Loading sources…</p> : null}
    {!loading && sources.length === 0 ? <div className="mt-8"><BookOpen className="h-5 w-5 text-primary" /><p className="mt-3 text-sm font-medium">No sources yet</p><p className="mt-1 text-sm leading-6 text-muted-foreground">Add a URL record here, or import a document from the project tools.</p></div> : null}
    <div className="mt-4 space-y-3">{sources.map((row) => {
      const basis = sourceBasis(row.source)
      const context: DockSourceContext = { workspaceSourceId: row.id, title: row.source.title, accessBasis: basis }
      const isSelected = selected.some((source) => source.workspaceSourceId === row.id)
      return <article key={row.id} className="rounded-xl border border-border bg-card p-3"><div className="flex items-start justify-between gap-2"><div><h3 className="text-sm font-medium leading-5">{row.source.title}</h3><p className="mt-1 text-xs text-muted-foreground">{basis === 'extracted_text' ? 'Extracted text available' : basis === 'manual_excerpt' ? 'Researcher-supplied excerpt' : basis === 'abstract' ? 'Abstract available' : basis === 'transcript' ? 'Transcript available' : 'Metadata only, not read by CogDoc'}</p></div><Button size="sm" variant={isSelected ? 'secondary' : 'outline'} onClick={() => onSelected(isSelected ? selected.filter((source) => source.workspaceSourceId !== row.id) : [...selected, context])}>{isSelected ? 'Chosen' : 'Use'}</Button></div><div className="mt-3 flex gap-3"><button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => onOpenSource(context)}>Open source</button>{row.source.canonicalUrl ? <a className="text-xs text-muted-foreground hover:text-foreground" href={row.source.canonicalUrl} target="_blank" rel="noreferrer">Open record</a> : null}</div></article>
    })}</div>
    {error ? <p className="mt-3 text-sm text-destructive" role="alert">{error}</p> : null}
  </div>
}

export default function DocumentResearchDock(props: DocumentResearchDockProps) {
  const { onSectionChange, onRefresh } = props
  const [internalSection, setInternalSection] = useState(props.initialSection ?? 'collaborator')
  const section = props.activeSection ?? internalSection
  const [chosenSources, setChosenSources] = useState<DockSourceContext[]>(props.selectedSources ?? [])
  const [findingProposal, setFindingProposal] = useState<FindingDraftProposal | null>(null)
  const [planProposal, setPlanProposal] = useState<InvestigationPlanProposal | null>(null)
  const [selectionHandoff, setSelectionHandoff] = useState<{ id: string; text: string } | undefined>()
  const setActiveSection = useCallback((next: typeof section) => {
    setInternalSection(next); onSectionChange?.(next)
  }, [onSectionChange])
  const onPlanReady = useCallback(() => onRefresh?.(), [onRefresh])
  const conversationProps = useMemo(() => ({ ...props, selectedSources: chosenSources, onSelectedSourcesChange: setChosenSources }), [chosenSources, props])

  return <aside className="flex h-full min-h-[32rem] w-full min-w-0 flex-col overflow-hidden border-l border-border bg-background text-foreground" aria-label="Document research tools">
    <div className="flex items-center gap-1 border-b border-border px-2 py-2"><Button type="button" size="icon" variant="ghost" className="h-8 w-8 md:hidden" onClick={props.onFocusDocument} aria-label="Return to document"><ChevronLeft className="h-4 w-4" /></Button><div className="min-w-0 flex-1 overflow-x-auto"><div className="flex min-w-max gap-1" role="tablist" aria-label="Research tools">{sections.map((item) => <button key={item.id} type="button" role="tab" aria-selected={section === item.id} onClick={() => setActiveSection(item.id)} className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${section === item.id ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}><item.icon className="h-3.5 w-3.5" />{item.label}</button>)}</div></div><Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={props.onFocusDocument} aria-label="Close research tools"><PanelRightClose className="h-4 w-4" /></Button></div>
    <div role="tabpanel" hidden={section !== 'collaborator'} className="contents"><ConversationPanel props={conversationProps} onOpenSection={(next) => setActiveSection(next)} onFindingProposal={setFindingProposal} onPlanProposal={setPlanProposal} /></div>
    <div role="tabpanel" hidden={section !== 'sources'} className="contents"><SourcesPanel projectId={props.projectId} selected={chosenSources} onSelected={setChosenSources} onOpenSource={props.onOpenSource} /></div>
    <div role="tabpanel" hidden={section !== 'findings'} className="min-h-0 flex-1 overflow-y-auto">{props.documentSelection ? <div className="mx-4 mt-4 flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 p-3"><p className="line-clamp-2 text-xs leading-5 text-muted-foreground">Use the selected document passage as your explanation without retyping it.</p><Button size="sm" variant="outline" className="shrink-0" onClick={() => setSelectionHandoff({ id: props.documentSelection!.selectionId, text: props.documentSelection!.exactText })}>Use selection</Button></div> : null}<ManualFindingPanel projectId={props.projectId} initialExplanation={selectionHandoff} initialProposal={findingProposal ?? undefined} /><FindingsWorkspace projectId={props.projectId} onOpenFinding={() => setActiveSection('findings')} onInsertFinding={props.documentState ? (finding) => { const revision = finding.revisions[0]; if (!revision?.conclusion) return; props.onRequestPreview({ kind: 'document_insertion', id: `finding-insert:${revision.id}`, content: revision.conclusion, reason: `Insert the chosen finding for ${finding.question.wording}.`, documentId: props.documentState!.documentId, expectedDocumentRevision: props.documentState!.documentRevision, sourceIds: (revision.evidences ?? []).flatMap((evidence) => evidence.workspaceSourceId ? [evidence.workspaceSourceId] : []), findingRevisionId: revision.id }) } : undefined} /></div>
    <div role="tabpanel" hidden={section !== 'plan'} className="min-h-0 flex-1 overflow-y-auto"><InvestigationPlanPanel projectId={props.projectId} onReady={onPlanReady} initialProposal={planProposal ?? undefined} /></div>
    <div role="tabpanel" hidden={section !== 'share'} className="min-h-0 flex-1 overflow-y-auto p-4"><div className="mb-4"><h2 className="text-sm font-semibold">Share and compose</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Export the working document or compose a separate article artifact. Nothing publishes automatically.</p><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="outline" asChild><a href={`/api/projects/${encodeURIComponent(props.projectId)}/export`}>Export document</a></Button>{props.onOpenShare ? <Button size="sm" variant="ghost" onClick={props.onOpenShare}>Open share view</Button> : null}</div></div><ArticleWorkspace projectId={props.projectId} /></div>
  </aside>
}

export { DocumentResearchDock }
