'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, BrainCircuit, Download, EyeOff, FileCode, FileText, FileType, Focus, PanelLeft, PanelRight, Search } from 'lucide-react'
import { useCogdoc } from '@/lib/store'
import { api } from '@/lib/api-client'
import type { ResearchWorkspaceSnapshot } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import AssistantStatus from './assistant-status'
import ReviewPaceSelector from './review-pace-selector'
import ResearchNavigator from './research-navigator'
import ResearchWorkPane from './research-work-pane'
import ResearchInspector from './research-inspector'
import { researchShortcutFor } from '@/lib/research-shortcuts'
import ResearchDialogue from './research-dialogue'

export default function EditorShell() {
  const project = useCogdoc((state) => state.activeProject)
  const setView = useCogdoc((state) => state.setView)
  const focusMode = useCogdoc((state) => state.focusMode)
  const toggleFocusMode = useCogdoc((state) => state.toggleFocusMode)
  const setFrictionMode = useCogdoc((state) => state.setFrictionMode)
  const navigatorVisible = useCogdoc((state) => state.navigatorVisible)
  const inspectorVisible = useCogdoc((state) => state.inspectorVisible)
  const toggleNavigator = useCogdoc((state) => state.toggleNavigator)
  const toggleInspector = useCogdoc((state) => state.toggleInspector)
  const showNavigator = useCogdoc((state) => state.showNavigator)
  const showInspector = useCogdoc((state) => state.showInspector)
  const mobilePane = useCogdoc((state) => state.mobilePane)
  const setMobilePane = useCogdoc((state) => state.setMobilePane)
  const openIdeTab = useCogdoc((state) => state.openIdeTab)
  const setResearchActions = useCogdoc((state) => state.setResearchActions)
  const libraryVersion = useCogdoc((state) => state.libraryVersion)
  const [data, setData] = useState<ResearchWorkspaceSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [dialogueOpen, setDialogueOpen] = useState(false)

  const refresh = useCallback(async () => {
    if (!project) return
    setLoading(true)
    try { setData(await api.getResearchWorkspace(project.id)); setLoadError('') }
    catch (error) { setLoadError((error as Error).message) }
    finally { setLoading(false) }
  }, [project])

  useEffect(() => { void refresh() }, [refresh, libraryVersion])
  useEffect(() => { setResearchActions(data?.actions ?? []) }, [data?.actions, setResearchActions])
  useEffect(() => {
    const mapping = { rapid: 'assistant', guided: 'coach', deep: 'socratic' } as const
    setFrictionMode(mapping[project?.reviewPace ?? 'deep'])
  }, [project?.reviewPace, setFrictionMode])

  useEffect(() => {
    function shortcuts(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      const editing = Boolean(target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? ''))
      const action = researchShortcutFor({
        key: event.key,
        code: event.code,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        editing,
      })
      if (!action) return
      event.preventDefault()
      event.stopPropagation()
      if (action === 'toggle-navigator') return toggleNavigator()
      if (action === 'toggle-inspector') return toggleInspector()
      const pane = action === 'focus-navigator' ? 'navigator' : action === 'focus-inspector' ? 'inspector' : 'work'
      if (pane === 'navigator') showNavigator()
      if (pane === 'inspector') showInspector()
      setMobilePane(pane)
      requestAnimationFrame(() => requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-ide-pane="${pane}"]`)?.focus()))
    }
    window.addEventListener('keydown', shortcuts, true)
    return () => window.removeEventListener('keydown', shortcuts, true)
  }, [setMobilePane, showInspector, showNavigator, toggleInspector, toggleNavigator])

  if (!project) return null
  const projectId = project.id
  const navigator = <div data-ide-pane="navigator" tabIndex={-1} className="h-full outline-none"><ResearchNavigator project={project} data={data} loading={loading} onRefresh={refresh} /></div>
  const work = <div data-ide-pane="work" tabIndex={-1} className="h-full outline-none"><ResearchWorkPane project={project} data={data} onRefresh={refresh} /></div>
  const inspector = <div data-ide-pane="inspector" tabIndex={-1} className="h-full outline-none"><ResearchInspector project={project} data={data} loading={loading} onRefresh={refresh} /></div>
  function download(format: 'md' | 'html' | 'docx') { window.open(`/api/projects/${projectId}/export?format=${format}`, '_blank') }

  return <div className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-[#f7f6f3] text-[#292d2b]">
    <header className="z-20 flex h-14 shrink-0 items-center justify-between gap-4 border-b border-[#e4e0d8] bg-[#fffefb] px-3 sm:px-4" aria-label="Research IDE toolbar">
      <div className="flex min-w-0 items-center gap-1.5"><Button variant="ghost" size="icon" onClick={() => setView('dashboard')} className="h-8 w-8 text-stone-500 hover:bg-[#f2f0ea]" aria-label="Back to projects"><ArrowLeft className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={toggleNavigator} className={`hidden h-8 w-8 lg:inline-flex ${navigatorVisible ? 'text-[#386c5c]' : 'text-stone-400'}`} aria-label={`${navigatorVisible ? 'Hide' : 'Show'} navigator`} title="Toggle navigator (Ctrl/⌘ Shift B)"><PanelLeft className="h-4 w-4" /></Button><div className="ml-1 min-w-0"><h1 className="max-w-48 truncate font-serif text-sm font-semibold tracking-[-0.01em] sm:max-w-sm">{project.title}</h1><p className="hidden text-[9px] text-stone-400 sm:block">Research project</p></div></div>
      <div className="flex shrink-0 items-center gap-1"><div className="hidden items-center gap-1 xl:flex"><AssistantStatus /><ReviewPaceSelector /></div><Button variant="outline" size="sm" onClick={() => setDialogueOpen(true)} className="h-8 border-[#d9d4ca] bg-white px-2.5 text-[11px] text-[#28594a] hover:bg-[#f4f2ed]"><BrainCircuit className="mr-1.5 h-3.5 w-3.5" />Think with Cogdoc</Button><Button variant="ghost" size="icon" onClick={() => openIdeTab({ id: 'sources', kind: 'sources', label: 'Sources', closable: true })} className="hidden h-8 w-8 text-stone-500 sm:inline-flex" aria-label="Open source mapper" title="Sources"><Search className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="icon" onClick={toggleFocusMode} className={`h-8 w-8 ${focusMode ? 'bg-[#f2eee5] text-[#8a552d]' : 'text-stone-500'}`} aria-label="Toggle focus mode" title="Focus mode">{focusMode ? <EyeOff className="h-3.5 w-3.5" /> : <Focus className="h-3.5 w-3.5" />}</Button><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-stone-500" aria-label="Export research document"><Download className="h-3.5 w-3.5" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => download('docx')}><FileType className="mr-2 h-4 w-4" />Word document</DropdownMenuItem><DropdownMenuItem onClick={() => download('md')}><FileText className="mr-2 h-4 w-4" />Markdown</DropdownMenuItem><DropdownMenuItem onClick={() => download('html')}><FileCode className="mr-2 h-4 w-4" />HTML</DropdownMenuItem></DropdownMenuContent></DropdownMenu><Button variant="ghost" size="icon" onClick={toggleInspector} className={`hidden h-8 w-8 lg:inline-flex ${inspectorVisible ? 'text-[#386c5c]' : 'text-stone-400'}`} aria-label={`${inspectorVisible ? 'Hide' : 'Show'} inspector`} title="Toggle inspector (Ctrl/⌘ Shift I)"><PanelRight className="h-4 w-4" /></Button></div>
    </header>
    {loadError && <button onClick={refresh} className="shrink-0 border-b border-amber-300 bg-amber-50 px-3 py-1.5 text-center text-[10px] text-amber-900">Research index unavailable: {loadError}. Existing editor features remain usable. Click to retry.</button>}
    <div className="hidden min-h-0 flex-1 lg:block"><ResizablePanelGroup direction="horizontal" autoSaveId={`cogdoc-research-ide:${project.id}`}>{navigatorVisible && <><ResizablePanel id="navigator" order={1} defaultSize={18} minSize={15} maxSize={27}>{navigator}</ResizablePanel><ResizableHandle withHandle className="bg-[#e4e0d8] hover:bg-[#a8bbb4] focus-visible:ring-[#386c5c]" /></>}<ResizablePanel id="work" order={2} defaultSize={59} minSize={38}>{work}</ResizablePanel>{inspectorVisible && <><ResizableHandle withHandle className="bg-[#e4e0d8] hover:bg-[#a8bbb4] focus-visible:ring-[#386c5c]" /><ResizablePanel id="inspector" order={3} defaultSize={23} minSize={19} maxSize={34}>{inspector}</ResizablePanel></>}</ResizablePanelGroup></div>
    <div className="min-h-0 flex-1 lg:hidden">{mobilePane === 'navigator' ? navigator : mobilePane === 'inspector' ? inspector : work}</div>
    <nav className="grid h-12 shrink-0 grid-cols-3 border-t border-[#e4e0d8] bg-[#fffefb] lg:hidden" aria-label="Focused pane switcher"><MobilePane active={mobilePane === 'navigator'} icon={PanelLeft} label="Navigator" onClick={() => setMobilePane('navigator')} /><MobilePane active={mobilePane === 'work'} icon={FileText} label="Work" onClick={() => setMobilePane('work')} /><MobilePane active={mobilePane === 'inspector'} icon={PanelRight} label="Inspector" onClick={() => setMobilePane('inspector')} /></nav>
    <ResearchDialogue open={dialogueOpen} onOpenChange={setDialogueOpen} project={project} />
  </div>
}

function MobilePane({ active, icon: Icon, label, onClick }: { active: boolean; icon: typeof PanelLeft; label: string; onClick: () => void }) { return <button onClick={onClick} aria-current={active ? 'page' : undefined} className={`flex items-center justify-center gap-1.5 border-r border-[#e8e4dc] text-[10px] font-medium last:border-0 ${active ? 'bg-[#f0f3f0] text-[#28594a]' : 'text-stone-500'}`}><Icon className="h-3.5 w-3.5" />{label}</button> }
