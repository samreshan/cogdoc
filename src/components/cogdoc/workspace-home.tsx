'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, CalendarClock, CheckCircle2, FileInput, FileText, FlaskConical, Library, Loader2, ScanSearch, ShieldCheck, Upload, Waypoints } from 'lucide-react'
import { toast } from 'sonner'
import { useCogdoc } from '@/lib/store'
import { api } from '@/lib/api-client'
import type { Project, ReviewItem, ReviewRun, VerificationReport } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { CitationStyle } from '@/lib/workspace'

type WorkspaceDetail = Project & {
  reviewItems?: ReviewItem[]
  reviewRuns?: ReviewRun[]
  reports?: VerificationReport[]
  codeSnapshots?: Array<{ id: string; filename: string; snapshotHash: string; _count?: { files: number } }>
  certificates?: Array<{ id: string; status: string }>
  assets?: Array<{ id: string; kind: string; filename: string; warningsJson: string; createdAt: string }>
}

export default function WorkspaceHome() {
  const active = useCogdoc((state) => state.activeProject)
  const setActive = useCogdoc((state) => state.setActiveProject)
  const setView = useCogdoc((state) => state.setView)
  const [workspace, setWorkspace] = useState<WorkspaceDetail | null>(active)
  const [scanning, setScanning] = useState(false)
  const [uploading, setUploading] = useState<'docx' | 'brief' | 'code' | null>(null)
  const docxRef = useRef<HTMLInputElement>(null)
  const briefRef = useRef<HTMLInputElement>(null)
  const codeRef = useRef<HTMLInputElement>(null)

  async function refresh() {
    if (!active) return
    const { workspace: latest } = await api.getWorkspace(active.id)
    setWorkspace(latest as WorkspaceDetail)
    setActive(latest)
  }

  useEffect(() => { refresh().catch(() => {}) }, [active?.id])
  if (!workspace) return null
  const workspaceId = workspace.id

  const latestRun = workspace.reviewRuns?.[0]
  const latestItems = latestRun ? (workspace.reviewItems ?? []).filter((item) => item.reviewRunId === latestRun.id) : []
  const critical = latestItems.filter((item) => item.blocksCertification && item.state !== 'resolved')
  const completed = latestItems.filter((item) => item.state === 'resolved')
  const certificate = workspace.certificates?.find((entry) => entry.status === 'valid')
  const importedDocx = workspace.assets?.find((asset) => asset.kind === 'original_docx')
  const compatibility = (() => {
    if (!importedDocx) return null
    try {
      const parsed = JSON.parse(importedDocx.warningsJson) as { warnings?: string[]; converterMessages?: Array<{ message: string }> } | string[]
      return Array.isArray(parsed) ? { warnings: parsed, converterMessages: [] } : parsed
    } catch { return null }
  })()

  async function startReview() {
    setScanning(true)
    try {
      const { reviewRun } = await api.startReview(workspaceId)
      await refresh()
      toast.success('Review ready', { description: `${reviewRun.items?.length ?? 0} focused actions found.` })
    } catch (error) {
      toast.error('Review could not finish', { description: (error as Error).message })
    } finally {
      setScanning(false)
    }
  }

  async function updatePace(value: 'rapid' | 'guided' | 'deep') {
    try {
      const { workspace: updated } = await api.updateWorkspace(workspaceId, { reviewPace: value })
      setWorkspace((current) => current ? { ...current, ...updated } : current)
      setActive({ ...workspace, ...updated })
    } catch (error) {
      toast.error('Could not change review pace', { description: (error as Error).message })
    }
  }

  async function updateCitationStyle(value: CitationStyle) {
    try {
      const result = await api.updateWorkspace(workspaceId, { citationStyle: value })
      const updated = result.workspace
      setWorkspace((current) => current ? { ...current, ...updated } : current)
      setActive({ ...workspace, ...updated })
      const reformatted = result.referencesReformatted ?? 0
      const needsReview = result.referencesNeedingReview ?? 0
      toast.success(value === 'apa' ? 'APA style applied' : 'Harvard style applied', {
        description: needsReview
          ? `${reformatted} saved references reformatted; ${needsReview} imported references still need a manual check.`
          : `${reformatted} saved references reformatted.`,
      })
    } catch (error) {
      toast.error('Could not change citation style', { description: (error as Error).message })
    }
  }

  async function importFile(file: File, kind: 'docx' | 'brief' | 'code') {
    setUploading(kind)
    try {
      const result = await api.importWorkspaceFile(workspaceId, file, kind) as { warnings?: string[]; compatibility?: { warnings?: string[] } }
      await refresh()
      toast.success(kind === 'code' ? 'Code snapshot indexed' : kind === 'brief' ? 'Brief imported' : 'Document replaced', {
        description: result.warnings?.[0] ?? result.compatibility?.warnings?.[0],
      })
    } catch (error) {
      toast.error('Import failed', { description: (error as Error).message })
    } finally {
      setUploading(null)
    }
  }

  return (
    <main id="main-content" className="min-h-[100dvh] bg-[#f4f1e9] text-stone-900">
      <header className="border-b border-stone-300/70 bg-[#f8f6f0]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <button onClick={() => { setActive(null); setView('dashboard') }} className="flex items-center gap-2 text-sm text-stone-500 transition hover:text-stone-900"><ArrowLeft className="h-4 w-4" />All workspaces</button>
          <div className="flex items-center gap-2"><span className="font-mono text-[10px] uppercase tracking-[0.18em] text-stone-500">{workspace.workspaceType}</span>{certificate && <span className="text-xs text-[#28614f]">Process verified</span>}</div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-12">
        {compatibility && <aside className="mb-8 rounded-xl border border-amber-300 bg-amber-50 p-5" aria-label="DOCX compatibility report"><div className="flex items-start gap-3"><FileInput className="mt-0.5 h-5 w-5 text-amber-700" /><div><p className="font-medium text-amber-950">DOCX compatibility report · {importedDocx?.filename}</p><ul className="mt-2 space-y-1 text-xs leading-5 text-amber-900">{compatibility.warnings?.map((warning) => <li key={warning}>— {warning}</li>)}{compatibility.converterMessages?.slice(0, 4).map((message) => <li key={message.message}>— {message.message}</li>)}</ul><p className="mt-2 text-[11px] text-amber-800">The original file is retained privately. Cogdoc exports normalized academic layout rather than exact Word pagination.</p></div></div></aside>}
        <div className="grid gap-10 lg:grid-cols-[1.25fr_.75fr]">
          <div>
            <div className="flex items-center gap-3 text-sm text-stone-500">{workspace.workspaceType === 'assignment' ? <FileText className="h-4 w-4" /> : <FlaskConical className="h-4 w-4" />}{workspace.dueAt && <span className="flex items-center gap-1.5"><CalendarClock className="h-4 w-4" />Due {new Date(workspace.dueAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>}</div>
            <h1 className="mt-4 max-w-3xl text-balance font-serif text-5xl font-semibold leading-[1.04] tracking-[-0.035em]">{workspace.title}</h1>
            <p className="mt-5 max-w-2xl text-pretty leading-7 text-stone-600">{workspace.description || (workspace.workspaceType === 'assignment' ? 'Write or import your assignment, then run one calm review for the issues that matter.' : 'Build the manuscript and its evidence trail in one place.')}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button onClick={() => setView('editor')} className="h-11 bg-[#173f35] px-5 hover:bg-[#245548]">Open editor<ArrowRight className="ml-2 h-4 w-4" /></Button>
              <Button variant="outline" onClick={startReview} disabled={scanning} className="h-11 border-stone-300 bg-transparent">{scanning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ScanSearch className="mr-2 h-4 w-4" />}{latestRun ? 'Run a fresh review' : 'Review this document'}</Button>
              <Button variant="ghost" onClick={() => setView('verification')} className="h-11"><ShieldCheck className="mr-2 h-4 w-4" />Verification</Button>
            </div>
          </div>

          <aside className="rounded-xl bg-[#173f35] p-6 text-white">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-100/70">Current review</p>
            <div className="mt-6 grid grid-cols-3 gap-3 border-b border-white/15 pb-6 text-center"><div><p className="font-serif text-3xl">{critical.length}</p><p className="mt-1 text-[11px] text-white/60">critical</p></div><div><p className="font-serif text-3xl">{Math.max(0, latestItems.length - critical.length - completed.length)}</p><p className="mt-1 text-[11px] text-white/60">improve</p></div><div><p className="font-serif text-3xl">{completed.length}</p><p className="mt-1 text-[11px] text-white/60">complete</p></div></div>
            <p className="mt-5 text-sm leading-6 text-white/70">{latestRun ? `Last reviewed ${new Date(latestRun.createdAt).toLocaleString()}.` : 'No review yet. Your writing remains editable while Cogdoc scans a versioned snapshot.'}</p>
          </aside>
        </div>

        <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-stone-300 bg-stone-300 md:grid-cols-2 xl:grid-cols-4">
          <section className="bg-[#f8f6f0] p-5"><Waypoints className="h-5 w-5 text-[#386c5c]" /><h2 className="mt-5 font-serif text-xl font-semibold">Review pace</h2><p className="mt-2 min-h-12 text-sm leading-6 text-stone-500">Change what Cogdoc surfaces, not what verification requires.</p><Select value={workspace.reviewPace ?? 'deep'} onValueChange={(value) => updatePace(value as 'rapid' | 'guided' | 'deep')}><SelectTrigger className="mt-5 bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="rapid">Rapid — critical only</SelectItem><SelectItem value="guided">Guided — balanced</SelectItem><SelectItem value="deep">Deep — full inquiry</SelectItem></SelectContent></Select></section>
          <section className="bg-[#f8f6f0] p-5"><BookOpen className="h-5 w-5 text-[#386c5c]" /><h2 className="mt-5 font-serif text-xl font-semibold">Materials</h2><p className="mt-2 text-sm leading-6 text-stone-500">{workspace._count?.pdfs ?? 0} sources · {workspace.codeSnapshots?.length ?? 0} code snapshots</p><div className="mt-5 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => briefRef.current?.click()}>{uploading === 'brief' ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Upload className="mr-1 h-3 w-3" />}Brief</Button><Button size="sm" variant="outline" onClick={() => codeRef.current?.click()}>{uploading === 'code' ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Upload className="mr-1 h-3 w-3" />}Code ZIP</Button></div></section>
          <section className="bg-[#f8f6f0] p-5"><Library className="h-5 w-5 text-[#386c5c]" /><h2 className="mt-5 font-serif text-xl font-semibold">Citation style</h2><p className="mt-2 min-h-12 text-sm leading-6 text-stone-500">Keeps new suggestions and metadata-backed library entries consistent.</p><Select value={workspace.citationStyle ?? 'harvard'} onValueChange={(value) => updateCitationStyle(value as CitationStyle)}><SelectTrigger className="mt-5 bg-white" aria-label="Citation style"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="harvard">Harvard — Cite Them Right</SelectItem><SelectItem value="apa">APA 7th edition</SelectItem></SelectContent></Select></section>
          <section className="bg-[#f8f6f0] p-5"><FileInput className="h-5 w-5 text-[#386c5c]" /><h2 className="mt-5 font-serif text-xl font-semibold">Document</h2><p className="mt-2 text-sm leading-6 text-stone-500">Revision {workspace.document?.revision ?? 0}. Imports preserve academic structure; Word export applies a normalized academic layout.</p><Button size="sm" variant="outline" onClick={() => docxRef.current?.click()} className="mt-5">{uploading === 'docx' ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <FileInput className="mr-1 h-3 w-3" />}Replace from DOCX</Button></section>
        </div>

        <div className="mt-8 flex items-start gap-3 rounded-lg border border-stone-300 bg-[#f8f6f0] p-4 text-sm text-stone-600"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#386c5c]" /><p>Cogdoc certifies the checks completed against an exact document snapshot. It does not certify authorship, originality, correctness, AI-free writing, or institutional approval.</p></div>
      </section>

      <input ref={docxRef} className="hidden" type="file" accept=".docx" onChange={(event) => event.target.files?.[0] && importFile(event.target.files[0], 'docx')} />
      <input ref={briefRef} className="hidden" type="file" accept=".docx" onChange={(event) => event.target.files?.[0] && importFile(event.target.files[0], 'brief')} />
      <input ref={codeRef} className="hidden" type="file" accept=".zip,application/zip" onChange={(event) => event.target.files?.[0] && importFile(event.target.files[0], 'code')} />
    </main>
  )
}
