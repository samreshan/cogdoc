'use client'

import { useEffect, useState } from 'react'
import { Loader2, Plus, Sparkles } from 'lucide-react'
import { api, ApiError } from '@/lib/api-client'
import type { ResearchContextSummary, ResearchQuestionSummary } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { QuestionPlan } from '@/components/cogdoc/refined-ui'

interface Props {
  projectId: string
  onReady?: (context: ResearchContextSummary, questions: ResearchQuestionSummary[]) => void
}

export default function InvestigationPlanPanel({ projectId, onReady }: Props) {
  const [context, setContext] = useState<ResearchContextSummary | null>(null)
  const [questions, setQuestions] = useState<ResearchQuestionSummary[]>([])
  const [topic, setTopic] = useState('')
  const [purpose, setPurpose] = useState('')
  const [understanding, setUnderstanding] = useState('')
  const [newQuestion, setNewQuestion] = useState('')
  const [newRationale, setNewRationale] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [enabled, setEnabled] = useState(true)

  useEffect(() => {
    let live = true
    void api.getInvestigation(projectId)
      .then((result) => {
        if (!live) return
        setContext(result.context)
        setQuestions(result.questions)
        setTopic(result.context?.topic ?? '')
        setPurpose(result.context?.purpose ?? '')
        setUnderstanding(result.context?.existingUnderstanding ?? '')
        if (result.context) onReady?.(result.context, result.questions)
      })
      .catch((requestError) => {
        if (!live) return
        if (requestError instanceof ApiError && requestError.status === 403) setEnabled(false)
        else setError(requestError instanceof Error ? requestError.message : 'Could not load the investigation.')
      })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [onReady, projectId])

  async function saveContext() {
    setSaving(true); setError('')
    try {
      const result = await api.saveInvestigation(projectId, {
        topic, purpose, existingUnderstanding: understanding,
        expectedRevision: context?.revision,
      })
      setContext(result.context)
      onReady?.(result.context, questions)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not save the investigation.')
    } finally { setSaving(false) }
  }

  async function addQuestion(wording = newQuestion, rationale = newRationale) {
    if (!wording.trim()) return
    setSaving(true); setError('')
    try {
      const result = await api.createResearchQuestion(projectId, { wording, rationale })
      const next = [...questions, result.question]
      setQuestions(next)
      setContext(result.context)
      setNewQuestion(''); setNewRationale('')
      onReady?.(result.context, next)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not save the question.')
    } finally { setSaving(false) }
  }

  async function addProposal() {
    if (!topic.trim()) { setError('Add a topic before using the question template.'); return }
    setSaving(true); setError('')
    try {
      const result = await api.proposeInvestigationPlan(projectId, { topic, purpose })
      const created: ResearchQuestionSummary[] = []
      let updatedContext = context
      for (const item of result.proposal) {
        const response = await api.createResearchQuestion(projectId, item)
        created.push(response.question)
        updatedContext = response.context
      }
      const next = [...questions, ...created]
      setQuestions(next)
      if (updatedContext) {
        setContext(updatedContext)
        onReady?.(updatedContext, next)
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not prepare a question template.')
    } finally { setSaving(false) }
  }

  if (!enabled) return <section className="p-5 text-sm leading-6 text-slate-600" aria-label="Investigation plan unavailable">This workspace is using the existing research experience. Enable the research collaborator feature to start an investigation plan.</section>
  if (loading) return <div className="p-4 text-sm text-slate-500" role="status"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading investigation…</div>

  return <section className="space-y-4 p-4" aria-label="Investigation plan">
    <div className="grid gap-3 md:grid-cols-2">
      <label className="grid gap-1.5 text-sm font-medium text-slate-800">Topic<Input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="For example, urban heat and sleep" /></label>
      <label className="grid gap-1.5 text-sm font-medium text-slate-800">Purpose (optional)<Input value={purpose} onChange={(event) => setPurpose(event.target.value)} placeholder="What would be useful to understand?" /></label>
    </div>
    <label className="grid gap-1.5 text-sm font-medium text-slate-800">What do you understand so far?<Textarea value={understanding} onChange={(event) => setUnderstanding(event.target.value)} placeholder="It is fine to say you are not sure yet." /></label>
    <div className="flex flex-wrap gap-2"><Button onClick={() => void saveContext()} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{context ? 'Save plan context' : 'Start investigation'}</Button><Button variant="outline" onClick={() => void addProposal()} disabled={saving || !context}><Sparkles className="mr-2 h-4 w-4" />Question template</Button></div>
    {context ? <QuestionPlan topic={context.topic} purpose={context.purpose ?? undefined} questions={questions.map((question) => ({ id: question.id, title: question.wording, purpose: question.rationale ?? undefined, state: question.state === 'answered_for_now' ? 'answered' : question.state === 'archived' ? 'archived' : 'active' }))} selectedQuestionId={context.selectedQuestionId ?? undefined} onSelectQuestion={(questionId) => void api.updateResearchQuestion(projectId, { action: 'select', questionId, expectedRevision: context.revision }).then((result) => result.context && setContext(result.context)).catch((requestError) => setError(requestError.message))} /> : null}
    {context ? <div className="grid gap-2 border-t pt-4 md:grid-cols-[1fr_auto]"><div className="grid gap-2"><Input value={newQuestion} onChange={(event) => setNewQuestion(event.target.value)} placeholder="Add a question to investigate" aria-label="New research question" /><Input value={newRationale} onChange={(event) => setNewRationale(event.target.value)} placeholder="Why does this question matter? (optional)" aria-label="Question rationale" /></div><Button variant="outline" onClick={() => void addQuestion()} disabled={saving || !newQuestion.trim()}><Plus className="mr-2 h-4 w-4" />Add question</Button></div> : null}
    {error ? <p className="text-sm text-rose-700" role="alert">{error}</p> : null}
  </section>
}
