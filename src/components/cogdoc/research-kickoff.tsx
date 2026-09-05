'use client'

import { useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, Check, Loader2, PencilLine, Plus, Search, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { structuredCitationForReference } from '@/lib/citation-insertion'
import type {
  Project,
  ReferenceSummary,
  ResearchKickoffConversationTurn,
  ResearchKickoffOutlineItem,
  ResearchKickoffPlan,
  ResearchKickoffQuestion,
} from '@/lib/types'
import type { CitationStyle } from '@/lib/workspace'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

type Phase = 'topic' | 'questions' | 'outline' | 'building'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: (project: Project) => void
}

type DiscoveredSource = Awaited<ReturnType<typeof api.findSources>>['sources'][number]

export const RESEARCH_CONVERSATION_QUESTIONS: ResearchKickoffQuestion[] = [
  { id: 'understand', question: 'What do you want to understand?', why: 'Tell Cogdoc the question in your own words.' },
  { id: 'starting-view', question: 'What do you think is happening?', why: 'A rough answer is enough.' },
  { id: 'other-view', question: 'What else might be true?', why: 'Name another view, exception, or doubt.' },
]

function text(value: string) { return { type: 'text', text: value } }
function paragraph(value: string) { return { type: 'paragraph', content: [text(value)] } }
function heading(value: string, level: number) { return { type: 'heading', attrs: { level }, content: [text(value)] } }

export function kickoffDocumentContent(
  title: string,
  outline: ResearchKickoffOutlineItem[],
  sources: DiscoveredSource[],
  verifiedReferences: ReferenceSummary[] = [],
  conversation: ResearchKickoffConversationTurn[] = [],
): string {
  const content: Array<Record<string, unknown>> = [heading(title, 1)]
  for (const [index, section] of outline.entries()) {
    content.push(heading(section.heading, 2), paragraph(section.purpose))
    const turn = conversation[index]
    if (turn?.answer.trim()) content.push(paragraph(`Your starting note: ${turn.answer.trim()}`))

    const citation = verifiedReferences.length
      ? structuredCitationForReference(verifiedReferences[index % verifiedReferences.length]!)
      : null
    content.push(citation
      ? { type: 'paragraph', content: [text('Evidence lead to read and check: '), { type: 'structuredCitation', attrs: citation }] }
      : paragraph('Evidence to find: [source needed]'))
  }
  if (sources.length) {
    content.push(heading('Sources to examine', 2), {
      type: 'bulletList',
      content: sources.map((source) => ({
        type: 'listItem',
        content: [{
          type: 'paragraph',
          content: [{
            type: 'text',
            text: source.title,
            marks: [{ type: 'link', attrs: { href: source.openAccessUrl ?? source.url, target: '_blank', rel: 'noopener noreferrer' } }],
          }],
        }],
      })),
    })
  }
  return JSON.stringify({ type: 'doc', content })
}

export default function ResearchKickoff({ open, onOpenChange, onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>('topic')
  const [topic, setTopic] = useState('')
  const [citationStyle, setCitationStyle] = useState<CitationStyle>('harvard')
  const [plan, setPlan] = useState<ResearchKickoffPlan | null>(null)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [buildStatus, setBuildStatus] = useState('')
  const createdProjectRef = useRef<Project | null>(null)

  const question = RESEARCH_CONVERSATION_QUESTIONS[questionIndex]
  const answer = question ? answers[question.id] ?? '' : ''
  const answerWords = answer.trim().split(/\s+/).filter(Boolean).length
  const conversation = RESEARCH_CONVERSATION_QUESTIONS.map((item) => ({
    question: item.question,
    answer: answers[item.id] ?? '',
  }))

  function startConversation() {
    if (topic.trim().split(/\s+/).filter(Boolean).length < 4) {
      setFeedback('Tell Cogdoc a little more about the topic.')
      return
    }
    setFeedback('')
    setQuestionIndex(0)
    setPhase('questions')
  }

  async function createOutlineFromConversation() {
    setLoading(true)
    setFeedback('')
    try {
      const response = await api.planResearchKickoff(topic.trim(), conversation)
      setPlan(response.plan)
      setPhase('outline')
      if (response.assistantFallback) {
        toast('Cogdoc used a simple research structure', { description: 'You can edit every section before continuing.' })
      }
    } catch (error) {
      setFeedback((error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  function nextQuestion() {
    if (!question) return
    if (answerWords < 4) {
      setFeedback('A short sentence is enough. Tell Cogdoc a little more.')
      return
    }
    setFeedback('')
    if (questionIndex < RESEARCH_CONVERSATION_QUESTIONS.length - 1) setQuestionIndex((value) => value + 1)
    else void createOutlineFromConversation()
  }

  function updateOutline(index: number, patch: Partial<ResearchKickoffOutlineItem>) {
    setPlan((current) => current
      ? { ...current, outline: current.outline.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) }
      : current)
  }

  function addOutlineSection() {
    setPlan((current) => current ? {
      ...current,
      outline: [...current.outline, { heading: 'New section', purpose: 'What should this section help you understand?' }],
    } : current)
  }

  function removeOutlineSection(index: number) {
    setPlan((current) => current && current.outline.length > 3
      ? { ...current, outline: current.outline.filter((_, itemIndex) => itemIndex !== index) }
      : current)
  }

  function structureIsReady() {
    if (!plan || plan.outline.length < 3 || plan.outline.some((item) => !item.heading.trim() || !item.purpose.trim())) {
      setFeedback('Keep at least three sections and fill in each heading and purpose.')
      return false
    }
    return true
  }

  async function saveSources(projectId: string, sources: DiscoveredSource[]) {
    const allReferences: ReferenceSummary[] = []
    const verifiedReferences: ReferenceSummary[] = []
    for (const source of sources) {
      try {
        const saved = await api.addReference(projectId, {
          title: source.title,
          url: source.url,
          authors: source.citation?.authors,
          year: source.citation?.year,
          venue: source.citation?.venue,
          doi: source.citation?.doi,
          volume: source.citation?.volume,
          issue: source.citation?.issue,
          pages: source.citation?.pages,
          publisher: source.citation?.publisher,
          provider: source.recordProvider,
        })
        allReferences.push(saved.reference)
        if (['matched', 'confirmed'].includes(saved.reference.metadataStatus)) {
          verifiedReferences.push(saved.reference)
          continue
        }
        const checked = await api.verifyReference(projectId, saved.reference.id)
        if (checked.verified || ['matched', 'confirmed'].includes(checked.reference.metadataStatus)) {
          verifiedReferences.push(checked.reference)
        }
      } catch {
        // One unavailable metadata provider must not discard the remaining sources.
      }
    }
    return { allReferences, verifiedReferences }
  }

  async function buildProject() {
    if (!structureIsReady() || !plan) return
    setPhase('building')
    setLoading(true)
    setFeedback('')
    try {
      let workspace = createdProjectRef.current
      if (!workspace) {
        setBuildStatus('Creating your private research project…')
        const result = await api.createWorkspace({
          title: plan.title,
          description: plan.description || topic.trim(),
          workspaceType: 'research',
          reviewPace: 'deep',
          citationStyle,
        })
        workspace = result.workspace
        createdProjectRef.current = workspace
      }

      setBuildStatus('Finding useful sources for what you told Cogdoc…')
      const sourceResult = await api.findSources(
        `${topic.trim()} ${conversation.map((item) => item.answer).join(' ')}`.slice(0, 2_500),
        workspace.id,
      ).catch(() => ({ sources: [] as DiscoveredSource[], provider: 'none' }))
      const sources = sourceResult.sources.filter((source) => source.relevance !== 'low').slice(0, 4)

      setBuildStatus('Checking source details before adding citations…')
      const saved = await saveSources(workspace.id, sources)
      setBuildStatus('Saving your editable research structure…')
      const content = kickoffDocumentContent(plan.title, plan.outline, sources, saved.verifiedReferences, conversation)
      await api.saveDocument(workspace.id, content, workspace.document?.revision ?? 0)
      await api.recordDecision(workspace.id, {
        type: 'research_structure_accepted',
        summary: 'Accepted an editable research structure built from the kickoff conversation',
        entityType: 'document',
        detail: { sections: plan.outline.map((item) => item.heading), sourcesSaved: saved.allReferences.length, verifiedCitations: saved.verifiedReferences.length },
      })

      const { workspace: hydrated } = await api.getWorkspace(workspace.id)
      createdProjectRef.current = null
      toast.success('Research structure ready', {
        description: `${saved.allReferences.length} source${saved.allReferences.length === 1 ? '' : 's'} saved · ${saved.verifiedReferences.length} verified citation lead${saved.verifiedReferences.length === 1 ? '' : 's'} inserted.`,
      })
      onOpenChange(false)
      onComplete(hydrated)
    } catch (error) {
      setFeedback((error as Error).message || 'Cogdoc could not finish the research structure.')
      setPhase('outline')
    } finally {
      setLoading(false)
      setBuildStatus('')
    }
  }

  const currentStep = phase === 'topic' ? 0 : phase === 'questions' ? 1 : phase === 'outline' ? 2 : 3
  const steps = ['Topic', 'Conversation', 'Structure', 'Sources + citations']

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent showCloseButton={false} className="h-[calc(100dvh-1rem)] max-h-[52rem] w-[calc(100vw-1rem)] max-w-none overflow-hidden border-stone-200 bg-[#fffefb] p-0 sm:h-[90dvh] sm:max-w-3xl">
      <DialogClose className="absolute right-3 top-3 z-20 grid h-8 w-8 place-items-center rounded-md text-white/75 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:right-4 sm:top-4 sm:text-stone-500 sm:hover:bg-stone-100 sm:hover:text-stone-900 sm:focus-visible:outline-[#386c5c]" aria-label="Close research kickoff"><X className="h-4 w-4" /></DialogClose>
      <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] sm:grid-cols-[13.5rem_minmax(0,1fr)] sm:grid-rows-1">
        <aside className="flex min-w-0 flex-col justify-between bg-[#173f35] px-4 py-3 text-white sm:p-6">
          <div className="flex items-center gap-3 pr-10 sm:block sm:pr-0"><div className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-white/10 sm:h-10 sm:w-10"><BookOpen className="h-4 w-4 sm:h-5 sm:w-5" /></div><div><p className="font-mono text-[9px] uppercase tracking-[.18em] text-emerald-100/65 sm:mt-7">Research kickoff</p><p className="mt-1 hidden text-sm leading-6 text-emerald-50/80 sm:block">A short conversation becomes an editable research structure with source leads.</p></div></div>
          <ol className="mt-3 grid grid-cols-4 gap-1.5 text-[8px] text-emerald-50/65 sm:mt-8 sm:block sm:space-y-2 sm:text-[10px]">{steps.map((label, index) => <li key={label} className={`flex min-w-0 items-center gap-1.5 sm:gap-2 ${index <= currentStep ? 'text-white' : ''}`}><span className={`grid h-4 w-4 shrink-0 place-items-center border text-[8px] sm:h-5 sm:w-5 sm:text-[10px] ${index < currentStep ? 'border-emerald-100 bg-emerald-100 text-[#173f35]' : 'border-white/30'}`}>{index < currentStep ? <Check className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> : index + 1}</span><span className="truncate">{label}</span></li>)}</ol>
        </aside>

        <section data-testid="research-kickoff-scroll-region" className="min-h-0 min-w-0 overflow-y-auto overscroll-contain px-5 pb-4 pt-6 sm:px-9 sm:pb-6 sm:pt-9">
          {phase === 'topic' && <div className="flex min-h-full flex-col"><DialogHeader className="text-left"><p className="font-mono text-[10px] uppercase tracking-[.18em] text-[#386c5c]">Start with the inquiry</p><DialogTitle className="mt-2 text-pretty font-serif text-2xl font-semibold leading-tight tracking-[-.025em] sm:mt-3 sm:text-3xl">What topic do you want to research?</DialogTitle><DialogDescription className="mt-2 leading-6 sm:mt-3">Describe it naturally. Cogdoc will ask three simple questions next.</DialogDescription></DialogHeader><Textarea autoFocus rows={7} value={topic} onChange={(event) => { setTopic(event.target.value); setFeedback('') }} placeholder="e.g. How does routine reliance on generative AI affect researchers’ ability to evaluate evidence independently?" className="mt-5 min-h-36 resize-y bg-white text-base leading-7 sm:mt-7" /><label className="mt-4"><span className="text-xs font-medium text-stone-600">Citation style</span><select aria-label="Citation style" value={citationStyle} onChange={(event) => setCitationStyle(event.target.value as CitationStyle)} className="mt-1 h-10 w-full border border-stone-300 bg-white px-3 text-sm"><option value="harvard">Harvard — Cite Them Right</option><option value="apa">APA 7th edition</option></select></label><p className="mt-3 text-xs text-amber-700" role="status">{feedback}</p><div className="sticky bottom-0 -mx-5 mt-auto flex justify-end border-t border-stone-200 bg-[#fffefb]/95 px-5 pb-1 pt-4 backdrop-blur-sm sm:-mx-9 sm:px-9"><Button onClick={startConversation} className="bg-[#173f35] hover:bg-[#245548] active:translate-y-px">Start conversation<ArrowRight className="ml-1.5 h-4 w-4" /></Button></div></div>}

          {phase === 'questions' && question && <div className="flex min-h-full flex-col"><DialogHeader className="text-left"><p className="font-mono text-[10px] uppercase tracking-[.18em] text-[#386c5c]">Conversation {questionIndex + 1} of {RESEARCH_CONVERSATION_QUESTIONS.length}</p><DialogTitle className="mt-2 text-pretty font-serif text-2xl font-semibold leading-tight tracking-[-.025em] sm:mt-3 sm:text-3xl">{question.question}</DialogTitle><DialogDescription className="mt-2 leading-6 sm:mt-3">{question.why}</DialogDescription></DialogHeader><Textarea autoFocus rows={8} value={answer} onChange={(event) => { setAnswers((current) => ({ ...current, [question.id]: event.target.value })); setFeedback('') }} placeholder="Answer naturally…" className="mt-5 min-h-40 resize-y bg-white text-base leading-7 sm:mt-7" /><div className="mt-2 flex justify-between gap-4 text-xs"><p className="text-amber-700" role="status">{feedback}</p><span className={`shrink-0 font-mono tabular-nums ${answerWords >= 4 ? 'text-[#386c5c]' : 'text-stone-400'}`}>{answerWords} words</span></div><div className="sticky bottom-0 -mx-5 mt-auto flex items-center justify-between gap-3 border-t border-stone-200 bg-[#fffefb]/95 px-5 pb-1 pt-4 backdrop-blur-sm sm:-mx-9 sm:px-9"><Button variant="ghost" onClick={() => questionIndex ? setQuestionIndex((value) => value - 1) : setPhase('topic')}><ArrowLeft className="mr-1.5 h-4 w-4" />Back</Button><Button onClick={nextQuestion} disabled={loading} className="bg-[#173f35] hover:bg-[#245548] active:translate-y-px">{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{questionIndex === RESEARCH_CONVERSATION_QUESTIONS.length - 1 ? 'Make my outline' : 'Continue'}{!loading && <ArrowRight className="ml-1.5 h-4 w-4" />}</Button></div></div>}

          {phase === 'outline' && plan && <div className="flex min-h-full flex-col"><DialogHeader className="text-left"><p className="font-mono text-[10px] uppercase tracking-[.18em] text-[#386c5c]">Your research structure</p><DialogTitle className="mt-2 text-pretty font-serif text-2xl font-semibold leading-tight tracking-[-.025em] sm:mt-3 sm:text-3xl">Built from what you told Cogdoc</DialogTitle><DialogDescription className="mt-2 leading-6 sm:mt-3">Change any heading or purpose. This is your structure, not a finished draft.</DialogDescription></DialogHeader><div className="mt-4 flex items-start gap-2 text-[11px] leading-5 text-[#386c5c] sm:mt-5"><PencilLine className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span>Every field stays editable here and in the document.</span></div><div className="mt-4 space-y-3">{plan.outline.map((item, index) => <section key={`outline-${index}`} className="border border-[#d8d2c6] bg-white/65 p-3 transition-colors focus-within:border-[#6f9185] focus-within:bg-white"><div className="mb-2 flex items-center justify-between"><span className="font-mono text-[9px] uppercase tracking-[.14em] text-stone-400">Section {index + 1}</span>{plan.outline.length > 3 && <Button type="button" size="icon" variant="ghost" onClick={() => removeOutlineSection(index)} className="h-7 w-7 text-stone-400 hover:bg-rose-50 hover:text-rose-700" aria-label={`Remove outline section ${index + 1}`}><Trash2 className="h-3.5 w-3.5" /></Button>}</div><Input value={item.heading} onChange={(event) => updateOutline(index, { heading: event.target.value })} aria-label={`Outline heading ${index + 1}`} className="h-9 border-0 border-b border-stone-200 bg-transparent px-0 font-serif font-semibold shadow-none focus-visible:border-[#527d6e] focus-visible:ring-0" /><Input value={item.purpose} onChange={(event) => updateOutline(index, { purpose: event.target.value })} aria-label={`Outline purpose ${index + 1}`} className="mt-1 h-9 border-0 bg-transparent px-0 text-xs text-stone-500 shadow-none focus-visible:ring-0" /></section>)}</div><Button type="button" variant="ghost" onClick={addOutlineSection} className="mt-3 h-9 w-full border border-dashed border-stone-300 text-[11px] text-stone-600 hover:border-[#8da79d] hover:bg-[#eef2ed]"><Plus className="mr-1.5 h-3.5 w-3.5" />Add outline section</Button><p className="mt-2 text-xs text-amber-700" role="status">{feedback}</p><div className="sticky bottom-0 -mx-5 mt-4 flex items-center justify-between gap-3 border-t border-stone-200 bg-[#fffefb]/95 px-5 pb-1 pt-4 backdrop-blur-sm sm:-mx-9 sm:px-9"><Button variant="ghost" onClick={() => { setQuestionIndex(RESEARCH_CONVERSATION_QUESTIONS.length - 1); setPhase('questions') }}><ArrowLeft className="mr-1.5 h-4 w-4" />Conversation</Button><Button onClick={() => void buildProject()} className="bg-[#173f35] hover:bg-[#245548] active:translate-y-px">Build cited structure<ArrowRight className="ml-1.5 h-4 w-4" /></Button></div></div>}

          {phase === 'building' && <div className="flex min-h-full flex-col items-center justify-center px-3 text-center"><div className="grid h-12 w-12 place-items-center rounded-xl bg-[#e5eee8]"><Search className="h-5 w-5 animate-pulse text-[#386c5c] motion-reduce:animate-none" /></div><h2 className="mt-5 text-pretty font-serif text-2xl font-semibold">Building your research structure</h2><p className="mt-3 max-w-sm text-sm leading-6 text-stone-500" aria-live="polite">{buildStatus}</p><p className="mt-5 text-xs text-amber-700">{feedback}</p></div>}
        </section>
      </div>
    </DialogContent>
  </Dialog>
}
