'use client'

import { useEffect, useState } from 'react'
import { ArrowRight, FileText, HelpCircle, Library, MessageCircleQuestion, PanelRight, ShieldCheck } from 'lucide-react'
import { api } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const AREAS = [
  {
    number: '01',
    label: 'Navigate',
    detail: 'Outline, questions, sources, notes, and history stay in one quiet project map.',
    icon: Library,
  },
  {
    number: '02',
    label: 'Work',
    detail: 'Write in the center. Cogdoc highlights only the passage that needs attention.',
    icon: FileText,
  },
  {
    number: '03',
    label: 'Inspect',
    detail: 'Select a claim or passage to see evidence, quality, backlinks, and citation controls.',
    icon: PanelRight,
  },
]

export default function OnboardingTour() {
  const [open, setOpen] = useState(false)
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

  function complete() {
    window.localStorage.setItem('cogdoc-onboarding-complete', '1')
    void api.setOnboardingCompleted(true).catch(() => {})
    setOpen(false)
  }

  return <>
    {loaded && <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)} className="fixed bottom-5 left-5 z-40 h-8 border-[#dfdbd2] bg-[#fffefb]/95 px-2.5 text-[10px] text-stone-500 backdrop-blur transition-colors hover:bg-white hover:text-stone-800" aria-label="Open Cogdoc tutorial"><HelpCircle className="mr-1.5 h-3.5 w-3.5 text-[#386c5c]" />Guide</Button>}

    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) complete(); else setOpen(true) }}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto border-[#e5e1d8] bg-[#fffefb] p-0 sm:max-w-3xl">
        <div className="p-6 sm:p-9">
          <DialogHeader className="max-w-2xl text-left">
            <div className="mb-5 flex items-center gap-2 text-[10px] font-medium text-[#386c5c]"><span className="h-px w-7 bg-[#6f9185]" />A focused overview</div>
            <DialogTitle className="text-balance font-serif text-3xl font-semibold leading-[1.08] tracking-[-0.03em] text-stone-900 sm:text-4xl">One research workspace. Three quiet roles.</DialogTitle>
            <DialogDescription className="mt-3 max-w-xl text-pretty text-sm leading-6 text-stone-500">Cogdoc keeps your writing central, brings evidence into view, and asks short questions when a claim needs more thought.</DialogDescription>
          </DialogHeader>

          <section className="mt-8 grid border-y border-[#e5e1d8] md:grid-cols-3" aria-label="Cogdoc workspace overview">
            {AREAS.map(({ number, label, detail, icon: Icon }, index) => <article key={label} className={`py-6 md:px-5 ${index > 0 ? 'border-t border-[#e5e1d8] md:border-l md:border-t-0' : ''}`}>
              <div className="flex items-center justify-between"><span className="font-mono text-[9px] text-stone-400">{number}</span><Icon className="h-4 w-4 text-[#527d6e]" /></div>
              <h3 className="mt-7 font-serif text-lg font-semibold text-stone-800">{label}</h3>
              <p className="mt-2 text-[11px] leading-5 text-stone-500">{detail}</p>
            </article>)}
          </section>

          <section className="mt-8 grid gap-5 bg-[#f4f2ed] p-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
            <div className="grid h-10 w-10 place-items-center bg-[#e8eee9] text-[#386c5c]"><MessageCircleQuestion className="h-4 w-4" /></div>
            <div><h3 className="text-xs font-semibold text-stone-800">The working loop</h3><p className="mt-1 text-[11px] leading-5 text-stone-500">Write a claim → notice a highlighted question → answer in your own words → inspect supporting passages → revise with understanding.</p></div>
          </section>

          <div className="mt-7 flex flex-col gap-4 border-t border-[#e5e1d8] pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex max-w-md items-start gap-2 text-[10px] leading-5 text-stone-500"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#527d6e]" />Cogdoc can help structure a draft, but it keeps evidence and unresolved questions visible so you remain responsible for the argument.</p>
            <div className="flex shrink-0 items-center justify-end gap-2"><Button type="button" variant="ghost" onClick={complete} className="text-xs text-stone-500">Skip for now</Button><Button type="button" size="sm" onClick={complete} className="bg-[#173f35] px-4 hover:bg-[#245548]">Open Cogdoc<ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Button></div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </>
}
