'use client'

import { useMemo, useState } from 'react'
import { AlertCircle, CheckSquare, ChevronDown, ChevronRight, FileOutput, FileText, History, Library, Link2, ListTree, MessageCircleQuestion, NotebookPen, Quote, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCogdoc } from '@/lib/store'
import type { IDEWorkspaceTab, Project, ResearchEntityKind, ResearchWorkspaceSnapshot } from '@/lib/types'
import { documentOutlineFromStoredContent } from '@/lib/document-outline'
import { quoteForResearchAction } from '@/lib/research-document-anchors'
import { dedupeInterventionsByPhrase } from '@/lib/intervention-dedupe'
import { interventionQuestion } from '@/lib/intervention-language'

interface Props { project: Project; data: ResearchWorkspaceSnapshot | null; loading: boolean; onRefresh: () => void }

export default function ResearchNavigator({ project, data, loading, onRefresh }: Props) {
  const openIdeTab = useCogdoc((state) => state.openIdeTab)
  const selectResearchEntity = useCogdoc((state) => state.selectResearchEntity)
  const focusEditorText = useCogdoc((state) => state.focusEditorText)
  const focusEditorOutline = useCogdoc((state) => state.focusEditorOutline)
  const activeInterventions = useCogdoc((state) => state.activeInterventions)
  const [expanded, setExpanded] = useState(() => new Set(['outline', 'guidance']))
  const outline = useMemo(() => documentOutlineFromStoredContent(project.document?.content), [project.document?.content])
  const visibleActions = data?.actions.filter((action) => action.state === 'open') ?? []
  const visibleInterventions = dedupeInterventionsByPhrase(activeInterventions)
    .filter((item) => item.status === 'active' && Boolean(item.promptText?.trim()))
  const historyCount = (data?.historyCounts?.decisions ?? 0) + (data?.historyCounts?.interventions ?? project._count.interventions)

  function show(tab: IDEWorkspaceTab, kind?: ResearchEntityKind, entityId?: string) {
    openIdeTab(tab)
    if (kind) selectResearchEntity(kind, entityId)
  }

  function toggle(id: string) {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function showHeading(headingId: string) {
    show({ id: 'document', kind: 'document', label: 'Working document', closable: false }, 'document')
    focusEditorOutline(headingId)
  }

  function showPassage(quote: string, kind: ResearchEntityKind, entityId: string) {
    show({ id: 'document', kind: 'document', label: 'Working document', closable: false }, kind, entityId)
    focusEditorText(quote)
  }

  return <nav className="research-pane h-full min-h-0 overflow-y-auto border-r border-[#e5e1d8] bg-[#fbfaf7]" aria-label="Project navigator">
    <header className="sticky top-0 z-10 flex items-start justify-between border-b border-[#e5e1d8] bg-[#fbfaf7]/95 px-4 pb-4 pt-5 backdrop-blur">
      <div className="min-w-0"><p className="text-[10px] font-medium text-stone-500">Project navigator</p><p className="mt-1 truncate font-serif text-base font-semibold tracking-[-0.01em] text-[#252a27]">Research workspace</p></div>
      <Button size="icon" variant="ghost" className="-mr-1 h-7 w-7 text-stone-400 hover:bg-[#f0eee8] hover:text-stone-700" onClick={onRefresh} aria-label="Refresh project navigator"><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin motion-reduce:animate-none' : ''}`} /></Button>
    </header>

    <div className="px-3 py-4">
      <button onClick={() => show({ id: 'document', kind: 'document', label: 'Working document', closable: false }, 'document')} className="group flex w-full items-center gap-3 border border-[#e5e1d8] bg-white px-3 py-3 text-left transition-colors hover:border-[#cbc5b9] hover:bg-[#fdfcf9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#386c5c]">
        <FileText className="h-4 w-4 shrink-0 text-[#386c5c]" /><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-stone-800">{project.title}</span><span className="mt-0.5 block text-[10px] text-stone-500">Working document</span></span><ChevronRight className="h-3.5 w-3.5 text-stone-300 transition-transform group-hover:translate-x-0.5" />
      </button>

      <div className="mt-6 space-y-7">
        <NavigatorGroup label="Document">
          <Disclosure icon={ListTree} label="Outline" count={outline.length} open={expanded.has('outline')} onToggle={() => toggle('outline')}>
            {outline.length ? <div className="pb-1 pt-1">{outline.map((item) => <a key={item.id} href={`#${item.id}`} onClick={() => showHeading(item.id)} className={`group flex w-full items-center gap-2 py-1.5 pr-2 text-left transition-colors hover:text-[#28594a] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#386c5c] ${item.level === 1 ? 'text-[12px] font-semibold text-stone-800' : item.level === 2 ? 'text-[11px] font-medium text-stone-600' : 'text-[10px] text-stone-500'}`} style={{ paddingLeft: `${0.7 + item.level * 0.65}rem` }}><span className="min-w-0 flex-1 truncate">{item.label}</span><span className="font-mono text-[8px] text-stone-300 opacity-0 transition-opacity group-hover:opacity-100">H{item.level}</span></a>)}</div> : <Empty label="Add a heading to begin the outline." />}
          </Disclosure>
        </NavigatorGroup>

        <NavigatorGroup label="In focus">
          <Disclosure icon={CheckSquare} label="Guidance" count={visibleActions.length + visibleInterventions.length} open={expanded.has('guidance')} onToggle={() => toggle('guidance')}>
            <div className="space-y-1 pb-1 pt-1">
              {visibleActions.slice(0, 3).map((action) => {
                const quote = quoteForResearchAction(action)
                return <button key={action.id} onClick={() => quote ? showPassage(quote, 'action', action.id) : show({ id: 'actions', kind: 'actions', label: 'Next actions', closable: true }, 'action', action.id)} className="group flex w-full items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-[#f2f0ea] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#386c5c]"><AlertCircle className={`mt-0.5 h-3 w-3 shrink-0 ${action.pinned ? 'text-[#9a5b32]' : 'text-stone-400'}`} /><span className="min-w-0 flex-1"><span className="line-clamp-2 text-[11px] leading-4 text-stone-700">{action.title}</span><span className="mt-0.5 block font-mono text-[8px] text-stone-400">priority {action.priority}</span></span></button>
              })}
              {visibleInterventions.slice(0, 3).map((item) => <button key={item.id} onClick={() => showPassage(item.promptText ?? '', 'document', item.id)} className="flex w-full items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-[#f2f0ea] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#386c5c]"><MessageCircleQuestion className="mt-0.5 h-3 w-3 shrink-0 text-[#956a44]" /><span className="min-w-0 flex-1"><span className="line-clamp-2 text-[11px] leading-4 text-stone-700">{interventionQuestion(item)}</span><span className="mt-0.5 block text-[9px] text-stone-400">Question in your document</span></span></button>)}
              {!visibleActions.length && !visibleInterventions.length && <Empty label="Nothing needs your attention right now." />}
              {(visibleActions.length > 3 || visibleInterventions.length > 3) && <button onClick={() => show({ id: 'actions', kind: 'actions', label: 'Next actions', closable: true })} className="ml-3 mt-1 text-[10px] font-medium text-[#386c5c] hover:underline">View all guidance</button>}
            </div>
          </Disclosure>
        </NavigatorGroup>

        <NavigatorGroup label="Research">
          <NavRow icon={Library} label="Sources" description="Search and map passages" count={data?.sources.length ?? 0} onClick={() => show({ id: 'sources', kind: 'sources', label: 'Source mapper', closable: true }, 'source')} />
          <NavRow icon={NotebookPen} label="Notebook" description="Linked notes and excerpts" count={data?.notes.length ?? 0} onClick={() => show({ id: 'notebook', kind: 'notebook', label: 'Notebook', closable: true }, 'note')} />
          <NavRow icon={Link2} label="Evidence map" description="Claims and support" count={data?.claims.length ?? 0} onClick={() => show({ id: 'evidence', kind: 'evidence', label: 'Evidence map', closable: true }, 'claim')} />
          <NavRow icon={Quote} label="References" description="Verified citation records" count={data?.references.length ?? 0} onClick={() => show({ id: 'references', kind: 'references', label: 'References', closable: true }, 'reference')} />
        </NavigatorGroup>

        <NavigatorGroup label="Project">
          <NavRow icon={History} label="History" description="Decisions and interventions" count={historyCount} onClick={() => show({ id: 'history:decisions', kind: 'history', label: 'History', closable: true }, 'history')} />
          <NavRow icon={FileOutput} label="Writing & export" description="Profile and downloads" count={data?.jobs.length ?? 0} onClick={() => show({ id: 'exports', kind: 'exports', label: 'Writing & export', closable: true }, 'export')} />
        </NavigatorGroup>
      </div>
    </div>
  </nav>
}

function NavigatorGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return <section><h2 className="mb-2 px-1 text-[10px] font-medium tracking-[0.02em] text-stone-400">{label}</h2><div className="space-y-0.5">{children}</div></section>
}

function Disclosure({ icon: Icon, label, count, open, onToggle, children }: { icon: typeof ListTree; label: string; count: number; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return <div><button onClick={onToggle} className="flex w-full items-center gap-2.5 px-2 py-2 text-left transition-colors hover:bg-[#f2f0ea] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#386c5c]" aria-expanded={open}><Icon className="h-3.5 w-3.5 text-stone-500" /><span className="min-w-0 flex-1 text-[11px] font-medium text-stone-700">{label}</span>{count > 0 && <Count value={count} />}{open ? <ChevronDown className="h-3 w-3 text-stone-400" /> : <ChevronRight className="h-3 w-3 text-stone-400" />}</button>{open && children}</div>
}

function Empty({ label }: { label: string }) { return <p className="px-3 py-2 text-[10px] leading-4 text-stone-400">{label}</p> }

function Count({ value }: { value: number }) { return <span className="min-w-5 bg-[#f0eee9] px-1.5 py-0.5 text-center font-mono text-[8px] tabular-nums text-stone-500">{value}</span> }

function NavRow({ icon: Icon, label, description, count, onClick }: { icon: typeof Library; label: string; description: string; count: number; onClick: () => void }) {
  return <button onClick={onClick} className="group flex w-full items-center gap-2.5 px-2 py-2.5 text-left transition-colors hover:bg-[#f2f0ea] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#386c5c]"><Icon className="h-3.5 w-3.5 shrink-0 text-stone-500 group-hover:text-[#386c5c]" /><span className="min-w-0 flex-1"><span className="block text-[11px] font-medium text-stone-700">{label}</span><span className="mt-0.5 block truncate text-[9px] text-stone-400">{description}</span></span>{count > 0 && <Count value={count} />}</button>
}
