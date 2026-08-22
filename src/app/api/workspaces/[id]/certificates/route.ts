import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/auth-supabase'
import { certificateSigningAvailable, randomToken, sha256, signCertificatePayload } from '@/lib/crypto'
import { buildCertificatePdf } from '@/lib/certificate-pdf'
import { putPrivateAsset } from '@/lib/private-storage'
import { appendAuditEvent } from '@/lib/workspace-server'
import { exportAcademicDocx } from '@/lib/docx'

export const runtime = 'nodejs'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId(req)
  const { id } = await params
  if (!certificateSigningAvailable()) {
    return NextResponse.json({ error: 'Certificate signing is not configured', code: 'signing_unavailable' }, { status: 503 })
  }
  const workspace = await db.project.findFirst({
    where: { id, userId },
    include: {
      document: true,
      reports: { where: { level: 'process_verified' }, orderBy: { createdAt: 'desc' }, take: 1, include: { documentVersion: true } },
    },
  })
  const report = workspace?.reports[0]
  if (!workspace?.document || !report || workspace.document.contentHash !== report.documentVersion.contentHash) {
    return NextResponse.json({ error: 'Generate a Process Verified report for the current document before certification' }, { status: 409 })
  }

  const certificateId = randomUUID()
  const shareToken = randomToken()
  const shareTokenHash = sha256(shareToken)
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
  const origin = new URL(req.url).origin
  const verificationUrl = `${origin}/verify/${shareToken}`
  const coverage = JSON.parse(report.coverageJson) as {
    criticalResolved?: number; advisoryRemaining?: number; citationCoverage?: number
    codeSnapshots?: Array<{ hash?: string }>
  }
  const createdAt = new Date().toISOString()
  const exportedDocx = await exportAcademicDocx(workspace.title, report.documentVersion.content)
  const docxHash = sha256(exportedDocx)
  const payload = JSON.stringify({
    schemaVersion: 1, certificateId, projectId: id, reportId: report.id,
    documentVersionId: report.documentVersionId, documentHash: report.documentVersion.contentHash,
    docxHash,
    reportHash: report.reportHash, createdAt,
    codeSnapshotHashes: Array.isArray(coverage.codeSnapshots)
      ? coverage.codeSnapshots.map((snapshot: { hash?: string }) => snapshot.hash).filter(Boolean)
      : [],
    claims: ['process_checks_completed', 'snapshot_hash_bound'],
    limitations: ['not_authorship_proof', 'not_ai_free_proof', 'not_correctness_or_institutional_approval'],
  })
  const signed = signCertificatePayload(payload)
  const pdf = await buildCertificatePdf({
    certificateId, workspaceTitle: workspace.title, workspaceType: workspace.workspaceType,
    createdAt, documentHash: report.documentVersion.contentHash, reportHash: report.reportHash,
    criticalResolved: coverage.criticalResolved ?? 0, advisoryRemaining: coverage.advisoryRemaining ?? 0,
    citationCoverage: coverage.citationCoverage ?? 0, verificationUrl,
  })
  const storedPdf = await putPrivateAsset(id, `cogdoc-certificate-${certificateId}.pdf`, pdf, 'application/pdf')
  const storedDocx = await putPrivateAsset(id, `cogdoc-certified-${certificateId}.docx`, exportedDocx, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')

  const certificate = await db.$transaction(async (tx) => {
    await tx.certificate.updateMany({ where: { projectId: id, status: 'valid' }, data: { status: 'superseded', supersededAt: new Date() } })
    const created = await tx.certificate.create({
      data: {
        id: certificateId, projectId: id, reportId: report.id, documentVersionId: report.documentVersionId,
        createdById: userId, payloadJson: payload, payloadHash: sha256(payload), signature: signed.signature,
        publicKeyId: signed.publicKeyId, publicKeyPem: signed.publicKey,
        docxHash, docxStorageProvider: storedDocx.provider, docxStorageKey: storedDocx.key,
        pdfStorageProvider: storedPdf.provider, pdfStorageKey: storedPdf.key,
        shares: { create: { tokenHash: shareTokenHash, expiresAt } },
      },
    })
    await tx.project.update({ where: { id }, data: { lifecycleState: 'certified' } })
    await appendAuditEvent(tx, { projectId: id, userId, type: 'certificate_issued', documentHash: report.documentVersion.contentHash, payload: { certificateId, reportId: report.id, publicKeyId: signed.publicKeyId } })
    return created
  })
  return NextResponse.json({
    certificate,
    shareUrl: verificationUrl,
    expiresAt,
    pdfUrl: `/api/certificates/${certificate.id}/pdf`,
    documentUrl: `/api/certificates/${certificate.id}/document`,
  }, { status: 201 })
}
