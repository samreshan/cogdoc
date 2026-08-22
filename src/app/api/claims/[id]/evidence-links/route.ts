import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/auth-supabase'
import { appendAuditEvent, mutationIdempotencyKey } from '@/lib/workspace-server'
import { getAIService } from '@/lib/ai-service'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId(req)
  const { id } = await params
  const claim = await db.claim.findFirst({
    where: { id, project: { userId } },
    include: { evidenceLinks: { include: { pdfChunk: { include: { pdf: { select: { filename: true } } } }, codeFile: { select: { path: true } } } } },
  })
  if (!claim) return NextResponse.json({ error: 'Claim not found' }, { status: 404 })
  return NextResponse.json({ evidenceLinks: claim.evidenceLinks })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId(req)
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const claim = await db.claim.findFirst({ where: { id, project: { userId } } })
  if (!claim) return NextResponse.json({ error: 'Claim not found' }, { status: 404 })
  const idempotencyKey = mutationIdempotencyKey(req)
  if (idempotencyKey) {
    const existing = await db.evidenceLink.findFirst({ where: { claimId: id, idempotencyKey } })
    if (existing) return NextResponse.json({
      evidenceLink: existing,
      resolved: ['code_range', 'student_test_artifact'].includes(existing.kind) || existing.supportStatus === 'supported',
      replayed: true,
    })
  }
  if (body.confirmed !== true) return NextResponse.json({ error: 'Student confirmation is required' }, { status: 400 })

  const pdfChunkId = typeof body.pdfChunkId === 'string' ? body.pdfChunkId : null
  const codeFileId = typeof body.codeFileId === 'string' ? body.codeFileId : null
  if (Boolean(pdfChunkId) === Boolean(codeFileId)) {
    return NextResponse.json({ error: 'Choose exactly one source passage or code range' }, { status: 400 })
  }

  let kind = 'source_passage'
  let excerpt = ''
  let startLine: number | null = null
  let endLine: number | null = null
  let supportStatus = 'insufficient_evidence'
  if (pdfChunkId) {
    const chunk = await db.pdfChunk.findFirst({ where: { id: pdfChunkId, pdf: { projectId: claim.projectId, userId } } })
    if (!chunk) return NextResponse.json({ error: 'Source passage not found' }, { status: 404 })
    excerpt = chunk.content.slice(0, 4000)
    try {
      const assessment = await getAIService().verifyClaim(claim.text, [{ chunkId: chunk.id, content: excerpt }])
      supportStatus = assessment.verdict === 'supported' || assessment.verdict === 'partially_supported'
        ? assessment.verdict
        : assessment.verdict === 'unsupported' && /contradict|opposite|inconsistent/i.test(assessment.explanation)
          ? 'contradicted' : 'insufficient_evidence'
    } catch { supportStatus = 'insufficient_evidence' }
  } else {
    const file = await db.codeFile.findFirst({ where: { id: codeFileId!, snapshot: { projectId: claim.projectId } } })
    if (!file) return NextResponse.json({ error: 'Code file not found' }, { status: 404 })
    startLine = Math.max(1, Math.floor(Number(body.startLine) || 1))
    endLine = Math.min(file.lineCount, Math.max(startLine, Math.floor(Number(body.endLine) || startLine)))
    if (endLine - startLine > 200) return NextResponse.json({ error: 'Code evidence range cannot exceed 200 lines' }, { status: 400 })
    excerpt = (file.content ?? '').split('\n').slice(startLine - 1, endLine).join('\n').slice(0, 20_000)
    kind = body.studentProvidedTestArtifact === true ? 'student_test_artifact' : 'code_range'
    // Code evidence is link-only: the certificate attests the captured range,
    // never semantic correctness or execution.
    supportStatus = 'insufficient_evidence'
  }

  const result = await db.$transaction(async (tx) => {
    const link = await tx.evidenceLink.create({
      data: {
        claimId: id, pdfChunkId, codeFileId, kind, startLine, endLine, excerpt,
        confidence: Math.max(0, Math.min(1, Number(body.confidence) || 0)), supportStatus, idempotencyKey, confirmedByStudent: true,
      },
    })
    const resolvesEvidenceGate = kind === 'code_range' || kind === 'student_test_artifact' || supportStatus === 'supported'
    if (resolvesEvidenceGate) await tx.reviewItem.updateMany({
      where: { claimId: id, type: { in: ['claim_needs_evidence', 'evidence_passage_required'] }, state: { not: 'resolved' } },
      data: { state: 'resolved', resolution: 'student_confirmed_evidence_link', resolvedAt: new Date() },
    })
    await appendAuditEvent(tx, {
      projectId: claim.projectId, userId, type: 'evidence_link_confirmed',
      payload: { claimId: id, evidenceLinkId: link.id, kind, supportStatus, pdfChunkId, codeFileId, startLine, endLine },
    })
    return { link, resolvesEvidenceGate }
  })
  return NextResponse.json({ evidenceLink: result.link, resolved: result.resolvesEvidenceGate }, { status: 201 })
}
