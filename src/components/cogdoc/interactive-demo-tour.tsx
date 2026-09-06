'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ArrowLeft, ChevronRight, Pause, Play, RotateCcw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { INTERACTIVE_DEMO_VERSION } from '@/lib/interactive-demo'

export type TourCommand = 'write' | 'select-claim' | 'click-target' | 'fill-topic' | 'fill-goal'

interface TourStep {
  target: string
  title: string
  body: string
  icon: string
  expected?: string
  command?: TourCommand
  manualOnly?: boolean
}

export const INTERACTIVE_DEMO_STEPS: TourStep[] = [
  { target: 'research-topic', title: 'Begin with one answerable question', icon: 'Topic', body: 'This is the same topic field used for normal projects. Next, you can use a simple question about running a Java application on Kubernetes.' },
  { target: 'demo-use-topic', title: 'Keep the topic small and editable', icon: 'Topic', body: 'Use the sample question or edit the text first. A focused topic helps the plan, source search, and collaborator stay understandable.', expected: 'topic-ready', command: 'fill-topic' },
  { target: 'demo-goal-toggle', title: 'Add a plain-language goal', icon: 'Goal', body: 'This control reveals what the research should explain. It keeps the project useful without requiring a long brief.', expected: 'goal-opened', command: 'click-target' },
  { target: 'demo-use-goal', title: 'Say what a useful answer includes', icon: 'Goal', body: 'The sample goal names the Java artifact, container image, Deployment, Service, and remaining limitations. You can edit it before continuing.', expected: 'goal-ready', command: 'fill-goal' },
  { target: 'demo-start-research', title: 'Create the isolated demo workspace', icon: 'Start', body: 'Start writing opens a local sample document. Demo mode does not create a database project or call a source or AI provider.', command: 'click-target' },
  { target: 'document-surface', title: 'The document stays at the center', icon: 'Document', body: 'Research tools open beside the real editor, so you can see every change return to the draft. Next, the demo will write a short starting claim.' },
  { target: 'document-surface', title: 'Watch the explanation take shape', icon: 'Document', body: 'Show me writes at a readable pace. Pause stops playback, and you can click into the editor to take over at any time.', expected: 'writing-complete', command: 'write' },
  { target: 'nav-plan', title: 'Plan shows the route through the topic', icon: 'Plan', body: 'This route icon opens the topic, goal, and three smaller questions. It helps you see what must be explained before searching.', expected: 'plan-opened', command: 'click-target' },
  { target: 'demo-plan-content', title: 'Three questions divide the work', icon: 'Questions', body: 'The plan starts with the Java application, then separates Deployment and Service, and finally asks what Kubernetes does not guarantee.' },
  { target: 'nav-sources', title: 'Sources holds the evidence trail', icon: 'Sources', body: 'The book icon opens official documentation leads, their URLs, and any passage you inspect. A saved title alone is not evidence.', expected: 'sources-opened', command: 'click-target' },
  { target: 'demo-run-discovery', title: 'Run a visible sample search', icon: 'Search', body: 'This replay shows searching and ready states without using the network. It returns stable official Java and Kubernetes documentation records.', expected: 'discovery-ready', command: 'click-target' },
  { target: 'demo-open-source', title: 'Inspect before using a source', icon: 'Inspect', body: 'Open the official Deployments record and a clearly labelled demonstration paraphrase. The source identity is real; the passage is sample material.', expected: 'source-opened', command: 'click-target' },
  { target: 'demo-source-reader', title: 'Read the evidence boundary', icon: 'Reader', body: 'This highlighted area explains exactly what is simulated. Choose Next when you are ready to highlight the separate evidence action.' },
  { target: 'demo-use-evidence', title: 'Choose this passage on purpose', icon: 'Evidence', body: 'This button adds the inspected sample passage to the demo context. It does not create a finding or claim that a cluster test was run.', expected: 'evidence-chosen', command: 'click-target' },
  { target: 'demo-insert-citation', title: 'Return support to the document', icon: 'Citation', body: 'Insert the labelled citation and watch the real editor change. The wording still states that the passage is a demonstration paraphrase.', expected: 'citation-inserted', command: 'click-target' },
  { target: 'nav-collaborator', title: 'Collaborator works beside the draft', icon: 'Collaborator', body: 'The message icon opens a question-and-answer space using only the selected demo context. Nothing is sent to a live model here.', expected: 'collaborator-opened', command: 'click-target' },
  { target: 'demo-ask-collaborator', title: 'Ask what is still missing', icon: 'Ask', body: 'The sample question asks which facts belong to Java, the container, the Deployment, and the Service. The response is deterministic and clearly labelled.', expected: 'collaborator-asked', command: 'click-target' },
  { target: 'demo-engine-controls', title: 'Four controls check four different things', icon: 'Engines', body: 'These controls examine overclaiming, reasoning, citation boundaries, and structure. They do not silently edit or approve the work.' },
  { target: 'demo-engine-interceptor', title: 'Interceptor catches an overclaim', icon: 'Interceptor', body: 'It notices that “Kubernetes makes it reliable” skips the conditions that reliability depends on. Run it to turn that claim into a research question.', expected: 'engine-interceptor', command: 'click-target' },
  { target: 'demo-engine-socratic', title: 'Socratic Spacer asks for your explanation', icon: 'Socratic', body: 'It asks you to distinguish the application, image, Deployment, and Service in your own words before accepting the conclusion.', expected: 'engine-socratic', command: 'click-target' },
  { target: 'demo-engine-citation', title: 'Citation Sentinel checks the boundary', icon: 'Citation', body: 'It confirms that official documentation can support what Deployment and Service do, but not a claim that this sample application was tested.', expected: 'engine-citation', command: 'click-target' },
  { target: 'demo-engine-scaffold', title: 'Scaffold organizes the answer', icon: 'Scaffold', body: 'It separates the claim, documentation support, operational limitations, and the next practical test without writing the judgement for you.', expected: 'engine-scaffold', command: 'click-target' },
  { target: 'demo-engine-answer', title: 'Record an honest answer', icon: 'Response', body: 'Use the sample answer or write your own, then record it. This response does not become evidence and does not review the finding.', expected: 'engine-answered', manualOnly: true },
  { target: 'demo-preview-revision', title: 'Preview a more accurate claim', icon: 'Preview', body: 'CogDoc selects the broad reliability claim and prepares a narrower replacement. You will see both versions before anything changes.', expected: 'revision-previewed', command: 'select-claim' },
  { target: 'demo-apply-revision', title: 'Apply only after checking the wording', icon: 'Apply', body: 'The proposal names what Deployment and Service add, then keeps health checks, resources, image quality, and operations as limitations.', expected: 'revision-applied', command: 'click-target' },
  { target: 'nav-findings', title: 'Findings separates conclusions from notes', icon: 'Findings', body: 'The checklist icon opens a structured conclusion with its explanation and uncertainty. Draft prose is not automatically a finding.', expected: 'findings-opened', command: 'click-target' },
  { target: 'demo-fill-finding', title: 'Build a finding from clear parts', icon: 'Finding', body: 'Fill the sample conclusion, explanation, and limitation. The example experiment remains explicitly illustrative and was not measured.', expected: 'finding-filled', command: 'click-target' },
  { target: 'demo-review-finding', title: 'Review is a separate decision', icon: 'Review', body: 'Retain the finding with uncertainty only after reading it. No collaborator or reasoning engine can perform this step for you.', expected: 'finding-reviewed', command: 'click-target' },
  { target: 'nav-share', title: 'Share opens composition and export', icon: 'Share', body: 'The pen icon uses the reviewed demo finding to compose an article. It does not publish or download anything automatically.', expected: 'share-opened', command: 'click-target' },
  { target: 'demo-compose-article', title: 'Compose from reviewed material', icon: 'Compose', body: 'Create a deterministic sample article that explains the Java-to-Kubernetes path and preserves the operational limitations.', expected: 'article-composed', command: 'click-target' },
  { target: 'demo-article', title: 'Read the final explanation', icon: 'Article', body: 'The article keeps the simulation label, official documentation leads, and the fact that no live deployment was measured. Choose Next to reach export.' },
  { target: 'demo-export-markdown', title: 'Export requires your click', icon: 'Download', body: 'Click the highlighted button to download meaningful sample Markdown. The coach will never trigger a file download for you.', expected: 'exported', manualOnly: true },
]

function targetElement(name: string) {
  return [...document.querySelectorAll<HTMLElement>(`[data-demo-target="${name}"]`)]
    .find((element) => {
      const bounds = element.getBoundingClientRect()
      const style = window.getComputedStyle(element)
      return bounds.width > 0 && bounds.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
    }) ?? null
}

export default function InteractiveDemoTour({ projectId, onCommand, onRestore, onExit }: {
  projectId: string
  onCommand: (command: TourCommand, target: HTMLElement | null, signal: AbortSignal) => Promise<void> | void
  onRestore: (step: number) => void
  onExit: () => void
}) {
  const storageKey = `cogdoc:interactive-demo:${INTERACTIVE_DEMO_VERSION}:${projectId}`
  const [open, setOpen] = useState(true)
  const [step, setStep] = useState(() => {
    if (typeof window === 'undefined') return 0
    const saved = Number(window.localStorage.getItem(storageKey) ?? 0)
    return Number.isInteger(saved) && saved >= 0 && saved <= INTERACTIVE_DEMO_STEPS.length ? saved : 0
  })
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [missing, setMissing] = useState(false)
  const [running, setRunning] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const cardRef = useRef<HTMLElement>(null)
  const initializedRef = useRef(false)
  const lastAdvancedStepRef = useRef<number | null>(null)
  const openRef = useRef(open)
  const onRestoreRef = useRef(onRestore)
  const stepRef = useRef(step)
  openRef.current = open
  const current = INTERACTIVE_DEMO_STEPS[step]
  onRestoreRef.current = onRestore
  stepRef.current = step

  const advance = useCallback(() => {
    const currentStep = stepRef.current
    if (lastAdvancedStepRef.current === currentStep) return
    lastAdvancedStepRef.current = currentStep
    const next = Math.min(currentStep + 1, INTERACTIVE_DEMO_STEPS.length)
    window.localStorage.setItem(storageKey, String(next))
    setStep(next)
    onRestoreRef.current(next)
  }, [storageKey])

  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true
    onRestore(step)
  }, [onRestore, step])

  useEffect(() => {
    if (!open) return
    const timers = new Set<number>()
    const handler = (event: Event) => {
      if (!openRef.current) return
      const action = String((event as CustomEvent<{ action?: string }>).detail?.action ?? '')
      if (current?.expected !== action) return
      const expectedStep = stepRef.current
      const timer = window.setTimeout(() => {
        timers.delete(timer)
        if (openRef.current && stepRef.current === expectedStep) advance()
      }, 180)
      timers.add(timer)
    }
    window.addEventListener('cogdoc:demo-action', handler)
    return () => {
      window.removeEventListener('cogdoc:demo-action', handler)
      timers.forEach((timer) => window.clearTimeout(timer))
    }
  }, [advance, current?.expected, open])

  useLayoutEffect(() => {
    if (!open || !current) return
    let stopped = false
    let observer: MutationObserver | null = null
    let resizeObserver: ResizeObserver | null = null
    let measure: (() => void) | null = null
    const timers: number[] = []
    const started = Date.now()
    const locate = () => {
      if (stopped) return
      const target = targetElement(current.target)
      if (!target) {
        if (Date.now() - started > 2400) setMissing(true)
        else timers.push(window.setTimeout(locate, 80))
        return
      }
      setMissing(false)
      target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
      measure = () => setRect(target.getBoundingClientRect())
      timers.push(window.setTimeout(measure, 180))
      resizeObserver = new ResizeObserver(measure)
      resizeObserver.observe(target)
      window.addEventListener('resize', measure)
      observer = new MutationObserver(measure)
      observer.observe(target, { attributes: true, childList: true, subtree: true })
    }
    locate()
    return () => {
      stopped = true
      observer?.disconnect()
      resizeObserver?.disconnect()
      timers.forEach((timer) => window.clearTimeout(timer))
      if (measure) window.removeEventListener('resize', measure)
    }
  }, [current, open])

  useEffect(() => {
    if (!open) return
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { openRef.current = false; abortRef.current?.abort(); setRunning(false); setOpen(false) } }
    window.addEventListener('keydown', escape)
    cardRef.current?.focus()
    return () => window.removeEventListener('keydown', escape)
  }, [open, step])

  useEffect(() => () => abortRef.current?.abort(), [])

  async function showMe() {
    if (!current || current.manualOnly) return
    const controller = new AbortController()
    abortRef.current?.abort()
    abortRef.current = controller
    setRunning(true)
    try {
      let target = targetElement(current.target)
      const started = Date.now()
      while (current.command && !target && !controller.signal.aborted && Date.now() - started < 2400) {
        await new Promise((resolve) => window.setTimeout(resolve, 80))
        target = targetElement(current.target)
      }
      if (current.command === 'click-target') target?.click()
      else if (current.command) await onCommand(current.command, target, controller.signal)
      else advance()
    } finally {
      if (!controller.signal.aborted) setRunning(false)
    }
  }

  function back() {
    abortRef.current?.abort(); setRunning(false)
    lastAdvancedStepRef.current = null
    const previous = Math.max(0, step - 1)
    setStep(previous); onRestore(previous)
    window.localStorage.setItem(storageKey, String(previous))
  }

  function restart() {
    abortRef.current?.abort(); setRunning(false); lastAdvancedStepRef.current = null; setStep(0); onRestore(0); openRef.current = true; setOpen(true)
    window.localStorage.setItem(storageKey, '0')
  }

  if (!open) return <Button type="button" onClick={() => { openRef.current = true; setOpen(true) }} className="fixed bottom-4 right-4 z-[80] rounded-xl shadow-lg"><Play className="mr-2 h-4 w-4" />Resume demo</Button>
  if (!current) return <aside ref={cardRef} tabIndex={-1} className="fixed bottom-5 right-5 z-[100] w-[min(25rem,calc(100vw-2.5rem))] rounded-2xl border border-violet-200 bg-[#fbfafc] p-5 shadow-[0_24px_80px_rgba(25,23,36,0.28)] outline-none"><p className="text-xs font-semibold text-violet-800">Interactive demo complete</p><h2 className="mt-2 text-xl font-semibold tracking-[-0.025em]">You completed the Java and Kubernetes journey</h2><p className="mt-2 text-sm leading-6 text-[#62616c]">The source passage, assistant responses, checks, finding, and article were visibly simulated. The official documentation links are real, no cluster was tested, and the Markdown file downloaded only after your click.</p><div className="mt-5 flex flex-wrap justify-between gap-2"><Button variant="ghost" onClick={restart}><RotateCcw className="mr-2 h-4 w-4" />Replay</Button><Button onClick={onExit}>Start my own research<ChevronRight className="ml-2 h-4 w-4" /></Button></div></aside>

  const viewportWidth = typeof window === 'undefined' ? 1024 : window.innerWidth
  const viewportHeight = typeof window === 'undefined' ? 768 : window.innerHeight
  const pad = 8
  const spotlight = rect ? { left: Math.max(6, rect.left - pad), top: Math.max(6, rect.top - pad), width: Math.min(viewportWidth - 12, rect.width + pad * 2), height: Math.min(viewportHeight - 12, rect.height + pad * 2) } : null
  const cardWidth = Math.min(380, viewportWidth - 24)
  const estimatedCardHeight = 300
  const rightSpace = rect ? viewportWidth - rect.right : 0
  const leftSpace = rect?.left ?? 0
  const canSitRight = Boolean(rect && rightSpace >= cardWidth + 28)
  const canSitLeft = Boolean(rect && leftSpace >= cardWidth + 28)
  const below = rect ? rect.bottom + 18 : 20
  const cardTop = canSitRight || canSitLeft
    ? Math.min(viewportHeight - estimatedCardHeight - 12, Math.max(12, rect?.top ?? 12))
    : rect && below + estimatedCardHeight < viewportHeight ? below : rect ? Math.max(12, rect.top - estimatedCardHeight - 18) : 20
  const cardLeft = canSitRight && rect
    ? rect.right + 16
    : canSitLeft && rect ? rect.left - cardWidth - 16 : rect ? Math.min(viewportWidth - cardWidth - 12, Math.max(12, rect.left)) : 12

  return <>
    {spotlight ? <div aria-hidden="true" className="pointer-events-none fixed z-[90] rounded-2xl border-2 border-[#8d7bd1] shadow-[0_0_0_9999px_rgba(29,29,35,0.62),0_0_0_5px_rgba(141,123,209,0.22)] transition-[transform,opacity] duration-300 motion-reduce:transition-none" style={spotlight} /> : <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[90] bg-[rgba(29,29,35,0.62)]" />}
    <aside ref={cardRef} tabIndex={-1} aria-live="polite" aria-label="Interactive demo coach" className="fixed z-[100] rounded-2xl border border-[#d8d2ee] bg-[#fbfafc] p-5 text-[#292831] shadow-[0_24px_80px_rgba(25,23,36,0.32)] outline-none" style={{ top: cardTop, left: cardLeft, width: cardWidth }}>
      <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold text-[#66559f]">{step + 1} of {INTERACTIVE_DEMO_STEPS.length}</p><p className="mt-1 text-[11px] font-medium text-[#777382]">{current.icon} control</p></div><button type="button" onClick={() => { openRef.current = false; abortRef.current?.abort(); setRunning(false); setOpen(false) }} className="rounded-lg p-1.5 text-[#6c6875] hover:bg-[#efedf4]" aria-label="Exit interactive demo"><X className="h-4 w-4" /></button></div>
      <h2 className="mt-3 text-lg font-semibold tracking-[-0.02em]">{current.title}</h2>
      <p className="mt-2 text-sm leading-6 text-[#62616c]">{current.body}</p>
      {missing ? <p className="mt-3 rounded-lg bg-amber-50 p-2.5 text-xs leading-5 text-amber-900" role="status">This control is not visible yet. Use Show me to restore the required panel, or go Back.</p> : null}
      <div className="mt-5 flex items-center justify-between gap-2"><Button type="button" size="sm" variant="ghost" disabled={step === 0} onClick={back}><ArrowLeft className="mr-1.5 h-3.5 w-3.5" />Back</Button><div className="flex gap-2">{running ? <Button type="button" size="sm" variant="outline" onClick={() => { abortRef.current?.abort(); setRunning(false) }}><Pause className="mr-1.5 h-3.5 w-3.5" />Pause</Button> : null}{current.manualOnly ? <span className="max-w-40 self-center text-right text-xs font-medium text-[#66559f]">Complete the highlighted action</span> : <Button type="button" size="sm" onClick={() => void showMe()} disabled={missing && !current.command}>{current.command ? <Play className="mr-1.5 h-3.5 w-3.5" /> : null}{running ? 'Playing' : current.command ? 'Show me' : 'Next'}<ChevronRight className="ml-1.5 h-3.5 w-3.5" /></Button>}</div></div>
      <p className="mt-3 text-[11px] leading-4 text-[#777382]">{current.command || current.manualOnly ? 'Click the highlighted control yourself or choose Show me.' : 'This step explains the highlighted area. Choose Next when you are ready.'} Escape hides the coach without losing progress.</p>
    </aside>
  </>
}
