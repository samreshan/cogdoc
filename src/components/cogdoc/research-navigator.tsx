'use client'

import { BookOpen, FileText, Home, ListChecks, MessageSquareText, MoreHorizontal, PanelLeftClose, PenLine, Route } from 'lucide-react'
import type { Project, ResearchQuestionSummary } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

export type WorkspaceSection = 'collaborator' | 'sources' | 'findings' | 'plan' | 'share'

interface ResearchNavigatorProps {
  project: Project
  questions: ResearchQuestionSummary[]
  activeQuestionId?: string | null
  activeSection: WorkspaceSection | null
  onHome: () => void
  onSectionChange: (section: WorkspaceSection) => void
  onQuestionChange: (question: ResearchQuestionSummary) => void
  onCollapse: () => void
  onOpenHistory: () => void
  onOpenReferences: () => void
}

const sections = [
  { id: 'collaborator' as const, label: 'Collaborator', icon: MessageSquareText },
  { id: 'sources' as const, label: 'Sources', icon: BookOpen },
  { id: 'findings' as const, label: 'Findings', icon: ListChecks },
  { id: 'plan' as const, label: 'Plan', icon: Route },
  { id: 'share' as const, label: 'Share', icon: PenLine },
]

export default function ResearchNavigator({ project, questions, activeQuestionId, activeSection, onHome, onSectionChange, onQuestionChange, onCollapse, onOpenHistory, onOpenReferences }: ResearchNavigatorProps) {
  const visibleQuestions = questions.filter((question) => question.state !== 'archived').slice(0, 6)

  return <nav className="flex h-full min-h-0 w-[13.5rem] flex-col bg-[var(--cog-rail)] px-3 py-3 text-[var(--cog-rail-foreground)]" aria-label="Project workspace">
    <div className="flex h-11 items-center justify-between px-1">
      <button type="button" onClick={onHome} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold tracking-[-0.02em] outline-none transition-colors hover:bg-white/8 focus-visible:ring-2 focus-visible:ring-[var(--cog-accent)]">
        <span className="grid h-6 w-6 place-items-center rounded-[0.45rem] border border-white/35"><span className="h-2.5 w-2.5 rounded-[0.2rem] bg-[var(--cog-accent)]" /></span>
        cogdoc
      </button>
      <Button type="button" variant="ghost" size="icon" onClick={onCollapse} className="h-8 w-8 text-white/55 hover:bg-white/8 hover:text-white" aria-label="Collapse project rail"><PanelLeftClose className="h-4 w-4" /></Button>
    </div>

    <div className="mt-5 min-h-0 flex-1 overflow-y-auto">
      <p className="px-3 text-[11px] font-medium text-white/42">Project</p>
      <div className="mt-2 flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5">
        <FileText className="h-4 w-4 shrink-0 text-white/55" />
        <span className="min-w-0 flex-1 truncate text-sm text-white/90">{project.title}</span>
      </div>

      <div className="mt-4 space-y-1">
        {sections.map(({ id, label, icon: Icon }) => <button key={id} type="button" data-demo-target={`nav-${id}`} onClick={() => onSectionChange(id)} aria-current={activeSection === id ? 'page' : undefined} className={`relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--cog-accent)] ${activeSection === id ? 'bg-white/10 text-white' : 'text-white/62 hover:bg-white/[0.06] hover:text-white'}`}>
          {activeSection === id && <span className="absolute -left-3 top-2 bottom-2 w-0.5 rounded-full bg-[var(--cog-accent)]" />}
          <Icon className="h-4 w-4" /><span>{label}</span>
        </button>)}
      </div>

      <section className="mt-7" aria-labelledby="outline-label">
        <div className="flex items-center justify-between px-3">
          <p id="outline-label" className="text-[11px] font-medium text-white/42">Questions</p>
          <span className="text-[11px] tabular-nums text-white/35">{questions.filter((question) => question.state !== 'archived').length}</span>
        </div>
        <div className="mt-2 space-y-0.5">
          {visibleQuestions.map((question, index) => <button key={question.id} type="button" onClick={() => onQuestionChange(question)} className={`group flex w-full items-start gap-2 rounded-md px-3 py-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--cog-accent)] ${activeQuestionId === question.id ? 'bg-white/[0.07] text-white' : 'text-white/48 hover:bg-white/[0.05] hover:text-white/80'}`}>
            <span className="mt-0.5 font-mono text-[10px] tabular-nums text-white/30">{String(index + 1).padStart(2, '0')}</span>
            <span className="line-clamp-2 text-xs leading-4">{question.wording}</span>
          </button>)}
          {!visibleQuestions.length && <button type="button" onClick={() => onSectionChange('plan')} className="w-full rounded-md px-3 py-2 text-left text-xs leading-5 text-white/42 hover:bg-white/[0.05] hover:text-white/70">Add a question when it helps you focus.</button>}
        </div>
      </section>
    </div>

    <div className="border-t border-white/10 pt-3">
      <button type="button" onClick={onHome} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/58 hover:bg-white/[0.06] hover:text-white"><Home className="h-4 w-4" />All projects</button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><button type="button" className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/58 hover:bg-white/[0.06] hover:text-white"><MoreHorizontal className="h-4 w-4" />More</button></DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="end" className="w-48">
          <DropdownMenuItem onClick={onOpenReferences}>References</DropdownMenuItem>
          <DropdownMenuItem onClick={onOpenHistory}>History</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled>Project settings</DropdownMenuItem>
          {project.workspaceType === 'assignment' && <DropdownMenuItem disabled>Legacy assignment review</DropdownMenuItem>}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </nav>
}
