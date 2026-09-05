'use client'

import { useState } from 'react'
import { BookOpenCheck, ChevronRight, RotateCcw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { DocumentDockSection } from '@/lib/document-collaborator-contract'

const steps: Array<{ title: string; explanation: string; action: string; section?: DocumentDockSection; document?: boolean }> = [
  { title: 'Read the starter document', explanation: 'The page is demonstration material, not a reviewed conclusion. Edit one sentence so the audience sees that writing stays primary.', action: 'Focus the document and continue', document: true },
  { title: 'Choose the research question', explanation: 'Use the charcoal rail to select the first prefilled question. The guide advances explicitly; the question selection itself is saved by CogDoc.', action: 'Open the plan and continue', section: 'plan' },
  { title: 'Inspect source suggestions', explanation: 'Open Sources. Automatic and prefilled records are leads based on metadata or abstracts—not proof and not yet citations.', action: 'Open Sources and continue', section: 'sources' },
  { title: 'Answer an engine question', explanation: 'Open Collaborator. With the background worker running, a saved source or finding can produce one durable question. Answer it—or say “I’m not sure—help me investigate.” That response is valid but is not evidence or a review.', action: 'Open Collaborator and continue', section: 'collaborator' },
  { title: 'Ask the collaborator', explanation: 'Select a sentence in the document and ask “What evidence would test this idea?” Only the visible question, selection, and source chips are sent.', action: 'Stay in Collaborator and continue', section: 'collaborator' },
  { title: 'Write and review a finding', explanation: 'Open Findings, write your own explanation, attach only inspected material, then save and explicitly review the finding. The demo does not auto-accept it.', action: 'Open Findings and continue', section: 'findings' },
  { title: 'Compose only from reviewed work', explanation: 'Open Share. Article generation is optional and stays separate from the working document; it requires current reviewed finding revisions.', action: 'Open Share and continue', section: 'share' },
  { title: 'Close with the audit boundary', explanation: 'Explain that discovery suggests records, inspection establishes what content was available, and the researcher—not AI—accepts a finding.', action: 'Finish guided demo', document: true },
]

export function GuidedDemoGuide({ projectId, onOpenSection, onFocusDocument }: {
  projectId: string
  onOpenSection: (section: DocumentDockSection) => void
  onFocusDocument: () => void
}) {
  const storageKey = `cogdoc:guided-demo-progress:${projectId}`
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(() => {
    if (typeof window === 'undefined') return 0
    const saved = Number(window.localStorage.getItem(storageKey) ?? 0)
    return Number.isInteger(saved) && saved >= 0 && saved <= steps.length ? saved : 0
  })

  function advance() {
    const current = steps[step]
    if (!current) return
    if (current.section) onOpenSection(current.section)
    if (current.document) onFocusDocument()
    const next = Math.min(step + 1, steps.length)
    setStep(next)
    window.localStorage.setItem(storageKey, String(next))
    if (next === steps.length) setOpen(false)
  }

  function restart() {
    setStep(0)
    setOpen(true)
    window.localStorage.setItem(storageKey, '0')
  }

  return <div className="fixed bottom-4 right-4 z-50">
    {open ? <aside className="w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-[var(--cog-border)] bg-[var(--cog-paper)] p-4 shadow-[0_20px_70px_rgba(32,32,42,0.18)]" aria-label="Guided demo" aria-live="polite">
      <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-medium text-[var(--cog-accent-strong)]">Guided demo · {Math.min(step + 1, steps.length)} of {steps.length}</p><h2 className="mt-1 text-base font-semibold">{steps[step]?.title ?? 'Demo complete'}</h2></div><Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOpen(false)} aria-label="Skip guided demo for now"><X className="h-4 w-4" /></Button></div>
      <p className="mt-3 text-sm leading-6 text-[var(--cog-muted-foreground)]">{steps[step]?.explanation ?? 'You can restart the guide without resetting or deleting this project.'}</p>
      <div className="mt-4 flex items-center justify-between gap-2"><Button type="button" size="sm" variant="ghost" onClick={restart}><RotateCcw className="mr-1.5 h-3.5 w-3.5" />Restart</Button>{step < steps.length ? <Button type="button" size="sm" onClick={advance}>{steps[step].action}<ChevronRight className="ml-1.5 h-3.5 w-3.5" /></Button> : null}</div>
      <p className="mt-3 text-[11px] leading-4 text-[var(--cog-muted-foreground)]">Progress is saved only for this demo project. Continue records that you chose to move on; it does not claim the research action was completed.</p>
    </aside> : <Button type="button" onClick={() => setOpen(true)} className="rounded-xl shadow-lg"><BookOpenCheck className="mr-2 h-4 w-4" />{step >= steps.length ? 'Restart demo guide' : `Demo guide · ${step + 1}/${steps.length}`}</Button>}
  </div>
}
