'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, Check, Copy, Download, FileCheck2, Loader2, ShieldAlert, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { useCogdoc } from '@/lib/store'
import { api, ApiError } from '@/lib/api-client'
import type { ReviewItem, VerificationReport } from '@/lib/types'
import { Button } from '@/components/ui/button'

type Coverage = {
  criticalResolved?: number
  criticalRemaining?: number
  advisoryRemaining?: number
  citationCount?: number
  pairedCitationCount?: number
  citationCoverage?: number
  metadataMismatches?: number
  codeSnapshots?: Array<{ id: string; hash: string; indexedFiles: number }>
}

export default function VerificationWorkspace() {
  const workspace = useCogdoc((state) => state.activeProject)
  const setView = useCogdoc((state) => state.setView)
  const [items, setItems] = useState<ReviewItem[]>([])
  const [report, setReport] = useState<VerificationReport | null>(null)
  const [generating, setGenerating] = useState(false)
  const [certifying, setCertifying] = useState(false)
  const [certificate, setCertificate] = useState<{ shareUrl: string; pdfUrl: string; documentUrl: string } | null>(null)

  useEffect(() => {
    if (!workspace) return
    Promise.all([api.listReviewItems(workspace.id), api.getWorkspace(workspace.id)]).then(([review, detail]) => {
      setItems(review.reviewItems)
      const reports = (detail.workspace as typeof detail.workspace & { reports?: VerificationReport[] }).reports ?? []
      setReport(reports[0] ?? null)
    }).catch(() => {})
  }, [workspace?.id])
  if (!workspace) return null
  const workspaceId = workspace.id

  const coverage = report ? JSON.parse(report.coverageJson) as Coverage : null
  const blockers = items.filter((item) => item.blocksCertification && item.state !== 'resolved')

  async function generateReport() {
    setGenerating(true)
    try {
      const result = await api.generateReport(workspaceId)
      setReport(result.report)
      toast.success(result.eligibleForCertificate ? 'Process Verified report ready' : 'Review report updated')
    } catch (error) {
      toast.error('Could not generate the report', { description: (error as Error).message })
    } finally {
      setGenerating(false)
    }
  }

  async function createCertificate() {
    setCertifying(true)
    try {
      const created = await api.createCertificate(workspaceId)
      setCertificate(created)
      toast.success('Private certificate created')
    } catch (error) {
      const description = error instanceof ApiError && error.status === 503
        ? 'Add COGDOC_CERTIFICATE_PRIVATE_KEY to enable Ed25519 signing.'
        : (error as Error).message
      toast.error('Certificate unavailable', { description })
    } finally {
      setCertifying(false)
    }
  }

  async function copyShareLink() {
    if (!certificate) return
    await navigator.clipboard.writeText(certificate.shareUrl)
    toast.success('Private link copied')
  }

  return (
    <main id="main-content" className="min-h-[100dvh] bg-[#f4f1e9] text-stone-900">
      <header className="border-b border-stone-300 bg-[#f8f6f0]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4"><button onClick={() => setView('workspace')} className="flex items-center gap-2 text-sm text-stone-500 hover:text-stone-900"><ArrowLeft className="h-4 w-4" />Workspace</button><span className="font-mono text-[10px] uppercase tracking-[0.18em] text-stone-500">Verification</span></div>
      </header>
      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_.9fr]">
          <div><p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#386c5c]">Snapshot accountability</p><h1 className="mt-4 text-balance font-serif text-5xl font-semibold tracking-[-0.035em]">What Cogdoc checked—and what it did not.</h1><p className="mt-5 max-w-2xl text-pretty leading-7 text-stone-600">The report binds completed actions, citations, code evidence, and unresolved warnings to one immutable document hash.</p></div>
          <aside className={`rounded-xl p-6 ${report?.level === 'process_verified' ? 'bg-[#173f35] text-white' : 'border border-stone-300 bg-[#f8f6f0]'}`}>
            {report?.level === 'process_verified' ? <ShieldCheck className="h-7 w-7 text-emerald-200" /> : <ShieldAlert className="h-7 w-7 text-amber-700" />}
            <p className="mt-5 font-serif text-2xl font-semibold">{report?.level === 'process_verified' ? 'Process Verified' : report ? 'Reviewed with warnings' : 'No report yet'}</p>
            <p className={`mt-2 text-sm leading-6 ${report?.level === 'process_verified' ? 'text-white/65' : 'text-stone-500'}`}>{report ? `Report ${report.reportHash.slice(0, 12)}…` : 'Complete a review, resolve critical actions, then generate a report.'}</p>
          </aside>
        </div>

        <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-stone-300 bg-stone-300 sm:grid-cols-2 lg:grid-cols-4">
          {[['Critical remaining', coverage?.criticalRemaining ?? blockers.length], ['Critical resolved', coverage?.criticalResolved ?? items.filter((item) => item.blocksCertification && item.state === 'resolved').length], ['Citation coverage', `${Math.round((coverage?.citationCoverage ?? 0) * 100)}%`], ['Advisories', coverage?.advisoryRemaining ?? items.filter((item) => !item.blocksCertification && item.state !== 'resolved').length]].map(([label, value]) => <div key={String(label)} className="bg-[#f8f6f0] p-5"><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-stone-500">{label}</p><p className="mt-4 font-serif text-3xl font-semibold tabular-nums">{value}</p></div>)}
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_340px]">
          <section><div className="flex items-center justify-between"><h2 className="font-serif text-2xl font-semibold">Outstanding checks</h2><span className="text-xs text-stone-500">{blockers.length} block certification</span></div><div className="mt-4 divide-y divide-stone-300 border-y border-stone-300">{items.filter((item) => item.state !== 'resolved').length ? items.filter((item) => item.state !== 'resolved').slice(0, 12).map((item) => <div key={item.id} className="flex gap-4 py-4"><span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${item.blocksCertification ? 'bg-rose-600' : 'bg-amber-500'}`} /><div><p className="font-medium">{item.title}</p><p className="mt-1 text-sm leading-6 text-stone-500">{item.detail}</p></div></div>) : <div className="flex items-center gap-3 py-8 text-sm text-[#28614f]"><Check className="h-4 w-4" />No unresolved review actions.</div>}</div></section>
          <aside className="space-y-3 rounded-xl border border-stone-300 bg-[#f8f6f0] p-5"><h2 className="font-serif text-xl font-semibold">Create evidence</h2><p className="text-sm leading-6 text-stone-500">Reports are available with warnings. Certificates require the current snapshot to pass every critical check.</p><Button onClick={generateReport} disabled={generating} className="w-full bg-[#173f35] hover:bg-[#245548]">{generating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Generate current report</Button><Button variant="outline" onClick={createCertificate} disabled={certifying || report?.level !== 'process_verified'} className="w-full border-stone-300">{certifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Issue signed certificate</Button>{certificate && <div className="space-y-2 border-t border-stone-300 pt-4"><Button variant="ghost" onClick={copyShareLink} className="w-full justify-start"><Copy className="mr-2 h-4 w-4" />Copy private link</Button><Button variant="ghost" asChild className="w-full justify-start"><a href={certificate.documentUrl}><FileCheck2 className="mr-2 h-4 w-4" />Download certified DOCX</a></Button><Button variant="ghost" asChild className="w-full justify-start"><a href={certificate.pdfUrl}><Download className="mr-2 h-4 w-4" />Download certificate PDF</a></Button></div>}<p className="border-t border-stone-300 pt-4 text-xs leading-5 text-stone-500">This is a cryptographic product attestation, not a legal signature or proof of authorship.</p></aside>
        </div>
      </section>
    </main>
  )
}
