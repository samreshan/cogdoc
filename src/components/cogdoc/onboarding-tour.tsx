'use client'

import { useEffect, useState } from 'react'
import {
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  FileSearch,
  GraduationCap,
  HelpCircle,
  Highlighter,
  ShieldCheck,
} from 'lucide-react'
import { api } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const STEPS = [
  {
    eyebrow: 'Welcome to Cogdoc',
    title: 'Keep authorship yours. Make the research visible.',
    description: 'Cogdoc helps you develop, support, and account for academic work. It reviews the process; it does not claim to prove authorship or replace your judgement.',
    icon: GraduationCap,
    points: ['Start blank or import a DOCX', 'Choose Assignment or Research', 'Your work stays private until you share it'],
  },
  {
    eyebrow: 'Write with guidance',
    title: 'Underlines are invitations, not corrections.',
    description: 'Hover an underlined passage to see the intervention. The right pane groups every active intervention so you can return to it later.',
    icon: Highlighter,
    points: ['Click a right-pane item to locate its passage', 'Mark it addressed or dismiss it', 'You decide every change to the draft'],
  },
  {
    eyebrow: 'Research in context',
    title: 'Select a claim and find sources in one step.',
    description: 'Highlight text in the editor, then choose Find sources. Add useful records to the library or upload a PDF for passage-level evidence checks.',
    icon: FileSearch,
    points: ['Search scholarly records from selected text', 'Upload and index PDF sources', 'Review source evidence before citing it'],
  },
  {
    eyebrow: 'Finish with confidence',
    title: 'Review the document, then export the work.',
    description: 'Run the Action queue before submission. Resolve citation and evidence gaps, check the verification report, and export an academic DOCX or PDF.',
    icon: ShieldCheck,
    points: ['Recheck only changed passages', 'Keep an auditable intervention history', 'Export without losing document structure'],
  },
]

export default function OnboardingTour() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    api.getUser()
      .then(({ user }) => {
        if (!user.onboardingCompletedAt) setOpen(true)
      })
      .catch(() => {
        if (window.localStorage.getItem('cogdoc-onboarding-complete') !== '1') setOpen(true)
      })
      .finally(() => setLoaded(true))
  }, [])

  function openTutorial() {
    setStep(0)
    setOpen(true)
  }

  function complete() {
    window.localStorage.setItem('cogdoc-onboarding-complete', '1')
    void api.setOnboardingCompleted(true).catch(() => {})
    setOpen(false)
    setStep(0)
  }

  const current = STEPS[step]
  const Icon = current.icon

  return (
    <>
      {loaded && <Button type="button" variant="outline" size="sm" onClick={openTutorial} className="fixed bottom-5 left-5 z-40 h-9 rounded-lg border-stone-300 bg-[#fffefb]/95 px-3 text-xs text-stone-700 shadow-[0_8px_30px_rgba(50,45,35,0.12)] backdrop-blur transition-all hover:-translate-y-0.5 hover:bg-white active:translate-y-0" aria-label="Open Cogdoc tutorial">
        <HelpCircle className="mr-1.5 h-4 w-4 text-[#28614f]" />Tutorial
      </Button>}

      <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) complete(); else setOpen(true) }}>
        <DialogContent className="overflow-hidden border-stone-200 bg-[#fffefb] p-0 sm:max-w-2xl">
          <div className="grid min-h-[31rem] sm:grid-cols-[0.38fr_0.62fr]">
            <aside className="flex flex-col justify-between bg-[#173f35] p-6 text-white">
              <div>
                <div className="grid h-10 w-10 place-items-center rounded-[10px] bg-white/10 font-mono text-xs font-semibold">CD</div>
                <p className="mt-8 font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-100/70">How Cogdoc works</p>
                <ol className="mt-5 space-y-3" aria-label="Tutorial progress">
                  {STEPS.map((item, index) => <li key={item.eyebrow} className={`flex items-center gap-2 text-xs transition-opacity ${index === step ? 'opacity-100' : 'opacity-45'}`}><span className={`grid h-5 w-5 place-items-center rounded-full border text-[10px] ${index < step ? 'border-emerald-200 bg-emerald-100 text-[#173f35]' : 'border-white/40'}`}>{index < step ? <Check className="h-3 w-3" /> : index + 1}</span><span>{item.eyebrow}</span></li>)}
                </ol>
              </div>
              <p className="text-[11px] leading-5 text-emerald-50/60">Supporting SDG 4: equitable access to tools that strengthen research literacy and independent learning.</p>
            </aside>

            <section className="flex flex-col p-7 sm:p-9">
              <DialogHeader className="text-left">
                <div className="mb-6 grid h-12 w-12 place-items-center rounded-xl bg-[#e4ece7] text-[#28614f]"><Icon className="h-5 w-5" /></div>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#386c5c]">{current.eyebrow}</p>
                <DialogTitle className="mt-2 text-pretty font-serif text-3xl font-semibold leading-tight tracking-[-0.02em] text-stone-900">{current.title}</DialogTitle>
                <DialogDescription className="mt-4 text-pretty text-sm leading-6 text-stone-600">{current.description}</DialogDescription>
              </DialogHeader>
              <ul className="mt-7 space-y-3">
                {current.points.map((point) => <li key={point} className="flex items-start gap-2.5 text-sm text-stone-700"><span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#edf3ef] text-[#28614f]"><Check className="h-3 w-3" /></span><span className="leading-5">{point}</span></li>)}
              </ul>
              <div className="mt-auto flex items-center justify-between pt-8">
                <Button type="button" variant="ghost" onClick={complete} className="text-xs text-stone-500">Skip for now</Button>
                <div className="flex gap-2">
                  {step > 0 && <Button type="button" variant="outline" size="sm" onClick={() => setStep((value) => value - 1)} className="border-stone-300"><ChevronLeft className="mr-1 h-3.5 w-3.5" />Back</Button>}
                  {step < STEPS.length - 1 ? <Button type="button" size="sm" onClick={() => setStep((value) => value + 1)} className="bg-[#173f35] hover:bg-[#245548]">Next<ChevronRight className="ml-1 h-3.5 w-3.5" /></Button> : <Button type="button" size="sm" onClick={complete} className="bg-[#173f35] hover:bg-[#245548]"><BookOpen className="mr-1.5 h-3.5 w-3.5" />Start working</Button>}
                </div>
              </div>
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
