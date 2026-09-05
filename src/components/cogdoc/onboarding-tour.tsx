'use client'

import { useState } from 'react'
import { BookOpen, HelpCircle, Library, MessageSquareText } from 'lucide-react'
import { api } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const AREAS = [
  { label: 'Write', detail: 'Your document is the main workspace. Start with a sentence, note, or rough outline.', icon: BookOpen },
  { label: 'Check sources', detail: 'Open source details and insert citations without leaving the document behind.', icon: Library },
  { label: 'Work with Cogdoc', detail: 'Ask free-form questions using the passage and sources you choose.', icon: MessageSquareText },
]

export default function OnboardingTour() {
  const [open, setOpen] = useState(false)

  function close() {
    window.localStorage.setItem('cogdoc-onboarding-complete', '1')
    void api.setOnboardingCompleted(true).catch(() => {})
    setOpen(false)
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)} className="fixed bottom-4 left-4 z-40 h-9 rounded-xl border-[#cfd1d8] bg-[#f8f9fa]/95 px-3 text-xs text-[#5f616b] shadow-sm backdrop-blur hover:bg-white hover:text-[#292930]" aria-label="Open Cogdoc guide"><HelpCircle className="mr-2 size-4 text-[#6858a8]" />Guide</Button>
      <Dialog open={open} onOpenChange={(nextOpen) => nextOpen ? setOpen(true) : close()}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border-[#d9dbe2] bg-[#f8f9fa] sm:max-w-xl">
          <DialogHeader className="text-left"><DialogTitle className="text-2xl font-semibold tracking-[-0.03em] text-[#292930]">The document stays central.</DialogTitle><DialogDescription className="mt-2 text-sm leading-6 text-[#62646e]">Use research tools when they help, then return to the same writing position.</DialogDescription></DialogHeader>
          <div className="mt-3 space-y-2">
            {AREAS.map(({ label, detail, icon: Icon }) => <section key={label} className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-3 rounded-xl border border-[#dfe1e6] bg-white p-4"><span className="grid size-9 place-items-center rounded-lg bg-[#ebe8f4] text-[#6858a8]"><Icon className="size-4" aria-hidden="true" /></span><div><h3 className="text-sm font-semibold text-[#30313a]">{label}</h3><p className="mt-1 text-sm leading-5 text-[#666873]">{detail}</p></div></section>)}
          </div>
          <div className="mt-4 flex justify-end"><Button type="button" onClick={close} className="rounded-xl bg-[#6858a8] text-white hover:bg-[#594a93]">Got it</Button></div>
        </DialogContent>
      </Dialog>
    </>
  )
}
