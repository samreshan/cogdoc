'use client'

import { useState } from 'react'
import { BookOpen, Check, Download, FileOutput, Lightbulb, ListChecks, MessageSquareText, Search, Send, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { DocumentResearchDockProps, DockSourceContext } from '@/lib/document-collaborator-contract'
import {
  DEMO_ORIGINAL_CLAIM, DEMO_REVISED_CLAIM, DEMO_SAMPLE_PASSAGE, INTERACTIVE_DEMO_GOAL,
  INTERACTIVE_DEMO_QUESTIONS, INTERACTIVE_DEMO_SOURCES, INTERACTIVE_DEMO_TOPIC,
  downloadInteractiveDemoMarkdown, type InteractiveDemoState,
} from '@/lib/interactive-demo'

const sections = [
  { id: 'collaborator', label: 'Collaborator', icon: MessageSquareText },
  { id: 'sources', label: 'Sources', icon: BookOpen },
  { id: 'findings', label: 'Findings', icon: ListChecks },
  { id: 'plan', label: 'Plan', icon: Lightbulb },
  { id: 'share', label: 'Share', icon: FileOutput },
] as const

const engineCopy = {
  interceptor: {
    name: 'Interceptor', purpose: 'Keeps ownership with the researcher.',
    result: 'The phrase “because they make writing faster” hands the conclusion to fluency. What would count as researcher control?',
  },
  socratic: {
    name: 'Socratic Spacer', purpose: 'Pauses for an explanation in your own words.',
    result: 'Which part of control is procedural, and which part requires the researcher to make a judgement?',
  },
  citation: {
    name: 'Citation Sentinel', purpose: 'Checks whether a claim points to inspected support.',
    result: 'A publication record is present, but the broad claim lacks a precise inspected passage and locator.',
  },
  scaffold: {
    name: 'Scaffold', purpose: 'Structures claim, evidence, limitation, and implication.',
    result: 'Claim: provenance can support agency. Evidence: inspected passage. Limitation: this demo does not measure learning. Implication: test the workflow empirically.',
  },
} as const

type DemoAction = (action: string) => void

export default function InteractiveDemoDock({ props, state, onAction }: {
  props: DocumentResearchDockProps
  state: InteractiveDemoState
  onAction: DemoAction
}) {
  const section = props.activeSection ?? props.initialSection ?? 'collaborator'
  const [answer, setAnswer] = useState('')

  function openSection(next: typeof section) {
    props.onSectionChange?.(next)
    onAction(`${next}-opened`)
  }

  return <aside className="flex h-full min-h-[32rem] w-full min-w-0 flex-col overflow-hidden border-l border-border bg-background text-foreground" aria-label="Simulated document research tools">
    <div className="flex items-center border-b border-border px-2 py-2">
      <div className="min-w-0 flex-1 overflow-x-auto"><div className="flex min-w-max gap-1" role="tablist" aria-label="Research tools">
        {sections.map(({ id, label, icon: Icon }) => <button key={id} type="button" role="tab" data-demo-target={`dock-${id}`} aria-selected={section === id} onClick={() => openSection(id)} className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${section === id ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}><Icon className="h-3.5 w-3.5" />{label}</button>)}
      </div></div>
      <span className="mr-1 rounded-lg border border-violet-200 bg-violet-50 px-2 py-1 text-[10px] font-semibold text-violet-800">Simulated</span>
    </div>

    {section === 'plan' ? <PlanPanel /> : null}
    {section === 'sources' ? <SourcesPanel props={props} state={state} onAction={onAction} /> : null}
    {section === 'collaborator' ? <CollaboratorPanel props={props} state={state} onAction={onAction} answer={answer} setAnswer={setAnswer} /> : null}
    {section === 'findings' ? <FindingsPanel state={state} onAction={onAction} /> : null}
    {section === 'share' ? <SharePanel state={state} onAction={onAction} /> : null}
  </aside>
}

function PlanPanel() {
  return <div className="min-h-0 flex-1 overflow-y-auto p-4" data-demo-target="demo-plan-content">
    <p className="text-xs font-semibold text-violet-800">Prefilled sample plan</p>
    <h2 className="mt-2 text-lg font-semibold tracking-[-0.02em]">A stable question starts the research loop</h2>
    <dl className="mt-4 space-y-3 text-sm"><div><dt className="font-medium">Topic</dt><dd className="mt-1 leading-6 text-muted-foreground">{INTERACTIVE_DEMO_TOPIC}</dd></div><div><dt className="font-medium">Goal</dt><dd className="mt-1 leading-6 text-muted-foreground">{INTERACTIVE_DEMO_GOAL}</dd></div></dl>
    <div className="mt-5 space-y-2">{INTERACTIVE_DEMO_QUESTIONS.map((question, index) => <article key={question.id} className={`rounded-xl border p-3 ${index === 0 ? 'border-violet-300 bg-violet-50/70' : 'border-border bg-card'}`}><p className="text-sm font-medium leading-5">{question.wording}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{question.rationale}</p></article>)}</div>
  </div>
}

function SourcesPanel({ props, state, onAction }: { props: DocumentResearchDockProps; state: InteractiveDemoState; onAction: DemoAction }) {
  return <div className="min-h-0 flex-1 overflow-y-auto p-4">
    <h2 className="text-sm font-semibold">Source discovery</h2>
    <p className="mt-1 text-xs leading-5 text-muted-foreground">This replay uses verified publication identities. Search timing and results are simulated.</p>
    <div data-demo-target="demo-discovery" className="mt-4 rounded-xl border border-violet-200 bg-violet-50/60 p-3">
      <p className="text-xs font-medium text-violet-900">{state.discovery === 'queued' ? 'Ready to search the confirmed question' : state.discovery === 'searching' ? 'Searching scholarly indexes...' : 'Three metadata leads saved'}</p>
      <p className="mt-1 text-xs leading-5 text-violet-800/80">{state.discovery === 'ready' ? 'These are leads, not inspected evidence.' : 'No provider credit or network request is used in demo mode.'}</p>
      {state.discovery !== 'ready' ? <Button data-demo-target="demo-run-discovery" size="sm" className="mt-3" disabled={state.discovery === 'searching'} onClick={() => onAction('discovery-started')}><Search className="mr-1.5 h-3.5 w-3.5" />{state.discovery === 'searching' ? 'Searching sample records' : 'Run sample discovery'}</Button> : null}
    </div>
    {state.discovery === 'ready' ? <div className="mt-4 space-y-3" data-demo-target="demo-source-results">{INTERACTIVE_DEMO_SOURCES.map((source) => <article key={source.id} className="rounded-xl border border-border bg-card p-3"><h3 className="text-sm font-medium leading-5">{source.title}</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">{source.rationale}</p><p className="mt-2 text-[11px] text-muted-foreground">{source.author}, {source.year}. {source.doi ? `DOI ${source.doi}` : source.access}</p><div className="mt-3 flex flex-wrap gap-2"><Button data-demo-target={source.id === 'demo-source-kasneci' ? 'demo-open-source' : undefined} size="sm" variant="outline" onClick={() => {
          const context: DockSourceContext = { workspaceSourceId: source.id, title: source.title, accessBasis: source.id === 'demo-source-kasneci' ? 'abstract' : 'metadata' }
          props.onOpenSource(context); onAction('source-opened')
        }}>Inspect sample</Button><a href={source.url} target="_blank" rel="noreferrer" className="inline-flex items-center px-2 text-xs font-medium text-muted-foreground hover:text-foreground">Open publication record</a></div></article>)}</div> : null}
    {state.evidenceChosen ? <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3"><p className="text-xs font-medium text-emerald-900">Sample passage chosen as evidence context</p><p className="mt-1 text-xs leading-5 text-emerald-800">It remains a labelled demonstration paraphrase.</p>{!state.citationInserted ? <Button data-demo-target="demo-insert-citation" size="sm" className="mt-3" onClick={() => onAction('citation-inserted')}>Insert sample citation</Button> : <p className="mt-2 flex items-center gap-1.5 text-xs font-medium"><Check className="h-3.5 w-3.5" />Citation inserted in the document</p>}</div> : null}
  </div>
}

function CollaboratorPanel({ props, state, onAction, answer, setAnswer }: { props: DocumentResearchDockProps; state: InteractiveDemoState; onAction: DemoAction; answer: string; setAnswer: (value: string) => void }) {
  return <div className="flex min-h-0 flex-1 flex-col">
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
      <div><h2 className="text-sm font-semibold">Research collaborator</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Every response below is deterministic sample material.</p></div>
      {state.collaboratorAsked ? <><article className="ml-8 rounded-xl bg-primary px-3.5 py-3 text-sm text-primary-foreground">What evidence would test whether this workflow preserves researcher control?</article><article className="mr-3 text-sm leading-6"><p className="font-medium text-violet-800">Simulated collaborator response</p><p className="mt-1">Compare what researchers can explain and verify before and after using the workflow. Track source inspection, uncertainty revisions, and whether final claims remain researcher-authored.</p></article><section className="rounded-xl border border-border bg-muted/35 p-3"><p className="text-xs font-semibold">Source lead to explore</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Kasneci et al. (2023), verified DOI identity. This suggestion is not proof.</p></section></> : <Button data-demo-target="demo-ask-collaborator" onClick={() => onAction('collaborator-asked')}><Send className="mr-2 h-4 w-4" />Ask sample question</Button>}

      {state.collaboratorAsked ? <section data-demo-target="demo-engine-controls" className="rounded-xl border border-border p-3"><h3 className="text-sm font-semibold">Reasoning engines</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">Each engine has a different job. None edits or reviews for you.</p><div className="mt-3 grid grid-cols-2 gap-2">{(Object.keys(engineCopy) as Array<keyof typeof engineCopy>).map((engine) => <Button key={engine} data-demo-target={`demo-engine-${engine}`} size="sm" variant={state.engines.includes(engine) ? 'secondary' : 'outline'} onClick={() => onAction(`engine-${engine}`)}>{state.engines.includes(engine) ? <Check className="mr-1.5 h-3.5 w-3.5" /> : null}{engineCopy[engine].name}</Button>)}</div></section> : null}

      {state.engines.map((engine) => <article key={engine} className="rounded-xl border border-violet-200 bg-violet-50/55 p-3"><p className="text-xs font-semibold text-violet-900">{engineCopy[engine].name}: {engineCopy[engine].purpose}</p><p className="mt-1 text-xs leading-5 text-violet-900/80">{engineCopy[engine].result}</p></article>)}

      {state.engines.length === 4 && !state.engineAnswered ? <section data-demo-target="demo-engine-answer" className="rounded-xl border border-border p-3"><label className="grid gap-1.5 text-xs font-medium">Your response<Input value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="A response or an honest uncertainty" /></label><div className="mt-2 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => setAnswer("I'm not sure yet. I would compare source-checking behavior and keep that uncertainty in the finding.")}>Use sample answer</Button><Button size="sm" disabled={!answer.trim()} onClick={() => onAction('engine-answered')}>Record response</Button></div><p className="mt-2 text-[11px] leading-4 text-muted-foreground">A response releases the question. It is not evidence or a review.</p></section> : null}
      {state.engineAnswered && !state.revisionApplied ? <Button data-demo-target="demo-preview-revision" variant="outline" disabled={!props.documentSelection} onClick={() => {
        if (!props.documentSelection) return
        props.onRequestPreview({ kind: 'document_revision', id: 'demo-revision', replacement: DEMO_REVISED_CLAIM, reason: 'This simulated revision narrows the causal wording and restores explicit research conditions.', selection: props.documentSelection, sourceIds: ['demo-source-kasneci'], model: 'deterministic-demo' })
        onAction('revision-previewed')
      }}>Preview a safer revision</Button> : null}
      {state.revisionApplied ? <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-900"><ShieldCheck className="h-4 w-4" />The selected passage changed only after explicit preview and apply.</p> : null}
    </div>
  </div>
}

function FindingsPanel({ state, onAction }: { state: InteractiveDemoState; onAction: DemoAction }) {
  return <div className="min-h-0 flex-1 overflow-y-auto p-4" data-demo-target="demo-finding-panel"><h2 className="text-sm font-semibold">Finding review</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">The finding is sample data. Review is still a separate explicit action.</p>
    <div className="mt-4 space-y-3"><label className="grid gap-1 text-xs font-medium">Conclusion<Textarea readOnly value={state.findingFilled ? DEMO_REVISED_CLAIM : ''} placeholder="A bounded conclusion" /></label><label className="grid gap-1 text-xs font-medium">Researcher explanation<Textarea readOnly value={state.findingFilled ? 'Provenance makes source boundaries visible, while separate review keeps the conclusion under researcher control.' : ''} placeholder="Explain the reasoning" /></label><label className="grid gap-1 text-xs font-medium">Uncertainty and limitation<Textarea readOnly value={state.findingFilled ? 'This simulated example does not show that the workflow improves learning. A comparative study is still required.' : ''} placeholder="What remains uncertain?" /></label></div>
    {!state.findingFilled ? <Button data-demo-target="demo-fill-finding" className="mt-3" onClick={() => onAction('finding-filled')}>Fill sample finding</Button> : !state.findingReviewed ? <Button data-demo-target="demo-review-finding" className="mt-3" onClick={() => onAction('finding-reviewed')}><Check className="mr-2 h-4 w-4" />Retain with uncertainty</Button> : <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-900">Sample review recorded: retained with uncertainty. No real research record was created.</p>}
  </div>
}

function SharePanel({ state, onAction }: { state: InteractiveDemoState; onAction: DemoAction }) {
  return <div className="min-h-0 flex-1 overflow-y-auto p-4"><h2 className="text-sm font-semibold">Compose and export</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Composition uses the reviewed sample finding. Nothing is published.</p>
    {!state.articleComposed ? <Button data-demo-target="demo-compose-article" className="mt-4" disabled={!state.findingReviewed} onClick={() => onAction('article-composed')}>Compose sample article</Button> : <section data-demo-target="demo-article" className="mt-4 space-y-3"><div className="rounded-xl border border-border bg-card p-4"><p className="text-xs font-semibold text-violet-800">Simulated article output</p><h3 className="mt-2 text-lg font-semibold">Researcher agency in AI-assisted writing</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">A provenance-first workspace may support researcher control when source inspection, uncertainty, and acceptance remain explicit. This is a demonstration argument, not a validated educational result.</p></div><Button data-demo-target="demo-export-markdown" variant="outline" onClick={() => { downloadInteractiveDemoMarkdown(); onAction('exported') }}><Download className="mr-2 h-4 w-4" />Download sample Markdown</Button>{state.exported ? <p className="text-xs font-medium text-emerald-700">Sample Markdown downloaded by your explicit action.</p> : null}</section>}
  </div>
}
