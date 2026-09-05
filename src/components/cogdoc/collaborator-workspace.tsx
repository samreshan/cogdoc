'use client'

import { X } from 'lucide-react'
import type { DocumentDockProps } from '@/lib/document-workspace-contract'
import { Button } from '@/components/ui/button'
import InvestigationPlanPanel from './investigation-plan-panel'
import ManualFindingPanel from './manual-finding-panel'
import SourceMapper from './source-mapper'
import FindingsWorkspace from './findings-workspace'
import { ArticleWorkspace } from './article-workspace'

const labels = {
  collaborator: ['Collaborator', 'Ask a question or work through the selected passage.'],
  sources: ['Sources', 'Find material and inspect what is actually available.'],
  findings: ['Findings', 'Keep conclusions, evidence, and uncertainty together.'],
  plan: ['Plan', 'Shape questions when they help you decide what to do next.'],
  share: ['Share', 'Export this document or work with a separate article artifact.'],
} satisfies Record<DocumentDockProps['activeSection'], [string, string]>

export default function CollaboratorWorkspace(props: DocumentDockProps) {
  const [title, description] = labels[props.activeSection]

  return <aside className="flex h-full min-h-0 w-full flex-col border-l border-[var(--cog-border)] bg-[var(--cog-paper)]" aria-label={`${title} dock`}>
    <header className="flex min-h-[4.5rem] items-start justify-between gap-4 border-b border-[var(--cog-border)] px-5 py-4">
      <div><h2 className="text-sm font-semibold tracking-[-0.01em] text-[var(--cog-foreground)]">{title}</h2><p className="mt-1 text-xs leading-5 text-[var(--cog-muted-foreground)]">{description}</p></div>
      <Button type="button" variant="ghost" size="icon" onClick={props.onClose} className="h-8 w-8 shrink-0" aria-label={`Close ${title}`}><X className="h-4 w-4" /></Button>
    </header>
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      {props.activeSection === 'collaborator' && <ManualFindingPanel projectId={props.projectId} />}
      {props.activeSection === 'sources' && <SourceMapper project={props.project} data={props.snapshot} onRefresh={props.onRefresh} />}
      {props.activeSection === 'findings' && <FindingsWorkspace projectId={props.projectId} onOpenFinding={() => props.onSectionChange('collaborator')} />}
      {props.activeSection === 'plan' && <InvestigationPlanPanel projectId={props.projectId} />}
      {props.activeSection === 'share' && <ArticleWorkspace projectId={props.projectId} />}
    </div>
  </aside>
}
