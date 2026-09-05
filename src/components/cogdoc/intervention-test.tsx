'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, BrainCircuit, Check, Loader2, RotateCcw, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { useCogdoc } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { interventionQuestion } from '@/lib/intervention-language'

interface Props { open: boolean; onOpenChange: (open: boolean) => void }

export default function InterventionTest({ open, onOpenChange }: Props) {
  const interventions = useCogdoc((state) => state.activeInterventions)
  const updateIntervention = useCogdoc((state) => state.updateIntervention)
  const removeIntervention = useCogdoc((state) => state.removeIntervention)
  const openIdeTab = useCogdoc((state) => state.openIdeTab)
  const setSourceMapperQuery = useCogdoc((state) => state.setSourceMapperQuery)
  const [answer, setAnswer] = useState('')
  const [feedback, setFeedback] = useState('')
  const [loading, setLoading] = useState(false)
  const [proposal, setProposal] = useState('')
  const [tested, setTested] = useState<{ id: string; projectId: string; passage: string } | null>(null)
  const active = useMemo(() => interventions.filter((item) => item.status === 'active'), [interventions])
  const current = active[0] ?? null

  useEffect(() => {
    if (open) return
    setAnswer('')
    setFeedback('')
    setProposal('')
    setTested(null)
  }, [open])

  async function submit() {
    if (!current || answer.trim().split(/\s+/).filter(Boolean).length < 4) {
      setFeedback('Say a little more so Cogdoc can understand your answer.')
      return
    }
    setLoading(true)
    setFeedback('')
    try {
      const result = await api.answerIntervention(current.id, answer.trim())
      updateIntervention(current.id, result.intervention)
      if (!result.satisfied) {
        setFeedback(`${result.evaluation.rationale} Cogdoc has a follow-up question.`)
        setAnswer('')
        return
      }
      setTested({ id: current.id, projectId: current.projectId, passage: current.promptText ?? '' })
      setProposal(result.revisionProposal ?? '')
      setFeedback(result.evaluation.rationale)
    } catch (error) {
      setFeedback((error as Error).message || 'Cogdoc could not evaluate this answer.')
    } finally {
      setLoading(false)
    }
  }

  async function applyProposal() {
    if (!tested || !proposal.trim()) return
    setLoading(true)
    try {
      await api.recordDecision(tested.projectId, { type: 'intervention_revision_applied', summary: 'Applied a passage revision after answering an intervention', entityType: 'intervention', entityId: tested.id })
      window.dispatchEvent(new CustomEvent('cogdoc:replace-research-passage', { detail: { passage: tested.passage, replacement: proposal.trim() } }))
    } catch (error) {
      setFeedback(`The revision was not applied because decision history could not be recorded: ${(error as Error).message}`)
      return
    } finally { setLoading(false) }
    removeIntervention(tested.id)
    toast.success('Passage restructured from your answer', { description: 'The editor change remains undoable.' })
    setProposal('')
    setTested(null)
    setAnswer('')
    setFeedback('')
    if (active.length <= 1) onOpenChange(false)
  }

  async function continueWithoutRewrite() {
    if (tested) {
      setLoading(true)
      try {
        await api.recordDecision(tested.projectId, { type: 'intervention_revision_declined', summary: 'Kept the original passage after resolving an intervention', entityType: 'intervention', entityId: tested.id })
        removeIntervention(tested.id)
      } catch (error) {
        setFeedback(`The choice was not completed because decision history could not be recorded: ${(error as Error).message}`)
        return
      } finally { setLoading(false) }
    }
    setProposal('')
    setTested(null)
    setAnswer('')
    setFeedback('')
    if (active.length <= 1) onOpenChange(false)
  }

  function searchSources() {
    if (!current?.promptText) return
    setSourceMapperQuery(current.promptText)
    openIdeTab({ id: 'sources', kind: 'sources', label: 'Source mapper', closable: true })
    onOpenChange(false)
  }

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent showCloseButton={false} className="h-[calc(100dvh-1rem)] max-h-[52rem] w-[calc(100vw-1rem)] max-w-none overflow-hidden border-stone-200 bg-[#fffefb] p-0 sm:h-[90dvh] sm:max-w-3xl">
      <DialogClose className="absolute right-3 top-3 z-20 grid h-8 w-8 place-items-center rounded-md text-white/75 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:right-4 sm:top-4 sm:text-stone-500 sm:hover:bg-stone-100 sm:hover:text-stone-900 sm:focus-visible:outline-[#386c5c]" aria-label="Close intervention test"><X className="h-4 w-4" /></DialogClose>
      <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] sm:grid-cols-[13.5rem_minmax(0,1fr)] sm:grid-rows-1">
        <aside className="flex min-w-0 items-center justify-between gap-4 bg-[#173f35] px-4 py-3 pr-12 text-white sm:flex-col sm:items-stretch sm:p-6">
          <div className="flex min-w-0 items-center gap-3 sm:block"><div className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-white/10 sm:h-10 sm:w-10"><BrainCircuit className="h-4 w-4 sm:h-5 sm:w-5" /></div><div className="min-w-0"><p className="font-mono text-[9px] uppercase tracking-[.18em] text-emerald-100/65 sm:mt-7">Intervention test</p><p className="mt-3 hidden text-sm leading-6 text-emerald-50/80 sm:block">Cogdoc will challenge the answer until your reasoning is specific enough to reshape the passage.</p></div></div><p className="shrink-0 font-mono text-[9px] tabular-nums text-emerald-50/60 sm:text-[10px]">{active.length} remaining</p>
        </aside>
        <section data-testid="intervention-test-scroll-region" className="min-h-0 min-w-0 overflow-y-auto overscroll-contain px-5 pb-4 pt-6 sm:px-9 sm:pb-6 sm:pt-9">
          {tested ? <div className="flex min-h-full flex-col"><DialogHeader className="text-left"><p className="font-mono text-[10px] uppercase tracking-[.18em] text-[#386c5c]">Understanding demonstrated</p><DialogTitle className="mt-2 text-pretty font-serif text-2xl font-semibold leading-tight tracking-[-.025em] sm:mt-3 sm:text-3xl">Restructure the passage from your answer</DialogTitle><DialogDescription className="mt-2 leading-6 sm:mt-3">Cogdoc has proposed a revision using only the reasoning you supplied. Edit it before applying.</DialogDescription></DialogHeader>{proposal ? <Textarea value={proposal} onChange={(event) => setProposal(event.target.value)} rows={10} className="mt-5 min-h-48 resize-y bg-white font-serif text-base leading-7 sm:mt-6" /> : <div className="mt-6 bg-[#f1eee6] p-4 text-sm leading-6 text-stone-600 sm:mt-8">Your answer resolved the intervention. No safe restructuring proposal was available, so the original wording remains yours to revise.</div>}<p className="mt-3 text-xs leading-5 text-[#386c5c]" role="status"><Check className="mr-1 inline h-3.5 w-3.5" />{feedback}</p><div className="sticky bottom-0 -mx-5 mt-auto flex items-center justify-between gap-3 border-t border-stone-200 bg-[#fffefb]/95 px-5 pb-1 pt-4 backdrop-blur-sm sm:-mx-9 sm:px-9"><Button variant="ghost" onClick={() => void continueWithoutRewrite()} disabled={loading}>Keep original</Button>{proposal && <Button onClick={() => void applyProposal()} disabled={loading} className="bg-[#173f35] hover:bg-[#245548] active:translate-y-px">{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Apply restructuring<ArrowRight className="ml-1.5 h-4 w-4" /></Button>}</div></div> : current ? <div className="flex min-h-full flex-col"><DialogHeader className="text-left"><p className="font-mono text-[10px] uppercase tracking-[.18em] text-[#386c5c]">A question about this passage</p><DialogTitle className="mt-2 text-pretty font-serif text-2xl font-semibold leading-tight tracking-[-.025em] sm:mt-3 sm:text-3xl">{interventionQuestion(current)}</DialogTitle><DialogDescription className="mt-3 max-h-32 overflow-y-auto border-l-2 border-[#c8ad7f] pl-3 font-serif italic leading-6">{current.promptText}</DialogDescription></DialogHeader><Textarea autoFocus value={answer} onChange={(event) => { setAnswer(event.target.value); setFeedback('') }} rows={8} placeholder="Answer in your own words…" className="mt-5 min-h-40 resize-y bg-white text-base leading-7 sm:mt-7" /><p className={`mt-3 text-xs leading-5 ${feedback ? 'text-amber-700' : 'text-stone-500'}`} role="status">{feedback || 'A short, clear reason or example is enough.'}</p><div className="sticky bottom-0 -mx-5 mt-auto flex items-center justify-between gap-2 border-t border-stone-200 bg-[#fffefb]/95 px-5 pb-1 pt-4 backdrop-blur-sm sm:-mx-9 sm:px-9"><Button variant="ghost" onClick={searchSources}><Search className="mr-1.5 h-4 w-4" />Search sources</Button><Button onClick={() => void submit()} disabled={loading} className="bg-[#173f35] hover:bg-[#245548] active:translate-y-px">{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BrainCircuit className="mr-2 h-4 w-4" />}Continue</Button></div></div> : <div className="flex min-h-full flex-col items-center justify-center px-4 text-center"><Check className="h-7 w-7 text-[#386c5c]" /><h2 className="mt-4 font-serif text-2xl font-semibold">No active interventions</h2><p className="mt-2 max-w-sm text-sm leading-6 text-stone-500">Keep writing. Cogdoc will highlight assumptions, evidence gaps, and unclear reasoning as they appear.</p><Button variant="ghost" onClick={() => onOpenChange(false)} className="mt-6"><RotateCcw className="mr-1.5 h-4 w-4" />Return to writing</Button></div>}
        </section>
      </div>
    </DialogContent>
  </Dialog>
}
