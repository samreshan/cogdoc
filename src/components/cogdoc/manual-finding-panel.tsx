'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Loader2, Plus, Save, Search, Video, Lightbulb, Clock3, X } from 'lucide-react'
import { api, ApiError } from '@/lib/api-client'
import type { ResearchFindingJourney } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import SourcesResults from './sources-results'
import { FindingReviewPanel } from './finding-review-panel'

function manualExcerpt(metadataJson: string) {
  try {
    const metadata = JSON.parse(metadataJson) as { manualExcerpt?: string; locator?: string | null }
    return metadata.manualExcerpt ? { excerpt: metadata.manualExcerpt, locator: metadata.locator ?? '' } : null
  } catch { return null }
}

function sourceAccess(metadataJson: string, parseStatus: string) {
  try {
    const metadata = JSON.parse(metadataJson) as { accessState?: string; transcriptAvailable?: boolean; medium?: string }
    if (metadata.medium === 'video') return metadata.transcriptAvailable ? 'Video transcript is pending; no transcript text is attached yet.' : 'Video transcript is unavailable; any supplied timestamp note is researcher-supplied.'
    if (parseStatus === 'ready') return 'Extracted full text is available in the existing source tools.'
    if (parseStatus === 'manual_excerpt') return 'Researcher-supplied excerpt is available below.'
    if (metadata.accessState === 'full_text_accessible') return 'A lawful full-text link is known, but Cogdoc has not inspected it.'
    if (metadata.accessState === 'abstract_only') return 'Abstract/metadata only; no full text is available in Cogdoc.'
  } catch { /* retain the honest generic status below */ }
  return 'Metadata only; no passage is available in Cogdoc yet.'
}

export default function ManualFindingPanel({ projectId }: { projectId: string }) {
  const [journey, setJourney] = useState<ResearchFindingJourney | null>(null)
  const [sourceTitle, setSourceTitle] = useState('')
  const [selectedExistingSource, setSelectedExistingSource] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [locator, setLocator] = useState('')
  const [explanation, setExplanation] = useState('')
  const [conclusion, setConclusion] = useState('')
  const [uncertainty, setUncertainty] = useState('')
  const [limitations, setLimitations] = useState('')
  const [conflicts, setConflicts] = useState('')
  const [disposition, setDisposition] = useState('tentative')
  const [evidenceUnavailable, setEvidenceUnavailable] = useState(false)
  const [evidenceScope, setEvidenceScope] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [discoveryOpen, setDiscoveryOpen] = useState(false)
  const [videoTitle, setVideoTitle] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [videoTimestamp, setVideoTimestamp] = useState('')
  const [videoNote, setVideoNote] = useState('')
  const [help, setHelp] = useState<{ title: string; body: string; basis: string; action: string; hypothetical: boolean; noUsefulGap?: boolean; proposal?: { conclusion: string; uncertainty: string; limitations: string; conflicts: string } } | null>(null)
  const [helpKey, setHelpKey] = useState('')
  const [helpExchangeId, setHelpExchangeId] = useState('')
  const [helpProviderStatus, setHelpProviderStatus] = useState<'configured' | 'deterministic_fallback' | null>(null)
  const [helpLoading, setHelpLoading] = useState(false)
  const [proposalIncorporated, setProposalIncorporated] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const next = await api.getFindingJourney(projectId)
      setJourney(next)
      const latest = next.findings[0]?.revisions[0]
      if (latest) {
        setConclusion(latest.conclusion ?? '')
        setExplanation(latest.researcherExplanation ?? next.exchanges[0]?.body ?? '')
        setUncertainty(latest.uncertainty ?? '')
        setLimitations(latest.limitations ?? '')
        setConflicts(latest.conflicts ?? '')
        setEvidenceUnavailable(latest.evidenceUnavailable)
        setEvidenceScope(latest.evidenceScope ?? '')
      } else if (next.exchanges[0]) setExplanation(next.exchanges[0].body)
    } catch (error) {
      setNotice(error instanceof ApiError && error.status === 403 ? 'This feature is not enabled for this workspace.' : (error as Error).message)
    } finally { setLoading(false) }
  }, [projectId])

  useEffect(() => { void refresh() }, [refresh])

  async function act(input: Record<string, unknown>, success: string) {
    setSaving(true); setNotice('')
    try { await api.researchFindingAction(projectId, input); await refresh(); setNotice(success) }
    catch (error) { setNotice((error as Error).message || 'Could not save this research work.') }
    finally { setSaving(false) }
  }

  async function askHelp(kind: 'help' | 'hint' | 'example' | 'alternative' | 'next' | 'proposal', requested = true) {
    if (!journey?.question) return
    setHelpLoading(true); setNotice('')
    try {
      // Save the human wording first. Guidance is never allowed to become the
      // only durable copy of an explanation.
      if (explanation.trim()) {
        await api.researchFindingAction(projectId, { action: 'save_explanation', questionId: journey.question.id, explanation, referencedIds: manualResource ? [manualResource.resource.workspaceSourceId] : [] })
      }
      const result = await api.requestContextualHelp(projectId, { questionId: journey.question.id, explanation, kind, requested })
      if (result.suppressed) { setHelp(null); setNotice(result.message ?? 'This unchanged prompt is saved for later.') }
      else { setHelp(result.help ?? null); setHelpKey(result.contextKey ?? ''); setHelpExchangeId(result.exchange?.id ?? ''); setHelpProviderStatus(result.providerStatus ?? null) }
    } catch (error) { setNotice(`Contextual help is unavailable. Your explanation remains editable: ${(error as Error).message}`) }
    finally { setHelpLoading(false) }
  }

  async function incorporateProposal() {
    if (!help?.proposal || !journey?.question) return
    setSaving(true); setNotice('')
    try {
      await api.researchFindingAction(projectId, { action: 'incorporate_proposal', questionId: journey.question.id, helpExchangeId })
      setConclusion(help.proposal.conclusion); setUncertainty(help.proposal.uncertainty); setLimitations(help.proposal.limitations); setConflicts(help.proposal.conflicts)
      setProposalIncorporated(true)
      setNotice('Proposal copied into the editable finding draft. Your saved explanation remains unchanged.')
    } catch (error) { setNotice((error as Error).message || 'Could not record your proposal choice.') }
    finally { setSaving(false) }
  }

  async function controlHelp(action: 'dismiss' | 'snooze') {
    if (!journey?.question || !helpKey) { setHelp(null); return }
    try { await api.controlContextualHelp(projectId, { questionId: journey.question.id, contextKey: helpKey, action }); setNotice(action === 'dismiss' ? 'Continued without this prompt. It will stay suppressed until your context changes.' : 'Saved for later.'); setHelp(null) }
    catch (error) { setNotice((error as Error).message) }
  }

  async function reviewCurrentFinding(input: { findingRevisionId: string; expectedRevision: number; decision: 'accept' | 'retain_uncertainty' | 'request_more_evidence' | 'withdraw'; note?: string }) {
    if (!latestFinding) return
    setSaving(true); setNotice('')
    try { await api.reviewFindingRevision(projectId, latestFinding.id, input); await refresh(); setNotice('Your review decision was saved for this revision.') }
    catch (error) { setNotice((error as Error).message || 'Could not save this review decision.') }
    finally { setSaving(false) }
  }

  const latestFinding = journey?.findings[0]
  const latestRevision = latestFinding?.revisions[0]
  const latestReviewDecision = latestRevision?.reviews[0]?.decision
  const manualResource = journey?.resources.map((resource) => ({ resource, manual: manualExcerpt(resource.workspaceSource.source.metadataJson) })).find((item) => item.manual)
  const linkedResources = journey?.resources.filter((resource) => !manualExcerpt(resource.workspaceSource.source.metadataJson)) ?? []
  const linkedSourceIds = new Set(journey?.resources.map((resource) => resource.workspaceSourceId) ?? [])
  const availableExistingSources = journey?.workspaceSources.filter((source) => !linkedSourceIds.has(source.id)) ?? []

  if (loading) return <div className="p-5 text-sm text-slate-500"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading research work…</div>
  if (!journey?.question) return <section className="border-t p-5 text-sm text-slate-600">Save a plan and select a question to add sources and findings.</section>

  return <section className="space-y-5 border-t p-5" aria-label="Manual source and finding workspace">
    <header><p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-600">Research work</p><h3 className="mt-1 text-base font-semibold text-slate-900">{journey.question.wording}</h3><p className="mt-1 text-sm text-slate-600">Save a source or lawful excerpt, explain your view, then keep a structured finding.</p></header>
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50/40 p-3"><div className="mr-auto"><p className="text-sm font-medium text-slate-800">Find useful sources</p><p className="text-xs text-slate-600">Get up to three records for this question, or use sources you already own.</p></div><Button size="sm" onClick={() => setDiscoveryOpen(true)}><Search className="mr-2 h-4 w-4" />Find sources</Button></div>
    {!manualResource ? <div className="grid gap-2 rounded-lg border bg-slate-50 p-3"><p className="text-sm font-medium text-slate-800">Add a lawful excerpt</p><Input value={sourceTitle} onChange={(event) => setSourceTitle(event.target.value)} placeholder="Source title or citation label" /><Textarea value={excerpt} onChange={(event) => setExcerpt(event.target.value)} placeholder="Paste only text you may lawfully record here." rows={4} /><Input value={locator} onChange={(event) => setLocator(event.target.value)} placeholder="Locator if known (section, timestamp, page confirmed by you)" /><Button size="sm" variant="outline" disabled={saving || !sourceTitle.trim() || !excerpt.trim()} onClick={() => void act({ action: 'add_manual_excerpt', questionId: journey.question?.id, sourceTitle, excerpt, locator, locatorChecked: Boolean(locator.trim()) }, 'Excerpt saved with researcher-supplied provenance.')}><Plus className="mr-2 h-4 w-4" />Save excerpt</Button></div> : <article className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-3"><p className="text-sm font-medium text-slate-900">{manualResource.resource.workspaceSource.source.title}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{manualResource.manual?.excerpt}</p><p className="mt-2 text-xs text-slate-500">{manualResource.manual?.locator ? `Researcher-supplied locator: ${manualResource.manual.locator}` : 'No locator supplied; this is not presented as a page reference.'}</p></article>}
    {availableExistingSources.length ? <div className="flex flex-wrap items-center gap-2 rounded-lg border p-3"><select value={selectedExistingSource} onChange={(event) => setSelectedExistingSource(event.target.value)} className="h-8 min-w-52 rounded-md border bg-white px-2 text-sm"><option value="">Attach an existing workspace source</option>{availableExistingSources.map((source) => <option key={source.id} value={source.id}>{source.source.title}</option>)}</select><Button size="sm" variant="outline" disabled={saving || !selectedExistingSource} onClick={() => void act({ action: 'attach_source', questionId: journey.question?.id, workspaceSourceId: selectedExistingSource }, 'Existing source linked to this question.')}><Plus className="mr-2 h-4 w-4" />Attach source</Button></div> : null}
    {linkedResources.length ? <section className="space-y-2 rounded-lg border p-3" aria-label="Sources linked to this question"><p className="text-sm font-medium text-slate-800">Sources linked to this question</p>{linkedResources.map((resource) => <article key={resource.id} className="rounded-md bg-slate-50 p-2.5"><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><p className="text-sm font-medium text-slate-800">{resource.workspaceSource.source.title}</p><span className="text-xs text-slate-500">{resource.role === 'orientation' ? 'Learning/background' : 'Evidence candidate'}</span>{resource.workspaceSource.source.canonicalUrl ? <a className="text-xs text-indigo-700 hover:underline" href={resource.workspaceSource.source.canonicalUrl} target="_blank" rel="noreferrer">Open record</a> : null}</div><p className="mt-1 text-xs leading-5 text-slate-600">{sourceAccess(resource.workspaceSource.source.metadataJson, resource.workspaceSource.source.parseStatus)}</p></article>)}</section> : null}
    <details className="rounded-lg border p-3"><summary className="cursor-pointer text-sm font-medium text-slate-800"><Video className="mr-1 inline h-4 w-4" />Add a video or timestamped note</summary><p className="mt-2 text-xs leading-5 text-slate-600">A saved URL is not a watched or analyzed video. If a transcript is unavailable, add only your own timestamped note.</p><div className="mt-3 grid gap-2"><Input value={videoTitle} onChange={(event) => setVideoTitle(event.target.value)} placeholder="Video title" /><Input value={videoUrl} onChange={(event) => setVideoUrl(event.target.value)} placeholder="https://…" /><Input value={videoTimestamp} onChange={(event) => setVideoTimestamp(event.target.value)} placeholder="Timestamp range, e.g. 01:15–02:30 (optional without a note)" /><Textarea value={videoNote} onChange={(event) => setVideoNote(event.target.value)} placeholder="Your timestamped note or lawful supplied excerpt (optional)" rows={3} /><Button size="sm" variant="outline" disabled={saving || !videoTitle.trim() || !videoUrl.trim()} onClick={() => void act({ action: 'add_video_resource', questionId: journey.question?.id, title: videoTitle, url: videoUrl, timestampRange: videoTimestamp, manualNote: videoNote, transcriptAvailable: false, role: 'orientation', rationale: 'Researcher added this video for the selected question.' }, 'Video saved. Transcript unavailable unless you attach lawful text; any note is researcher-supplied.')}><Plus className="mr-2 h-4 w-4" />Save video resource</Button></div></details>
    <label className="grid gap-1.5 text-sm font-medium text-slate-800">Your explanation<Textarea value={explanation} onChange={(event) => setExplanation(event.target.value)} placeholder="Explain how the source affects your current answer, in your own words." rows={4} /></label>
    <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={saving || !explanation.trim()} onClick={() => void act({ action: 'save_explanation', questionId: journey.question?.id, explanation, referencedIds: manualResource ? [manualResource.resource.workspaceSourceId] : [] }, 'Explanation saved.')}><Save className="mr-2 h-4 w-4" />Save explanation</Button><Button size="sm" variant="outline" disabled={helpLoading} onClick={() => void askHelp('help')}><Lightbulb className="mr-2 h-4 w-4" />{helpLoading ? 'Thinking…' : 'Ask about this reasoning'}</Button><Button size="sm" variant="ghost" disabled={helpLoading} onClick={() => void askHelp('hint')}>Hint</Button><Button size="sm" variant="ghost" disabled={helpLoading} onClick={() => void askHelp('example')}>Hypothetical example</Button></div>
    {help ? <aside className="rounded-lg border border-violet-200 bg-violet-50/60 p-3" aria-label="Contextual reasoning help"><p className="text-sm font-semibold text-slate-900">{help.title}</p><p className="mt-1 text-sm leading-6 text-slate-700">{help.body}</p><p className="mt-2 text-xs leading-5 text-slate-600">{help.basis}{help.hypothetical ? ' This example is hypothetical, not evidence.' : ''}</p>{helpProviderStatus === 'deterministic_fallback' ? <p className="mt-2 text-xs text-slate-600">Configured AI was unavailable; this is a deterministic local prompt, not AI analysis.</p> : null}<p className="mt-2 text-xs font-medium text-violet-800">Next: {help.action}</p>{help.proposal ? <div className="mt-3 rounded-md border border-violet-100 bg-white/70 p-2 text-xs text-slate-700"><p className="font-medium">Proposed, editable organization</p><p className="mt-1"><span className="font-medium">Conclusion:</span> {help.proposal.conclusion || 'Not proposed'}</p><p><span className="font-medium">Uncertainty:</span> {help.proposal.uncertainty || 'Not proposed'}</p><p><span className="font-medium">Limitations:</span> {help.proposal.limitations || 'Not proposed'}</p><p><span className="font-medium">Conflicts:</span> {help.proposal.conflicts || 'Not proposed'}</p><Button className="mt-3" size="sm" variant="outline" disabled={saving} onClick={() => void incorporateProposal()}>Use this organization in my draft</Button></div> : <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="ghost" onClick={() => void askHelp('alternative')} >Another perspective</Button><Button size="sm" variant="ghost" onClick={() => void askHelp('next')}>What next?</Button></div>}<div className="mt-3 flex gap-2"><Button size="sm" variant="ghost" onClick={() => void controlHelp('snooze')}><Clock3 className="mr-1 h-3.5 w-3.5" />Later</Button><Button size="sm" variant="ghost" onClick={() => void controlHelp('dismiss')}><X className="mr-1 h-3.5 w-3.5" />Continue without this</Button></div></aside> : null}
    <div className="grid gap-3 rounded-lg border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium text-slate-800">Structured finding</p><Button size="sm" variant="ghost" onClick={() => void askHelp('proposal')} disabled={helpLoading || !explanation.trim()}>Suggest organization</Button><select value={disposition} onChange={(event) => setDisposition(event.target.value)} className="h-8 rounded-md border bg-white px-2 text-sm"><option value="tentative">Tentative</option><option value="supported_with_limits">Supported with limits</option><option value="inconclusive">Inconclusive</option></select></div><Textarea value={conclusion} onChange={(event) => setConclusion(event.target.value)} placeholder="Current conclusion, or state that the evidence is inconclusive." rows={3} /><div className="grid gap-2 md:grid-cols-3"><Textarea value={uncertainty} onChange={(event) => setUncertainty(event.target.value)} placeholder="Uncertainty" rows={2} /><Textarea value={limitations} onChange={(event) => setLimitations(event.target.value)} placeholder="Limitations" rows={2} /><Textarea value={conflicts} onChange={(event) => setConflicts(event.target.value)} placeholder="Conflicts or 'none identified'" rows={2} /></div><label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={evidenceUnavailable} onChange={(event) => setEvidenceUnavailable(event.target.checked)} />No usable evidence is available yet</label>{evidenceUnavailable ? <Input value={evidenceScope} onChange={(event) => setEvidenceScope(event.target.value)} placeholder="What material or search scope did you check?" /> : null}<Button disabled={saving} onClick={() => void act({ action: 'save_finding', questionId: journey.question?.id, findingId: latestFinding?.id, disposition, conclusion, researcherExplanation: explanation, uncertainty, limitations, conflicts, evidenceUnavailable, evidenceScope, origin: proposalIncorporated ? 'assistant_proposal' : 'researcher', evidence: manualResource ? [{ workspaceSourceId: manualResource.resource.workspaceSourceId, excerpt: manualResource.manual?.excerpt, locatorType: manualResource.manual?.locator ? 'external' : null, locatorValue: manualResource.manual?.locator || null, locatorPrecision: manualResource.manual?.locator ? 'user_confirmed' : null, acquisition: 'researcher_supplied', role: 'supports' }] : [] }, 'Finding saved as a new revision.')}><Save className="mr-2 h-4 w-4" />Save finding</Button></div>
    {latestRevision && latestFinding ? <FindingReviewPanel findingRevisionId={latestRevision.id} revision={latestRevision.revision} reviewState={latestFinding.reviewState as 'draft' | 'review_needed' | 'reviewed' | 'archived'} latestDecision={latestReviewDecision as 'accept' | 'retain_uncertainty' | 'request_more_evidence' | 'withdraw' | null} disabled={saving} onReview={reviewCurrentFinding} /> : null}
    {notice ? <p className="text-sm text-slate-700" role="status">{notice}</p> : null}
    <SourcesResults open={discoveryOpen} onOpenChange={setDiscoveryOpen} claim={journey.question.wording} questionId={journey.question.id} purpose={journey.context.purpose} uncertainty={uncertainty || null} onSaved={() => void refresh()} />
  </section>
}
