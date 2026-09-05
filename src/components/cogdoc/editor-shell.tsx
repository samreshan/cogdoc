'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, BookOpen, Download, EyeOff, FileCode, FileText, FileType, Focus, Loader2, Menu, PanelLeftOpen } from 'lucide-react'
import { toast } from 'sonner'
import { useCogdoc } from '@/lib/store'
import { api } from '@/lib/api-client'
import type { ResearchContextSummary, ResearchQuestionSummary, ResearchWorkspaceSnapshot } from '@/lib/types'
import type { DockSourceContext, DocumentEditProposal, DocumentSelectionContext } from '@/lib/document-collaborator-contract'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import CollaboratorWorkspace from './collaborator-workspace'
import type { DocumentEditorHandle, DocumentEditorSelection } from './editor-tiptap'
import ResearchHistory from './research-history'
import ResearchLibrary from './research-library'
import ResearchNavigator, { type WorkspaceSection } from './research-navigator'
import ResearchWorkPane from './research-work-pane'

export default function EditorShell() {
  const project = useCogdoc((state) => state.activeProject)
  const setView = useCogdoc((state) => state.setView)
  const focusMode = useCogdoc((state) => state.focusMode)
  const toggleFocusMode = useCogdoc((state) => state.toggleFocusMode)
  const setResearchActions = useCogdoc((state) => state.setResearchActions)
  const libraryVersion = useCogdoc((state) => state.libraryVersion)
  const editorRef = useRef<DocumentEditorHandle>(null)
  const [snapshot, setSnapshot] = useState<ResearchWorkspaceSnapshot | null>(null)
  const [context, setContext] = useState<ResearchContextSummary | null>(null)
  const [questions, setQuestions] = useState<ResearchQuestionSummary[]>([])
  const [selection, setSelection] = useState<DocumentEditorSelection | null>(null)
  const [selectedSources, setSelectedSources] = useState<DockSourceContext[]>([])
  const [openSource, setOpenSource] = useState<DockSourceContext | null>(null)
  const [dockSection, setDockSection] = useState<WorkspaceSection | null>('collaborator')
  const [railVisible, setRailVisible] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [preview, setPreview] = useState<DocumentEditProposal | null>(null)
  const [secondary, setSecondary] = useState<'history' | 'references' | null>(null)

  const refresh = useCallback(async () => {
    if (!project) return
    const [workspaceResult, investigationResult] = await Promise.allSettled([
      api.getResearchWorkspace(project.id),
      api.getInvestigation(project.id),
    ])
    if (workspaceResult.status === 'fulfilled') {
      setSnapshot(workspaceResult.value)
      setResearchActions(workspaceResult.value.actions ?? [])
    }
    if (investigationResult.status === 'fulfilled') {
      setContext(investigationResult.value.context)
      setQuestions(investigationResult.value.questions)
    }
    const failures = [workspaceResult, investigationResult].filter((result) => result.status === 'rejected')
    setLoadError(failures.length === 2
      ? 'Research tools are unavailable. Your document and local recovery remain available.'
      : failures.length ? 'Some research context is unavailable.' : '')
  }, [project, setResearchActions])

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh() }, 0)
    return () => window.clearTimeout(timer)
  }, [refresh, libraryVersion])
  useEffect(() => {
    if (!project) return
    const timer = window.setTimeout(() => {
      const saved = window.localStorage.getItem(`cogdoc:document-workspace:${project.id}`)
      if (!saved) return
      try {
        const state = JSON.parse(saved) as { dockSection?: WorkspaceSection | null; railVisible?: boolean }
        if (state.dockSection === null || ['collaborator', 'sources', 'findings', 'plan', 'share'].includes(String(state.dockSection))) setDockSection(state.dockSection ?? null)
        if (typeof state.railVisible === 'boolean') setRailVisible(state.railVisible)
      } catch { /* keep the safe document-first defaults */ }
    }, 0)
    return () => window.clearTimeout(timer)
  }, [project?.id])
  useEffect(() => {
    if (!project) return
    window.localStorage.setItem(`cogdoc:document-workspace:${project.id}`, JSON.stringify({ dockSection, railVisible }))
  }, [dockSection, project?.id, railVisible])

  if (!project) return null
  const activeProject = project
  const selectedQuestion = questions.find((question) => question.id === context?.selectedQuestionId) ?? null
  const documentSelection: DocumentSelectionContext | null = selection && project.document ? {
    projectId: project.id,
    documentId: project.document.id,
    documentRevision: selection.documentRevision,
    from: selection.from,
    to: selection.to,
    exactText: selection.text,
    textFingerprint: selection.textFingerprint,
    selectionId: selection.selectionId,
  } : null

  function openDock(section: WorkspaceSection) {
    setDockSection((current) => current === section ? null : section)
  }

  async function selectQuestion(question: ResearchQuestionSummary) {
    if (!context || context.selectedQuestionId === question.id) return
    try {
      const result = await api.saveInvestigation(activeProject.id, { selectedQuestionId: question.id, expectedRevision: context.revision })
      setContext(result.context)
      setDockSection('collaborator')
    } catch (error) {
      toast.error('Could not change question', { description: (error as Error).message })
    }
  }

  async function applyProposal(request: {
    proposal: DocumentEditProposal
    expectedDocumentRevision: number
    expectedSelectionId?: string
  }) {
    const proposal = request.proposal
    if (proposal.kind === 'document_revision' && proposal.selection.projectId !== activeProject.id) return { applied: false as const, reason: 'rejected' as const }
    if (proposal.kind === 'document_insertion' && proposal.documentId !== activeProject.document?.id) return { applied: false as const, reason: 'rejected' as const }
    const result = editorRef.current?.applyDocumentRevision({
      replacement: proposal.kind === 'document_revision' ? proposal.replacement : proposal.content,
      expectedDocumentRevision: request.expectedDocumentRevision,
      expectedSelectionId: request.expectedSelectionId,
    })
    if (!result?.applied) return { applied: false as const, reason: result?.reason ?? 'rejected' as const }
    setPreview(null)
    return { applied: true as const }
  }

  function download(format: 'md' | 'html' | 'docx') {
    window.open(`/api/projects/${activeProject.id}/export?format=${format}`, '_blank', 'noopener,noreferrer')
  }

  const closeDock = () => {
    setDockSection(null)
    requestAnimationFrame(() => editorRef.current?.focus())
  }

  return <div className="relative flex h-[100dvh] min-h-0 overflow-hidden bg-[var(--cog-workspace)] text-[var(--cog-foreground)]">
    {!focusMode && railVisible && <div className="hidden shrink-0 lg:block">
      <ResearchNavigator
        project={project}
        questions={questions}
        activeQuestionId={selectedQuestion?.id}
        activeSection={dockSection}
        onHome={() => setView('dashboard')}
        onSectionChange={openDock}
        onQuestionChange={(question) => void selectQuestion(question)}
        onCollapse={() => setRailVisible(false)}
        onOpenHistory={() => setSecondary('history')}
        onOpenReferences={() => setSecondary('references')}
      />
    </div>}

    <div className="flex min-w-0 flex-1 flex-col">
      <header className="z-20 flex h-14 shrink-0 items-center justify-between gap-4 border-b border-[var(--cog-border)] bg-[var(--cog-paper)] px-3 sm:px-4" aria-label="Document toolbar">
        <div className="flex min-w-0 items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setView('dashboard')} className="h-9 w-9 lg:hidden" aria-label="Back to projects"><ArrowLeft className="h-4 w-4" /></Button>
          {!focusMode && !railVisible && <Button variant="ghost" size="icon" onClick={() => setRailVisible(true)} className="hidden h-9 w-9 lg:inline-flex" aria-label="Open project rail"><PanelLeftOpen className="h-4 w-4" /></Button>}
          <Button variant="ghost" size="icon" onClick={() => setDockSection('collaborator')} className="h-9 w-9 lg:hidden" aria-label="Open workspace tools"><Menu className="h-4 w-4" /></Button>
          <div className="min-w-0"><h1 className="max-w-56 truncate text-sm font-semibold tracking-[-0.015em] sm:max-w-md">{project.title}</h1><p className="hidden max-w-lg truncate text-xs text-[var(--cog-muted-foreground)] sm:block">Working document{selectedQuestion ? ` · ${selectedQuestion.wording}` : ''}</p></div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="icon" onClick={toggleFocusMode} className={`h-9 w-9 ${focusMode ? 'bg-[var(--cog-accent-soft)] text-[var(--cog-accent-strong)]' : ''}`} aria-label={focusMode ? 'Leave focus mode' : 'Enter focus mode'}>{focusMode ? <EyeOff className="h-4 w-4" /> : <Focus className="h-4 w-4" />}</Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Export working document"><Download className="h-4 w-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end"><DropdownMenuItem onClick={() => download('docx')}><FileType className="mr-2 h-4 w-4" />Word document</DropdownMenuItem><DropdownMenuItem onClick={() => download('md')}><FileText className="mr-2 h-4 w-4" />Markdown</DropdownMenuItem><DropdownMenuItem onClick={() => download('html')}><FileCode className="mr-2 h-4 w-4" />HTML</DropdownMenuItem></DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {loadError && <button type="button" onClick={() => void refresh()} className="shrink-0 border-b border-amber-300 bg-amber-50 px-4 py-2 text-left text-xs text-amber-900" role="status">{loadError} Retry research tools.</button>}

      <div className="relative flex min-h-0 flex-1">
        <div className="min-w-0 flex-1">
          <ResearchWorkPane editorRef={editorRef} onSelectionChange={setSelection} onOpenSources={(value) => { setSelection(value); setDockSection('sources') }} onOpenCollaborator={(value) => { setSelection(value); setDockSection('collaborator') }} />
        </div>
        {!focusMode && dockSection && <div className="hidden h-full w-[min(34rem,43vw)] shrink-0 xl:block">
          <CollaboratorWorkspace
            projectId={project.id}
            projectTitle={context?.topic || project.title}
            initialSection={dockSection}
            activeSection={dockSection}
            documentSelection={documentSelection}
            documentState={project.document ? { documentId: project.document.id, documentRevision: project.document.revision ?? 0 } : undefined}
            selectedQuestion={selectedQuestion ? { id: selectedQuestion.id, wording: selectedQuestion.wording, revision: selectedQuestion.revision } : null}
            selectedSources={selectedSources}
            onSelectedSourcesChange={setSelectedSources}
            onRequestPreview={setPreview}
            onApplyProposal={applyProposal}
            onOpenSource={setOpenSource}
            onFocusDocument={() => editorRef.current?.focus()}
            onClose={closeDock}
            onSectionChange={setDockSection}
            onRefresh={refresh}
          />
        </div>}
        {!focusMode && dockSection && <div className="absolute inset-0 z-30 bg-[var(--cog-paper)] xl:hidden">
          <CollaboratorWorkspace
            projectId={project.id}
            projectTitle={context?.topic || project.title}
            initialSection={dockSection}
            activeSection={dockSection}
            documentSelection={documentSelection}
            documentState={project.document ? { documentId: project.document.id, documentRevision: project.document.revision ?? 0 } : undefined}
            selectedQuestion={selectedQuestion ? { id: selectedQuestion.id, wording: selectedQuestion.wording, revision: selectedQuestion.revision } : null}
            selectedSources={selectedSources}
            onSelectedSourcesChange={setSelectedSources}
            onRequestPreview={setPreview}
            onApplyProposal={applyProposal}
            onOpenSource={setOpenSource}
            onFocusDocument={() => editorRef.current?.focus()}
            onClose={closeDock}
            onSectionChange={setDockSection}
            onRefresh={refresh}
          />
        </div>}
      </div>

      {!focusMode && <nav className="grid h-13 shrink-0 grid-cols-5 border-t border-[var(--cog-border)] bg-[var(--cog-paper)] xl:hidden" aria-label="Workspace tools">{(['collaborator', 'sources', 'findings', 'plan', 'share'] as const).map((section) => <button key={section} type="button" onClick={() => openDock(section)} aria-current={dockSection === section ? 'page' : undefined} className={`text-xs capitalize ${dockSection === section ? 'bg-[var(--cog-accent-soft)] font-medium text-[var(--cog-accent-strong)]' : 'text-[var(--cog-muted-foreground)]'}`}>{section}</button>)}</nav>}
    </div>

    <Dialog open={Boolean(preview)} onOpenChange={(open) => { if (!open) setPreview(null) }}>
      <DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Preview document change</DialogTitle><DialogDescription>This change applies only to the current document revision. CogDoc rejects it if the document or selected passage changed.</DialogDescription></DialogHeader>{preview && <div className="grid gap-4"><div className="rounded-lg bg-[var(--cog-workspace)] p-4"><p className="text-xs font-medium text-[var(--cog-muted-foreground)]">{preview.kind === 'document_revision' ? 'Current passage' : 'Insertion'}</p><p className="mt-2 font-serif text-base leading-7">{preview.kind === 'document_revision' ? preview.selection.exactText : 'Insert at your current cursor'}</p></div><div className="rounded-lg border border-[var(--cog-accent)]/25 bg-[var(--cog-accent-soft)] p-4"><p className="text-xs font-medium text-[var(--cog-accent-strong)]">Proposed wording</p><p className="mt-2 whitespace-pre-wrap font-serif text-base leading-7">{preview.kind === 'document_revision' ? preview.replacement : preview.content}</p><p className="mt-3 text-xs text-[var(--cog-muted-foreground)]">{preview.reason}</p></div><div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setPreview(null)}>Keep original</Button><Button onClick={() => void applyProposal({ proposal: preview, expectedDocumentRevision: preview.kind === 'document_revision' ? preview.selection.documentRevision : preview.expectedDocumentRevision, expectedSelectionId: preview.kind === 'document_revision' ? preview.selection.selectionId : undefined }).then((result) => { if (!result.applied) toast.error('Document changed', { description: result.reason === 'stale_revision' || result.reason === 'stale_selection' ? 'Select the passage again, then review the proposal.' : 'The proposal was not applied.' }) })}>Apply change</Button></div></div>}</DialogContent>
    </Dialog>

    <Dialog open={Boolean(openSource)} onOpenChange={(open) => { if (!open) { setOpenSource(null); requestAnimationFrame(() => editorRef.current?.focus()) } }}><DialogContent className="h-[min(50rem,calc(100dvh-2rem))] max-w-4xl overflow-hidden p-0"><DialogHeader className="sr-only"><DialogTitle>{openSource?.title || 'Source reader'}</DialogTitle><DialogDescription>Inspect available source passages and return to the document.</DialogDescription></DialogHeader>{openSource && <SourceReader key={openSource.workspaceSourceId} projectId={project.id} source={openSource} onChoose={(source) => { setSelectedSources((current) => [...current.filter((item) => item.workspaceSourceId !== source.workspaceSourceId), source]); setOpenSource(null); setDockSection('collaborator') }} />}</DialogContent></Dialog>

    <Dialog open={Boolean(secondary)} onOpenChange={(open) => { if (!open) setSecondary(null) }}><DialogContent className="h-[min(48rem,calc(100dvh-2rem))] max-w-5xl overflow-hidden p-0"><DialogHeader className="sr-only"><DialogTitle>{secondary === 'history' ? 'Project history' : 'References'}</DialogTitle><DialogDescription>Secondary project tools</DialogDescription></DialogHeader>{secondary === 'history' ? <ResearchHistory projectId={project.id} initialFilter="decisions" /> : <ResearchLibrary />}</DialogContent></Dialog>
  </div>
}

function SourceReader({ projectId, source, onChoose }: { projectId: string; source: DockSourceContext; onChoose: (source: DockSourceContext) => void }) {
  const [result, setResult] = useState<Awaited<ReturnType<typeof api.getResearchSource>> | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    void api.getResearchSource(projectId, source.workspaceSourceId).then(setResult).catch((reason) => setError((reason as Error).message))
  }, [projectId, source.workspaceSourceId])
  return <article className="flex h-full min-h-0 flex-col bg-[var(--cog-workspace)]"><header className="border-b border-[var(--cog-border)] bg-[var(--cog-paper)] px-6 py-5"><p className="text-xs font-medium text-[var(--cog-accent-strong)]">{source.accessBasis.replace('_', ' ')}</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.02em]">{source.title}</h2><p className="mt-1 text-sm text-[var(--cog-muted-foreground)]">Only available passages are shown. Approximate PDF pages remain labelled as approximate.</p></header><div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-7">{error ? <p className="text-sm text-[var(--cog-danger)]" role="alert">{error}</p> : !result ? <p className="flex items-center gap-2 text-sm text-[var(--cog-muted-foreground)]" role="status"><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />Loading available passages</p> : result.passages.length ? <div className="space-y-3">{result.passages.map((passage) => <button key={passage.id} type="button" onClick={() => onChoose({ ...source, passageId: passage.id, excerpt: passage.content, locator: `Approximate PDF page ${passage.pageApprox}`, accessBasis: 'extracted_text' })} className="block w-full rounded-xl border border-[var(--cog-border)] bg-[var(--cog-paper)] p-5 text-left outline-none transition hover:border-[var(--cog-accent)]/45 focus-visible:ring-2 focus-visible:ring-[var(--cog-accent)]"><span className="text-xs font-medium text-[var(--cog-accent-strong)]">Approximate PDF page {passage.pageApprox}</span><p className="mt-2 font-serif text-base leading-7">{passage.content}</p><span className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--cog-accent-strong)]"><BookOpen className="h-3.5 w-3.5" />Use this passage in collaborator context</span></button>)}</div> : <div><BookOpen className="h-5 w-5 text-[var(--cog-accent)]" /><p className="mt-3 text-sm font-medium">Full text is not available in CogDoc</p><p className="mt-1 text-sm leading-6 text-[var(--cog-muted-foreground)]">This record cannot be treated as an inspected passage. Add a lawful copy or researcher-supplied excerpt.</p></div>}</div></article>
}
