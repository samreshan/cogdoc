import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sha256, verifyCertificatePayload } from '@/lib/crypto'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const tokenHash = sha256(token)
  const share = await db.shareGrant.findUnique({
    where: { tokenHash },
    include: { certificate: { include: { report: true, project: { select: { title: true, workspaceType: true } } } } },
  })
  if (!share) {
    const tombstone = await db.certificateRevocationTombstone.findFirst({ where: { shareTokenHashesJson: { contains: tokenHash } } })
    if (tombstone) return NextResponse.json({ error: 'This certificate was revoked and its workspace was deleted', certificateId: tombstone.certificateId }, { status: 410 })
  }
  if (!share || share.revokedAt || (share.expiresAt && share.expiresAt < new Date())) {
    return NextResponse.json({ error: 'Verification link is invalid, expired, or revoked' }, { status: 404 })
  }
  const certificate = share.certificate
  const signatureValid = verifyCertificatePayload(certificate.payloadJson, certificate.signature, certificate.publicKeyPem)
  const payloadHashValid = sha256(certificate.payloadJson) === certificate.payloadHash
  const reportPayload = JSON.parse(certificate.report.reportJson)
  return NextResponse.json({
    valid: signatureValid && payloadHashValid && certificate.status !== 'revoked',
    certificate: {
      id: certificate.id, status: certificate.status, createdAt: certificate.createdAt,
      publicKeyId: certificate.publicKeyId, signatureValid, payloadHashValid,
      payload: JSON.parse(certificate.payloadJson),
    },
    workspace: certificate.project,
    report: { level: certificate.report.level, coverage: JSON.parse(certificate.report.coverageJson), limitations: reportPayload.limitations, payload: reportPayload },
  })
}
