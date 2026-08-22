'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, FileCheck2, Loader2, ShieldAlert } from 'lucide-react'

interface ReportPayload {
  unresolved?: Array<{ id: string; type: string; title: string; severity: string; state: string }>
  gateFailures?: string[]
  completedActions?: Array<{ id: string; type: string; title: string; responses?: Array<{ text?: string; createdAt: string }> }>
  evidenceTrace?: Array<{ claimId: string; claimText: string; riskCategory: string; links: Array<{ kind: string; supportStatus?: string; source?: { filename: string; pageApprox: number } | null; code?: { path: string; fileHash: string; snapshotHash: string } | null; startLine?: number | null; endLine?: number | null }> }>
  audit?: Array<{ type: string; actor: string; documentHash?: string | null; eventHash?: string | null; createdAt: string }>
}

interface VerificationPayload {
  valid: boolean
  certificate: {
    id: string; status: string; createdAt: string; publicKeyId: string
    signatureValid: boolean; payloadHashValid: boolean
    payload: { documentHash: string; docxHash?: string; reportHash: string }
  }
  workspace: { title: string; workspaceType: string }
  report: { level: string; coverage: Record<string, number>; limitations: string[]; payload: ReportPayload }
}

export default function VerifyPage({ params }: { params: Promise<{ token: string }> }) {
  const [result, setResult] = useState<VerificationPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [comparison, setComparison] = useState<'match' | 'different' | null>(null)

  useEffect(() => {
    params.then(({ token }) => fetch(`/api/verify/${token}`).then(async (response) => {
      const body = await response.json()
      if (!response.ok) throw new Error(body.error ?? 'Verification failed')
      setResult(body)
    })).catch((reason) => setError(reason.message))
  }, [params])

  async function compareFile(file: File) {
    if (!result) return
    const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
    const hash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
    setComparison(Boolean(result.certificate.payload.docxHash) && hash === result.certificate.payload.docxHash ? 'match' : 'different')
  }

  if (!result && !error) return <main id="main-content" className="grid min-h-screen place-items-center bg-[#f4f1e9]"><Loader2 className="h-6 w-6 animate-spin text-[#386c5c]" /></main>
  if (error) return <main id="main-content" className="grid min-h-screen place-items-center bg-[#f4f1e9] p-6"><div className="max-w-md text-center"><ShieldAlert className="mx-auto h-9 w-9 text-rose-700" /><h1 className="mt-5 font-serif text-3xl font-semibold">This link cannot be verified</h1><p className="mt-3 text-stone-500">{error}</p></div></main>
  if (!result) return null

  const report = result.report.payload
  const codeLinks = report.evidenceTrace?.flatMap((entry) => entry.links.filter((link) => link.code).map((link) => ({ claim: entry.claimText, ...link }))) ?? []
  const reasoning = report.completedActions?.filter((action) => action.type === 'comprehension_check') ?? []
  return <main id="main-content" className="min-h-screen bg-[#f4f1e9] px-6 py-14 text-stone-900">
    <article className="mx-auto max-w-4xl rounded-xl border border-stone-300 bg-[#f8f6f0] p-8 md:p-12">
      <div className={`flex items-center gap-3 ${result.valid ? 'text-[#28614f]' : 'text-rose-700'}`}><CheckCircle2 className="h-6 w-6" /><span className="font-mono text-xs uppercase tracking-[0.18em]">{result.valid ? 'Cryptographic record valid' : 'Verification failed'}</span></div>
      <h1 className="mt-8 text-balance font-serif text-5xl font-semibold tracking-[-0.035em]">{result.workspace.title}</h1>
      <p className="mt-4 text-stone-500">{result.workspace.workspaceType === 'assignment' ? 'Assignment' : 'Research workspace'} · certified {new Date(result.certificate.createdAt).toLocaleString()}</p>

      <div className="mt-10 grid gap-px overflow-hidden rounded-lg bg-stone-300 sm:grid-cols-4">
        {[['Status', result.certificate.status], ['Report', result.report.level.replaceAll('_', ' ')], ['Citation coverage', `${Math.round((result.report.coverage.citationCoverage ?? 0) * 100)}%`], ['Evidence links', result.report.coverage.evidenceCompleted ?? 0]].map(([label, value]) => <div key={String(label)} className="bg-white p-4"><p className="text-xs text-stone-500">{label}</p><p className="mt-2 font-medium capitalize">{value}</p></div>)}
      </div>

      <section className="mt-10"><h2 className="font-serif text-2xl font-semibold">Compare a local file</h2><p className="mt-2 text-sm leading-6 text-stone-500">The DOCX is hashed in this browser and is not uploaded. Comparison works only with the exact certified export bytes.</p><label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-stone-400 p-6 text-sm hover:bg-white"><FileCheck2 className="h-4 w-4" />Choose the certified DOCX<input type="file" accept=".docx" className="hidden" onChange={(event) => event.target.files?.[0] && compareFile(event.target.files[0])} /></label>{comparison && <p className={`mt-3 text-sm ${comparison === 'match' ? 'text-[#28614f]' : 'text-rose-700'}`}>{comparison === 'match' ? 'This file matches the signed certified export.' : 'This file does not match the signed certified export.'}</p>}</section>

      <section className="mt-10 border-t border-stone-300 pt-8"><h2 className="font-serif text-2xl font-semibold">Review coverage</h2>{report.gateFailures?.length ? <ul className="mt-4 space-y-2 text-sm text-rose-700">{report.gateFailures.map((failure) => <li key={failure}>— {failure.replaceAll('_', ' ')}</li>)}</ul> : <p className="mt-3 text-sm text-[#28614f]">All certification invariants passed for this snapshot.</p>}{report.unresolved?.length ? <div className="mt-6"><h3 className="font-medium">Disclosed unresolved advisories</h3><ul className="mt-2 space-y-2 text-sm text-stone-500">{report.unresolved.map((item) => <li key={item.id}>— {item.title} ({item.state})</li>)}</ul></div> : null}</section>

      <section className="mt-10 border-t border-stone-300 pt-8"><h2 className="font-serif text-2xl font-semibold">Evidence trace</h2><div className="mt-4 space-y-4">{report.evidenceTrace?.filter((entry) => entry.links.length).map((entry) => <div key={entry.claimId} className="rounded-lg border border-stone-200 bg-white p-4"><p className="text-sm font-medium leading-6">{entry.claimText}</p><ul className="mt-2 space-y-1 text-xs text-stone-500">{entry.links.map((link, index) => <li key={`${link.kind}:${index}`}>— {link.source ? `${link.source.filename}, page ~${link.source.pageApprox} · ${link.supportStatus?.replaceAll('_', ' ') ?? 'not assessed'}` : link.code ? `${link.code.path}:${link.startLine}–${link.endLine} · snapshot ${link.code.snapshotHash.slice(0, 12)}…` : link.kind}</li>)}</ul></div>)}{!report.evidenceTrace?.some((entry) => entry.links.length) && <p className="text-sm text-stone-500">No passage or code links were required for this report.</p>}</div></section>

      {reasoning.length > 0 && <section className="mt-10 border-t border-stone-300 pt-8"><h2 className="font-serif text-2xl font-semibold">Recorded reasoning responses</h2><div className="mt-4 space-y-4">{reasoning.map((action) => <div key={action.id}><p className="text-sm font-medium">{action.title}</p>{action.responses?.map((response) => <p key={response.createdAt} className="mt-1 text-sm leading-6 text-stone-500">{response.text}</p>)}</div>)}</div></section>}

      {codeLinks.length > 0 && <section className="mt-10 border-t border-stone-300 pt-8"><h2 className="font-serif text-2xl font-semibold">Captured code evidence</h2><p className="mt-3 text-sm text-stone-500">These links identify static files and ranges in a hashed ZIP snapshot. Cogdoc did not execute or validate the code.</p></section>}

      <section className="mt-10 border-t border-stone-300 pt-8"><h2 className="font-serif text-2xl font-semibold">Audit timeline</h2><ol className="mt-4 space-y-3">{report.audit?.map((event, index) => <li key={`${event.eventHash}:${index}`} className="flex justify-between gap-4 text-xs"><span>{event.type.replaceAll('_', ' ')}</span><time className="shrink-0 text-stone-500">{new Date(event.createdAt).toLocaleString()}</time></li>)}</ol></section>

      <section className="mt-10 border-t border-stone-300 pt-8"><h2 className="font-medium">What this does not prove</h2><ul className="mt-3 space-y-2 text-sm leading-6 text-stone-500">{result.report.limitations.map((limitation) => <li key={limitation}>— {limitation}</li>)}</ul></section>
      <p className="mt-8 break-all font-mono text-[10px] leading-5 text-stone-400">Certificate {result.certificate.id} · Key {result.certificate.publicKeyId} · Document {result.certificate.payload.documentHash}</p>
    </article>
  </main>
}
