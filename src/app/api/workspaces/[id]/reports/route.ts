import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/auth-supabase'
import { sha256 } from '@/lib/crypto'
import { appendAuditEvent, verifyAuditChain } from '@/lib/workspace-server'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId(req)
  const { id } = await params
  const workspace = await db.project.findFirst({
    where: { id, userId, archived: false, deletedAt: null },
    include: {
      document: true,
      reviewRuns: {
        where: { status: 'ready' }, orderBy: { createdAt: 'desc' }, take: 1,
        include: { documentVersion: true, items: { include: { responses: true } } },
      },
      references: true,
      citations: true,
      claims: { include: { evidenceLinks: { include: {
        codeFile: { select: { path: true, contentHash: true, snapshot: { select: { snapshotHash: true } } } },
        pdfChunk: { select: { pageApprox: true, pdf: { select: { filename: true } } } },
      } } } },
      codeSnapshots: { include: { _count: { select: { files: true } } } },
      auditEvents: { orderBy: { createdAt: 'asc' }, take: 500 },
    },
  })
  const run = workspace?.reviewRuns[0]
  if (!workspace?.document || !run) return NextResponse.json({ error: 'Complete a review before generating a report' }, { status: 409 })

  const items = run.items
  const blockers = items.filter((item) => item.blocksCertification && item.state !== 'resolved')
  const advisories = items.filter((item) => !item.blocksCertification && item.state !== 'resolved')
  const versionCitations = workspace.citations.filter((citation) => citation.documentVersionId === run.documentVersionId)
  const pairedCitations = versionCitations.filter((citation) => citation.referenceId)
  const relevantReferenceIds = new Set(pairedCitations.map((citation) => citation.referenceId).filter(Boolean))
  const invalidReferences = workspace.references.filter((reference) => relevantReferenceIds.has(reference.id) && !['matched', 'confirmed'].includes(reference.metadataStatus))
  const currentHashMatches = workspace.document.contentHash === run.documentVersion.contentHash
  const citationCoverage = versionCitations.length ? pairedCitations.length / versionCitations.length : 1
  const versionClaims = workspace.claims.filter((claim) => claim.documentVersionId === run.documentVersionId)
  const evidenceRequired = versionClaims.filter((claim) => claim.central || ['quotation', 'numeric', 'causal'].includes(claim.riskCategory))
  const evidenceCompleted = evidenceRequired.filter((claim) => claim.evidenceLinks.some((link) =>
    link.confirmedByStudent && (link.kind === 'code_range' || link.kind === 'student_test_artifact' || link.supportStatus === 'supported'),
  ))
  const evidenceChecksComplete = evidenceCompleted.length === evidenceRequired.length
  const wordCount = run.documentVersion.plainText.split(/\s+/).filter(Boolean).length
  const comprehensionRequired = wordCount > 500 ? Math.min(5, Math.max(3, Math.ceil(wordCount / 1000))) : wordCount >= 120 ? 1 : 0
  const comprehensionCompleted = items.filter((item) => item.type === 'comprehension_check' && item.state === 'resolved').length
  const comprehensionComplete = comprehensionCompleted >= Math.min(comprehensionRequired, versionClaims.length)
  const auditIntegrity = verifyAuditChain(workspace.auditEvents)
  const processVerified = blockers.length === 0 && invalidReferences.length === 0 && citationCoverage === 1 && currentHashMatches && evidenceChecksComplete && comprehensionComplete && auditIntegrity
  const level = processVerified ? 'process_verified' : items.some((item) => item.state === 'resolved') ? 'reviewed_with_warnings' : 'scan_report'

  const reportPayload = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    workspace: { id: workspace.id, title: workspace.title, type: workspace.workspaceType, citationStyle: workspace.citationStyle },
    reviewedSnapshot: { versionId: run.documentVersionId, sequence: run.documentVersion.sequence, documentHash: run.documentVersion.contentHash, currentHashMatches },
    coverage: {
      citationCount: versionCitations.length, pairedCitationCount: pairedCitations.length, citationCoverage,
      criticalResolved: items.filter((item) => item.blocksCertification && item.state === 'resolved').length,
      criticalRemaining: blockers.length, advisoryRemaining: advisories.length,
      referencesChecked: relevantReferenceIds.size, metadataMismatches: invalidReferences.length,
      evidenceRequired: evidenceRequired.length, evidenceCompleted: evidenceCompleted.length,
      comprehensionRequired: Math.min(comprehensionRequired, versionClaims.length), comprehensionCompleted,
      auditIntegrity,
      codeSnapshots: workspace.codeSnapshots.map((snapshot) => ({ id: snapshot.id, hash: snapshot.snapshotHash, indexedFiles: snapshot._count.files })),
    },
    unresolved: [...blockers, ...advisories].map((item) => ({ id: item.id, type: item.type, severity: item.severity, title: item.title, state: item.state })),
    gateFailures: [
      citationCoverage < 1 ? 'citation_reference_pairing_incomplete' : null,
      invalidReferences.length ? 'reference_metadata_unconfirmed' : null,
      !evidenceChecksComplete ? 'required_evidence_links_incomplete' : null,
      !comprehensionComplete ? 'comprehension_sample_incomplete' : null,
      !currentHashMatches ? 'document_changed_after_review' : null,
      !auditIntegrity ? 'audit_chain_integrity_failed' : null,
    ].filter(Boolean),
    completedActions: items.filter((item) => item.state === 'resolved').map((item) => ({
      id: item.id, type: item.type, title: item.title,
      responses: item.responses.map((response) => ({ text: response.responseText, createdAt: response.createdAt })),
    })),
    evidenceTrace: versionClaims.map((claim) => ({
      claimId: claim.id, claimText: claim.text, riskCategory: claim.riskCategory,
      links: claim.evidenceLinks.filter((link) => link.confirmedByStudent).map((link) => ({
        kind: link.kind, supportStatus: link.supportStatus, excerpt: link.excerpt, startLine: link.startLine, endLine: link.endLine,
        source: link.pdfChunk ? { filename: link.pdfChunk.pdf.filename, pageApprox: link.pdfChunk.pageApprox } : null,
        code: link.codeFile ? { path: link.codeFile.path, fileHash: link.codeFile.contentHash, snapshotHash: link.codeFile.snapshot.snapshotHash } : null,
        studentConfirmed: link.confirmedByStudent,
      })),
    })),
    audit: workspace.auditEvents.map((event) => ({ type: event.type, actor: event.actor, documentHash: event.documentHash, previousHash: event.previousHash, eventHash: event.eventHash, createdAt: event.createdAt })),
    limitations: [
      'This report does not prove human authorship, AI-free writing, originality, correctness, or institutional approval.',
      'Code snapshots were indexed without execution; test artifacts are student-provided evidence.',
      'Only English-language analysis and Harvard/APA author-date citation structure are evaluated in v1.',
    ],
  }
  const reportJson = JSON.stringify(reportPayload)
  const reportHash = sha256(reportJson)
  const report = await db.$transaction(async (tx) => {
    const created = await tx.verificationReport.create({
      data: {
        projectId: id, documentVersionId: run.documentVersionId, createdById: userId,
        level, reportJson, reportHash, coverageJson: JSON.stringify(reportPayload.coverage),
      },
    })
    await appendAuditEvent(tx, { projectId: id, userId, type: 'verification_report_generated', documentHash: run.documentVersion.contentHash, payload: { reportId: created.id, level, reportHash } })
    return created
  })
  return NextResponse.json({ report: { ...report, payload: reportPayload }, eligibleForCertificate: processVerified }, { status: 201 })
}
