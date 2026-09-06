'use client'

import { useRef, useState } from 'react'
import { ArrowRight, ChevronDown, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import type { Project } from '@/lib/types'
import type { CitationStyle } from '@/lib/workspace'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { automaticallyDiscoverSources } from '@/lib/automatic-source-discovery'

interface Props {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onOpenWorkspace: (project: Project) => void
  interactiveDemo?: {
    topic: string
    goal: string
    onTopicChange: (value: string) => void
    onGoalChange: (value: string) => void
    showGoal: boolean
    onGoalOpen: () => void
    onTopicReady: () => void
    onGoalReady: () => void
    onStart: (topic: string, goal: string) => void
  }
}

export function projectTitleFromTopic(topic: string) {
  const compact = topic.trim().replace(/\s+/g, ' ')
  if (compact.length <= 72) return compact
  const shortened = compact.slice(0, 72).replace(/\s+\S*$/, '').trim()
  return `${shortened || compact.slice(0, 69).trim()}...`
}

export default function ResearchKickoff({ open = true, onOpenChange, onOpenWorkspace, interactiveDemo }: Props) {
  const [topic, setTopic] = useState('')
  const [purpose, setPurpose] = useState('')
  const [existingUnderstanding, setExistingUnderstanding] = useState('')
  const [citationStyle, setCitationStyle] = useState<CitationStyle>('harvard')
  const [showContext, setShowContext] = useState(false)
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState('')
  const createdWorkspaceRef = useRef<Project | null>(null)

  if (!open) return null

  async function startWriting(event: React.FormEvent) {
    event.preventDefault()
    const cleanTopic = (interactiveDemo ? interactiveDemo.topic : topic).trim()
    if (!cleanTopic) {
      setFeedback('Add a topic to start your document.')
      return
    }
    if (interactiveDemo) {
      interactiveDemo.onStart(cleanTopic, interactiveDemo.goal.trim())
      return
    }

    setLoading(true)
    setFeedback('')
    try {
      let workspace = createdWorkspaceRef.current
      if (!workspace) {
        const result = await api.createWorkspace({
          title: projectTitleFromTopic(cleanTopic),
          description: purpose.trim() || cleanTopic,
          workspaceType: 'research',
          reviewPace: 'deep',
          citationStyle,
        })
        workspace = result.workspace
        createdWorkspaceRef.current = workspace
      }

      try {
        await api.saveInvestigation(workspace.id, {
          topic: cleanTopic,
          purpose: purpose.trim(),
          existingUnderstanding: existingUnderstanding.trim(),
        })
        void automaticallyDiscoverSources({
          projectId: workspace.id,
          query: cleanTopic,
          purpose: purpose.trim(),
          storage: window.localStorage,
        })
      } catch {
        toast.warning('Your document is ready', {
          description: 'The optional research context did not save. You can add it later without losing the document.',
        })
      }

      const hydrated = await api.getWorkspace(workspace.id).then(({ workspace: current }) => current).catch(() => workspace)
      createdWorkspaceRef.current = null
      onOpenChange?.(false)
      onOpenWorkspace(hydrated)
    } catch (error) {
      setFeedback((error as Error).message || 'Cogdoc could not create the document. Your topic is still here, so you can retry.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={startWriting} className="rounded-2xl border border-[#d9dbe2] bg-white p-5 shadow-[0_18px_60px_rgba(38,38,46,0.08)] sm:p-6" aria-label="Start research">
      <div>
        <label htmlFor="research-topic" className="text-sm font-semibold text-[#27272f]">What are you working on?</label>
        <p id="research-topic-help" className="mt-1 text-sm leading-6 text-[#666873]">A topic is enough. A blank working document opens immediately.</p>
        <Textarea
          id="research-topic"
          autoFocus
          rows={4}
          value={interactiveDemo ? interactiveDemo.topic : topic}
          onChange={(event) => { if (interactiveDemo) interactiveDemo.onTopicChange(event.target.value); else setTopic(event.target.value); setFeedback('') }}
          aria-describedby={`research-topic-help${feedback ? ' research-topic-error' : ''}`}
          placeholder={interactiveDemo ? 'For example: How can a simple Java application run on Kubernetes?' : 'For example: How does routine AI use affect independent evidence evaluation?'}
          className="mt-4 min-h-28 resize-y rounded-xl border-[#c9cbd3] bg-[#fbfbfc] px-4 py-3 text-base leading-6 text-[#27272f] placeholder:text-[#747681] focus-visible:border-[#7264a8] focus-visible:ring-[#7264a8]/20"
        />
        {interactiveDemo ? <div className="mt-3 flex items-center justify-between gap-3"><p className="text-xs leading-5 text-[#666873]">Edit the question if you want. The sample research path stays focused on Java and Kubernetes.</p><Button type="button" size="sm" variant="outline" data-demo-target="demo-use-topic" onClick={interactiveDemo.onTopicReady}>Use this topic</Button></div> : null}
      </div>

      <button
        type="button"
        data-demo-target={interactiveDemo ? 'demo-goal-toggle' : undefined}
        onClick={() => interactiveDemo ? interactiveDemo.onGoalOpen() : setShowContext((current) => !current)}
        aria-expanded={interactiveDemo ? interactiveDemo.showGoal : showContext}
        className="mt-4 flex min-h-10 w-full items-center justify-between rounded-lg px-1 text-left text-sm font-medium text-[#545661] outline-none transition-colors hover:text-[#27272f] focus-visible:ring-2 focus-visible:ring-[#7264a8] focus-visible:ring-offset-2"
      >
        <span>Add goal and starting point <span className="ml-1 font-normal text-[#777985]">Optional</span></span>
        <ChevronDown className={`size-4 transition-transform motion-reduce:transition-none ${(interactiveDemo ? interactiveDemo.showGoal : showContext) ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {(interactiveDemo ? interactiveDemo.showGoal : showContext) && (
        <div className="mt-3 space-y-4 border-l-2 border-[#ded9ef] pl-4">
          <div className="space-y-2">
            <label htmlFor="research-purpose" className="text-sm font-medium text-[#3d3f48]">Goal</label>
            <Textarea id="research-purpose" rows={2} value={interactiveDemo ? interactiveDemo.goal : purpose} onChange={(event) => interactiveDemo ? interactiveDemo.onGoalChange(event.target.value) : setPurpose(event.target.value)} disabled={loading} placeholder="What would make this research useful?" className="resize-y rounded-lg border-[#c9cbd3] bg-[#fbfbfc] text-sm placeholder:text-[#747681] focus-visible:border-[#7264a8] focus-visible:ring-[#7264a8]/20" />
            {interactiveDemo ? <Button type="button" size="sm" variant="outline" data-demo-target="demo-use-goal" onClick={interactiveDemo.onGoalReady}>Use this goal</Button> : null}
          </div>
          <div className="space-y-2">
            <label htmlFor="research-understanding" className="text-sm font-medium text-[#3d3f48]">What you know so far</label>
            <Textarea id="research-understanding" rows={3} value={existingUnderstanding} onChange={(event) => setExistingUnderstanding(event.target.value)} disabled={loading} placeholder="A rough note or 'not sure' is completely fine." className="resize-y rounded-lg border-[#c9cbd3] bg-[#fbfbfc] text-sm placeholder:text-[#747681] focus-visible:border-[#7264a8] focus-visible:ring-[#7264a8]/20" />
          </div>
          <div className="space-y-2">
            <label htmlFor="research-citation-style" className="text-sm font-medium text-[#3d3f48]">Citation style</label>
            <select id="research-citation-style" value={citationStyle} onChange={(event) => setCitationStyle(event.target.value as CitationStyle)} disabled={loading} className="h-10 w-full rounded-lg border border-[#c9cbd3] bg-[#fbfbfc] px-3 text-sm text-[#27272f] outline-none focus-visible:border-[#7264a8] focus-visible:ring-2 focus-visible:ring-[#7264a8]/20">
              <option value="harvard">Harvard - Cite Them Right</option>
              <option value="apa">APA 7th edition</option>
            </select>
          </div>
        </div>
      )}

      {feedback && <p id="research-topic-error" role="alert" className="mt-3 text-sm leading-5 text-[#a13b52]">{feedback}</p>}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-sm text-xs leading-5 text-[#666873]">Ask for an editable plan later if you want one. It never blocks writing.</p>
        <Button type="submit" data-demo-target={interactiveDemo ? 'demo-start-research' : undefined} disabled={loading} className="h-11 shrink-0 rounded-xl bg-[#6858a8] px-5 text-white hover:bg-[#594a93] active:translate-y-px">
          {loading ? <><Loader2 className="mr-2 size-4 animate-spin motion-reduce:animate-none" />Creating document</> : <>Start writing<ArrowRight className="ml-2 size-4" /></>}
        </Button>
      </div>
    </form>
  )
}
