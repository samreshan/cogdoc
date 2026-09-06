'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ArrowLeft, ChevronRight, Pause, Play, RotateCcw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { INTERACTIVE_DEMO_VERSION } from '@/lib/interactive-demo'

type TourCommand = 'write' | 'select-claim' | 'click-target'

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
  { target: 'document-surface', title: 'Your document is the workspace', icon: 'Document', body: 'The paper stays mounted while research tools open beside it. This sample session is isolated and clearly marked simulated.' },
  { target: 'document-surface', title: 'Watch the argument take shape', icon: 'Document', body: 'Play a paced writing sequence. You can pause, resume, or click into the editor and take over.', expected: 'writing-complete', command: 'write' },
  { target: 'nav-plan', title: 'Plan keeps the question visible', icon: 'Route', body: 'The route icon opens the topic, goal, and editable questions. Click the highlighted icon.', expected: 'plan-opened', command: 'click-target' },
  { target: 'demo-plan-content', title: 'The topic is already filled', icon: 'Question', body: 'A stable question gives discovery and collaboration a durable context. Nothing here was inferred from your own work.' },
  { target: 'nav-sources', title: 'Sources opens the evidence path', icon: 'Book', body: 'The book icon holds source records, access details, and inspected passages. Click it to continue.', expected: 'sources-opened', command: 'click-target' },
  { target: 'demo-run-discovery', title: 'Discovery is visible and bounded', icon: 'Search', body: 'Run the deterministic search replay. It shows queued, searching, and results states without calling live providers.', expected: 'discovery-ready', command: 'click-target' },
  { target: 'demo-open-source', title: 'A source lead is not evidence', icon: 'Book open', body: 'Inspect the verified publication identity and its labelled sample passage before choosing it.', expected: 'source-opened', command: 'click-target' },
  { target: 'demo-source-reader', title: 'Inspection changes the evidence state', icon: 'Reader', body: 'The publication identity is real. The displayed passage is a demonstration paraphrase, never presented as a quotation.' },
  { target: 'demo-use-evidence', title: 'Choose the passage deliberately', icon: 'Check', body: 'This action adds the inspected sample passage to context. It still does not accept a finding.', expected: 'evidence-chosen', command: 'click-target' },
  { target: 'demo-insert-citation', title: 'Citations return to the document', icon: 'Citation', body: 'Insert the sample citation into the real editor. The document visibly evolves while the source boundary remains explicit.', expected: 'citation-inserted', command: 'click-target' },
  { target: 'nav-collaborator', title: 'Collaborator uses chosen context', icon: 'Message', body: 'The message icon opens a conversation beside the draft. Click it to continue.', expected: 'collaborator-opened', command: 'click-target' },
  { target: 'demo-ask-collaborator', title: 'Ask a research question', icon: 'Send', body: 'The replay returns a deterministic answer and a source lead. Real projects use the configured provider and expose failures honestly.', expected: 'collaborator-asked', command: 'click-target' },
  { target: 'demo-engine-controls', title: 'Four engines, four responsibilities', icon: 'Tools', body: 'The engines do not share one generic AI role. Run each control to see where it intervenes.' },
  { target: 'demo-engine-interceptor', title: 'Interceptor protects ownership', icon: 'Shield', body: 'It notices when fluent wording hands reasoning to the tool and reframes the moment as a researcher question.', expected: 'engine-interceptor', command: 'click-target' },
  { target: 'demo-engine-socratic', title: 'Socratic Spacer probes reasoning', icon: 'Question', body: 'It asks for an explanation in the researcher’s own words before a conclusion is treated as settled.', expected: 'engine-socratic', command: 'click-target' },
  { target: 'demo-engine-citation', title: 'Citation Sentinel checks support', icon: 'Citation', body: 'It distinguishes a saved publication record from an inspected passage with a useful locator.', expected: 'engine-citation', command: 'click-target' },
  { target: 'demo-engine-scaffold', title: 'Scaffold structures the argument', icon: 'Structure', body: 'It separates claim, evidence, limitation, and implication without writing the final judgement for the researcher.', expected: 'engine-scaffold', command: 'click-target' },
  { target: 'demo-engine-answer', title: 'Uncertainty is a valid response', icon: 'Reply', body: 'Use the sample answer, then record it. Responding does not create evidence or review the finding.', expected: 'engine-answered', manualOnly: true },
  { target: 'demo-preview-revision', title: 'Preview before changing prose', icon: 'Preview', body: 'CogDoc selects the broad claim and prepares a bounded replacement. Open the preview before applying it.', expected: 'revision-previewed', command: 'select-claim' },
  { target: 'demo-apply-revision', title: 'Apply remains explicit', icon: 'Edit', body: 'The original selection and proposed wording are both visible. Apply only when the change says what you mean.', expected: 'revision-applied', command: 'click-target' },
  { target: 'nav-findings', title: 'Findings hold reasoned conclusions', icon: 'Checklist', body: 'The checklist icon separates a research finding from ordinary draft prose. Click it to continue.', expected: 'findings-opened', command: 'click-target' },
  { target: 'demo-fill-finding', title: 'Build the finding from its parts', icon: 'Form', body: 'Fill a sample conclusion, explanation, uncertainty, and limitation. The values remain visibly simulated.', expected: 'finding-filled', command: 'click-target' },
  { target: 'demo-review-finding', title: 'Review is a separate decision', icon: 'Check', body: 'Retain the sample finding with uncertainty. Engine responses never perform this step automatically.', expected: 'finding-reviewed', command: 'click-target' },
  { target: 'nav-share', title: 'Share opens composition', icon: 'Pen', body: 'The pen icon composes from reviewed current findings. Nothing publishes automatically.', expected: 'share-opened', command: 'click-target' },
  { target: 'demo-compose-article', title: 'Compose from reviewed work', icon: 'Article', body: 'Create a deterministic sample article from the reviewed finding and inspect the result.', expected: 'article-composed', command: 'click-target' },
  { target: 'demo-article', title: 'Inspect the final output', icon: 'Reader', body: 'The article keeps the uncertainty and simulation label visible. In real work, this remains editable before export.' },
  { target: 'demo-export-markdown', title: 'Export requires your click', icon: 'Download', body: 'Click the highlighted control to download meaningful sample Markdown. The tour will never trigger a download for you.', expected: 'exported', manualOnly: true },
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
  const current = INTERACTIVE_DEMO_STEPS[step]

  const advance = useCallback(() => {
    const next = Math.min(step + 1, INTERACTIVE_DEMO_STEPS.length)
    setStep(next)
    onRestore(next)
    window.localStorage.setItem(storageKey, String(next))
  }, [onRestore, step, storageKey])

  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true
    onRestore(step)
  }, [onRestore, step])

  useEffect(() => {
    const handler = (event: Event) => {
      const action = String((event as CustomEvent<{ action?: string }>).detail?.action ?? '')
      if (current?.expected === action) window.setTimeout(advance, 180)
    }
    window.addEventListener('cogdoc:demo-action', handler)
    return () => window.removeEventListener('cogdoc:demo-action', handler)
  }, [advance, current?.expected])

  useLayoutEffect(() => {
    if (!open || !current) return
    let stopped = false
    let observer: MutationObserver | null = null
    let resizeObserver: ResizeObserver | null = null
    let measure: (() => void) | null = null
    const started = Date.now()
    const locate = () => {
      if (stopped) return
      const target = targetElement(current.target)
      if (!target) {
        if (Date.now() - started > 2400) setMissing(true)
        else window.setTimeout(locate, 80)
        return
      }
      setMissing(false)
      target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
      measure = () => setRect(target.getBoundingClientRect())
      window.setTimeout(measure, 180)
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
      if (measure) window.removeEventListener('resize', measure)
    }
  }, [current, open])

  useEffect(() => {
    if (!open) return
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { abortRef.current?.abort(); setRunning(false); setOpen(false) } }
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
      if (current.command === 'click-target') targetElement(current.target)?.click()
      else if (current.command) await onCommand(current.command, targetElement(current.target), controller.signal)
      else advance()
    } finally {
      if (!controller.signal.aborted) setRunning(false)
    }
  }

  function back() {
    abortRef.current?.abort(); setRunning(false)
    const previous = Math.max(0, step - 1)
    setStep(previous); onRestore(previous)
    window.localStorage.setItem(storageKey, String(previous))
  }

  function restart() {
    abortRef.current?.abort(); setRunning(false); setStep(0); onRestore(0); setOpen(true)
    window.localStorage.setItem(storageKey, '0')
  }

  if (!open) return <Button type="button" onClick={() => setOpen(true)} className="fixed bottom-4 right-4 z-[80] rounded-xl shadow-lg"><Play className="mr-2 h-4 w-4" />Resume demo</Button>
  if (!current) return <aside ref={cardRef} tabIndex={-1} className="fixed bottom-5 right-5 z-[100] w-[min(25rem,calc(100vw-2.5rem))] rounded-2xl border border-violet-200 bg-[#fbfafc] p-5 shadow-[0_24px_80px_rgba(25,23,36,0.28)] outline-none"><p className="text-xs font-semibold text-violet-800">Interactive demo complete</p><h2 className="mt-2 text-xl font-semibold tracking-[-0.025em]">You completed the research journey</h2><p className="mt-2 text-sm leading-6 text-[#62616c]">The AI responses, source passage, engines, finding, and article were simulated. The Markdown file was downloaded only when you clicked export.</p><div className="mt-5 flex flex-wrap justify-between gap-2"><Button variant="ghost" onClick={restart}><RotateCcw className="mr-2 h-4 w-4" />Replay</Button><Button onClick={onExit}>Start my own research<ChevronRight className="ml-2 h-4 w-4" /></Button></div></aside>

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
      <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold text-[#66559f]">{step + 1} of {INTERACTIVE_DEMO_STEPS.length}</p><p className="mt-1 text-[11px] font-medium text-[#777382]">{current.icon} control</p></div><button type="button" onClick={() => { abortRef.current?.abort(); setRunning(false); setOpen(false) }} className="rounded-lg p-1.5 text-[#6c6875] hover:bg-[#efedf4]" aria-label="Exit interactive demo"><X className="h-4 w-4" /></button></div>
      <h2 className="mt-3 text-lg font-semibold tracking-[-0.02em]">{current.title}</h2>
      <p className="mt-2 text-sm leading-6 text-[#62616c]">{current.body}</p>
      {missing ? <p className="mt-3 rounded-lg bg-amber-50 p-2.5 text-xs leading-5 text-amber-900" role="status">This control is not visible yet. Use Show me to restore the required panel, or go Back.</p> : null}
      <div className="mt-5 flex items-center justify-between gap-2"><Button type="button" size="sm" variant="ghost" disabled={step === 0} onClick={back}><ArrowLeft className="mr-1.5 h-3.5 w-3.5" />Back</Button><div className="flex gap-2">{running ? <Button type="button" size="sm" variant="outline" onClick={() => { abortRef.current?.abort(); setRunning(false) }}><Pause className="mr-1.5 h-3.5 w-3.5" />Pause</Button> : null}{current.manualOnly ? <span className="max-w-40 self-center text-right text-xs font-medium text-[#66559f]">Complete the highlighted action</span> : <Button type="button" size="sm" onClick={() => void showMe()} disabled={missing && !current.command}>{current.command ? <Play className="mr-1.5 h-3.5 w-3.5" /> : null}{running ? 'Playing' : current.command ? 'Show me' : 'Continue'}<ChevronRight className="ml-1.5 h-3.5 w-3.5" /></Button>}</div></div>
      <p className="mt-3 text-[11px] leading-4 text-[#777382]">You can click the highlighted control yourself. Escape exits. Progress is stored only for this simulated demo.</p>
    </aside>
  </>
}
