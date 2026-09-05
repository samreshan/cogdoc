'use client'

import { useEffect, useState } from 'react'
import { BookOpen, FileText, Lightbulb, ListChecks, PenLine, Search } from 'lucide-react'
import type { Project, ResearchWorkspaceSnapshot } from '@/lib/types'
import { api } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { RefinedWorkspaceShell, ResearchPageHeading } from '@/components/cogdoc/refined-ui'
import InvestigationPlanPanel from './investigation-plan-panel'
import ManualFindingPanel from './manual-finding-panel'
import SourceMapper from './source-mapper'
import { ArticleWorkspace } from './article-workspace'
import FindingsWorkspace from './findings-workspace'

type Section = 'overview' | 'investigate' | 'findings' | 'sources' | 'write'

export default function CollaboratorWorkspace({ project, data, onRefresh, onBack, onOpenLegacy }: {
  project: Project
  data: ResearchWorkspaceSnapshot | null
  onRefresh: () => void
  onBack: () => void
  onOpenLegacy: () => void
}) {
  const [section, setSection] = useState<Section>('overview')
  const [findingCount, setFindingCount] = useState(0)
  const [articleEnabled, setArticleEnabled] = useState(false)

  useEffect(() => {
    let active = true
    void api.getFindingJourney(project.id).then((journey) => {
      if (active) { setFindingCount(journey.findings.length); setArticleEnabled(Boolean(journey.articleEnabled)) }
    }).catch(() => { if (active) { setFindingCount(0); setArticleEnabled(false) } })
    return () => { active = false }
  }, [project.id, section])

  const navigation = [
    { id: 'overview', label: 'Overview', icon: Lightbulb },
    { id: 'investigate', label: 'Investigate', icon: Search },
    { id: 'findings', label: 'Findings', icon: ListChecks, count: findingCount },
    { id: 'sources', label: 'Sources', icon: BookOpen },
    { id: 'write', label: 'Write', icon: PenLine, disabled: !articleEnabled },
  ]

  const heading = section === 'overview'
    ? { title: 'Continue your research', description: 'Choose a question, inspect a source, explain what it means, and keep a finding when it reflects your view.' }
    : section === 'investigate'
      ? { title: 'Investigate a question', description: 'Sources and your explanation stay connected. Help is optional and never replaces your reasoning.' }
      : section === 'findings'
        ? { title: 'Your findings', description: 'A review records your choice about one revision, not a verdict on truth or completion.' }
        : section === 'sources'
          ? { title: 'Sources', description: 'Inspect available material before relying on it. Metadata and unavailable text remain clearly labelled.' }
          : { title: 'Write from reviewed findings', description: 'Articles are optional, separate artifacts. They never publish automatically.' }

  return <RefinedWorkspaceShell
    workspaceTitle={project.title}
    projectLabel="Research workspace"
    navigation={navigation}
    activeNavigationId={section}
    onNavigationChange={(value) => setSection(value as Section)}
    onBack={onBack}
    topActions={<Button type="button" variant="outline" size="sm" onClick={onOpenLegacy}><FileText className="mr-2 h-4 w-4" />Existing writing</Button>}
  >
    <ResearchPageHeading eyebrow="Cogdoc research collaborator" title={heading.title} description={heading.description} />
    {section === 'overview' ? <div className="space-y-5"><div className="grid gap-3 rounded-xl border border-violet-100 bg-violet-50/50 p-5 md:grid-cols-[1fr_auto]"><div><h3 className="text-base font-semibold text-slate-900">Start with the question in front of you</h3><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">You can stop with structured findings. Writing an article is optional after you explicitly review the findings you select.</p></div><Button type="button" onClick={() => setSection('investigate')}>Continue investigating</Button></div><ManualFindingPanel projectId={project.id} /></div> : null}
    {section === 'investigate' ? <div className="grid gap-5 xl:grid-cols-[minmax(18rem,.72fr)_minmax(0,1.28fr)]"><InvestigationPlanPanel projectId={project.id} onReady={() => void api.getFindingJourney(project.id).then((journey) => setArticleEnabled(Boolean(journey.articleEnabled))).catch(() => setArticleEnabled(false))} /><ManualFindingPanel projectId={project.id} /></div> : null}
    {section === 'findings' ? <FindingsWorkspace projectId={project.id} onOpenFinding={() => setSection('investigate')} /> : null}
    {section === 'sources' ? <div className="min-h-[32rem] overflow-hidden rounded-xl border border-slate-200 bg-white"><SourceMapper project={project} data={data} onRefresh={onRefresh} /></div> : null}
    {section === 'write' ? <ArticleWorkspace projectId={project.id} /> : null}
  </RefinedWorkspaceShell>
}
