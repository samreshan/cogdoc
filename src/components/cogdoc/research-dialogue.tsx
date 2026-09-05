'use client'

import { useState } from 'react'
import { ArrowLeft, ArrowRight, BrainCircuit, Loader2, RotateCcw, TextCursorInput, X } from 'lucide-react'
import { toast } from 'sonner'
import type { Project, ResearchDialogueAnswers, ResearchDialogueDraft } from '@/lib/types'
import { api, ApiError } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'

const STEPS: Array<{
  field: keyof ResearchDialogueAnswers
  eyebrow: string
  question: string
  help: string
  minimumWords: number
}> = [
  { field: 'focus', eyebrow: 'Your idea', question: 'What are you trying to say?', help: 'Say it naturally. A rough answer is fine.', minimumWords: 4 },
  { field: 'evidence', eyebrow: 'Your reason', question: 'What makes you think that?', help: 'Give one reason, example, or source.', minimumWords: 4 },
  { field: 'tension', eyebrow: 'Another view', question: 'What else could be true?', help: 'Name a different view, exception, or doubt.', minimumWords: 4 },
  { field: 'contribution', eyebrow: 'The takeaway', question: 'What should the reader remember?', help: 'One clear takeaway is enough.', minimumWords: 4 },
]

const EMPTY_ANSWERS: ResearchDialogueAnswers = { focus: '', evidence: '', tension: '', contribution: '' }

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: Project
}

export default function ResearchDialogue({ open, onOpenChange, project }: Props) {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<ResearchDialogueAnswers>(EMPTY_ANSWERS)
  const [result, setResult] = useState<ResearchDialogueDraft | null>(null)
  const [draft, setDraft] = useState('')
  const [generating, setGenerating] = useState(false)
  const [feedback, setFeedback] = useState('')
  const current = STEPS[step]
  const currentAnswer = current ? answers[current.field] : ''
  const currentWords = currentAnswer.trim().split(/\s+/).filter(Boolean).length

  function reset() {
    setStep(0)
    setAnswers(EMPTY_ANSWERS)
    setResult(null)
    setDraft('')
    setFeedback('')
  }

  function advance() {
    if (!current) return
    if (currentWords < current.minimumWords) {
      setFeedback(`Say a little more—about ${current.minimumWords} words is enough to make this specific.`)
      return
    }
    setFeedback('')
    setStep((value) => Math.min(STEPS.length - 1, value + 1))
  }

  async function generate() {
    if (!current || currentWords < current.minimumWords) {
      setFeedback(`Say a little more—about ${current?.minimumWords ?? 6} words is enough to make this specific.`)
      return
    }
    setGenerating(true)
    setFeedback('')
    try {
      const response = await api.draftFromResearchDialogue(project.id, answers)
      setResult(response)
      setDraft(response.draft)
    } catch (error) {
      if (error instanceof ApiError && error.status === 422) {
        const field = String(error.payload.field ?? '') as keyof ResearchDialogueAnswers
        const index = STEPS.findIndex((item) => item.field === field)
        if (index >= 0) setStep(index)
      }
      setFeedback((error as Error).message || 'Cogdoc could not create the working draft.')
    } finally {
      setGenerating(false)
    }
  }

  async function insertDraft() {
    const value = draft.trim()
    if (!value) return
    setGenerating(true)
    setFeedback('')
    try {
      await api.recordDecision(project.id, { type: 'research_draft_inserted', summary: 'Inserted a working draft built from the research conversation', entityType: 'document', detail: { sourceNeeds: result?.sourceNeeds.length ?? 0 } })
      window.dispatchEvent(new CustomEvent('cogdoc:insert-research-draft', { detail: { draft: value } }))
      toast.success('Working draft inserted', { description: 'Read it closely and revise any wording that is not genuinely yours.' })
      onOpenChange(false)
      reset()
    } catch (error) {
      setFeedback(`The draft was not inserted because decision history could not be recorded: ${(error as Error).message}`)
    } finally { setGenerating(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="h-[calc(100dvh-1rem)] max-h-[52rem] w-[calc(100vw-1rem)] max-w-none overflow-hidden border-stone-200 bg-[#fffefb] p-0 sm:h-[90dvh] sm:max-w-3xl">
        <DialogClose className="absolute right-3 top-3 z-20 grid h-8 w-8 place-items-center rounded-md text-white/75 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:right-4 sm:top-4 sm:text-stone-500 sm:hover:bg-stone-100 sm:hover:text-stone-900 sm:focus-visible:outline-[#386c5c]" aria-label="Close research dialogue"><X className="h-4 w-4" /></DialogClose>
        <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] sm:grid-cols-[13.5rem_minmax(0,1fr)] sm:grid-rows-1">
          <aside className="flex min-w-0 items-center justify-between gap-4 bg-[#173f35] px-4 py-3 pr-12 text-white sm:flex-col sm:items-stretch sm:p-6">
            <div>
              <div className="hidden h-10 w-10 place-items-center rounded-[10px] bg-white/10 sm:grid"><BrainCircuit className="h-5 w-5" /></div>
              <p className="font-mono text-[9px] uppercase tracking-[0.19em] text-emerald-100/65 sm:mt-7">Think before drafting</p>
              <p className="mt-3 hidden text-sm leading-6 text-emerald-50/80 sm:block">Cogdoc can help write after it can see how you understand the question.</p>
            </div>
            <div className="min-w-28 sm:min-w-0">
              <div className="flex gap-1.5" aria-label={`Question ${result ? STEPS.length : step + 1} of ${STEPS.length}`}>
                {STEPS.map((item, index) => <span key={item.field} className={`h-1 flex-1 rounded-full ${result || index <= step ? 'bg-emerald-100' : 'bg-white/20'}`} />)}
              </div>
              <p className="mt-3 hidden text-[10px] leading-4 text-emerald-50/55 sm:block">This is a conversation, not a test. Plain answers are welcome.</p>
            </div>
          </aside>

          <section data-testid="research-dialogue-scroll-region" className="flex min-h-0 min-w-0 flex-col overflow-y-auto overscroll-contain p-5 sm:p-9">
            {!result && current ? (
              <>
                <DialogHeader className="text-left">
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#386c5c]">{current.eyebrow}</p>
                  <DialogTitle className="mt-3 text-pretty font-serif text-3xl font-semibold leading-tight tracking-[-0.025em] text-stone-900">{current.question}</DialogTitle>
                  <DialogDescription className="mt-3 text-sm leading-6 text-stone-500">{current.help}</DialogDescription>
                </DialogHeader>
                <Textarea
                  autoFocus
                  value={currentAnswer}
                  onChange={(event) => { setAnswers((value) => ({ ...value, [current.field]: event.target.value })); setFeedback('') }}
                  rows={8}
                  className="mt-7 resize-none border-stone-300 bg-white text-base leading-7"
                  placeholder="Explain your thinking here…"
                  aria-describedby="research-dialogue-guidance"
                />
                <div id="research-dialogue-guidance" className="mt-2 flex items-start justify-between gap-4 text-xs">
                  <p className={feedback ? 'text-amber-700' : 'text-stone-500'}>{feedback || 'Cogdoc uses only what you choose to share in this dialogue.'}</p>
                  <span className={`shrink-0 font-mono tabular-nums ${currentWords >= current.minimumWords ? 'text-[#386c5c]' : 'text-stone-400'}`}>{currentWords} words</span>
                </div>
                <div className="mt-auto flex items-center justify-between pt-8">
                  <Button variant="ghost" onClick={() => step === 0 ? onOpenChange(false) : setStep((value) => value - 1)}>{step > 0 && <ArrowLeft className="mr-1.5 h-4 w-4" />}{step === 0 ? 'Close' : 'Back'}</Button>
                  {step < STEPS.length - 1
                    ? <Button onClick={advance} className="bg-[#173f35] hover:bg-[#245548]">Continue<ArrowRight className="ml-1.5 h-4 w-4" /></Button>
                    : <Button onClick={() => void generate()} disabled={generating} className="bg-[#173f35] hover:bg-[#245548]">{generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" /> : <BrainCircuit className="mr-2 h-4 w-4" />}Create working draft</Button>}
                </div>
              </>
            ) : result ? (
              <>
                <DialogHeader className="text-left">
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#386c5c]">Working draft</p>
                  <DialogTitle className="mt-3 font-serif text-3xl font-semibold tracking-[-0.025em]">Built from your reasoning</DialogTitle>
                  <DialogDescription className="mt-3 leading-6">Edit this before inserting it. Cogdoc marks unsupported claims as source needs instead of inventing citations.</DialogDescription>
                </DialogHeader>
                <Textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={11} className="mt-6 resize-none border-stone-300 bg-white font-serif text-base leading-7" />
                <div className="mt-4 rounded-lg bg-[#f1eee6] p-3 text-xs leading-5 text-stone-600"><span className="font-semibold text-stone-800">Check your understanding:</span> {result.reflection}</div>
                {result.sourceNeeds.length > 0 && <p className="mt-3 text-xs leading-5 text-stone-500"><span className="font-medium text-stone-700">Evidence to find:</span> {result.sourceNeeds.join(' · ')}</p>}
                <div className="mt-auto flex items-center justify-between pt-7"><Button variant="ghost" onClick={reset}><RotateCcw className="mr-1.5 h-4 w-4" />Start again</Button><Button onClick={() => void insertDraft()} disabled={!draft.trim() || generating} className="bg-[#173f35] hover:bg-[#245548]">{generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TextCursorInput className="mr-2 h-4 w-4" />}Insert at cursor</Button></div>
              </>
            ) : null}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
