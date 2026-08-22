import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/auth-supabase'
import { appendAuditEvent, createDocumentVersion, mutationIdempotencyKey } from '@/lib/workspace-server'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId(req)
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const item = await db.reviewItem.findFirst({
    where: { id, project: { userId } },
    include: { project: { include: { document: true } } },
  })
  if (!item) return NextResponse.json({ error: 'Review item not found' }, { status: 404 })

  const responseText = typeof body.responseText === 'string' ? body.responseText.trim() : ''
  const dismiss = body.action === 'dismiss'
  const recheckRequired = new Set([
    'citation_missing_reference', 'bibliography_missing', 'quotation_locator_missing',
  ])
  const evidenceLinkRequired = new Set(['claim_needs_evidence', 'evidence_passage_required'])
  if (!dismiss && recheckRequired.has(item.type)) {
    return NextResponse.json({ error: 'Edit the document, then recheck this block. A note cannot resolve this issue.' }, { status: 409 })
  }
  if (!dismiss && evidenceLinkRequired.has(item.type)) {
    return NextResponse.json({ error: 'Confirm a source passage or code range, or keep this issue unresolved.' }, { status: 409 })
  }
  if (item.type === 'comprehension_check' && !dismiss && responseText.length < 20) {
    return NextResponse.json({ error: 'Explain your reasoning in at least 20 characters' }, { status: 400 })
  }
  if (item.type.startsWith('reference_metadata_') && !dismiss && responseText.length < 10) {
    return NextResponse.json({ error: 'Record how you checked the title, author, and year before confirming.' }, { status: 400 })
  }
  const idempotencyKey = mutationIdempotencyKey(req)
  if (idempotencyKey) {
    const duplicate = await db.auditEvent.findFirst({
      where: { projectId: item.projectId, type: 'review_item_responded', payloadJson: { contains: idempotencyKey } },
    })
    if (duplicate) return NextResponse.json({ reviewItem: item, replayed: true })
  }

  const nextState = dismiss ? (item.blocksCertification ? 'unresolved' : 'dismissed') : 'resolved'
  const result = await db.$transaction(async (tx) => {
    const response = dismiss ? null : await tx.reviewResponse.create({
      data: {
        reviewItemId: id, userId, responseText: responseText || null,
        beforeText: typeof body.beforeText === 'string' ? body.beforeText : null,
        afterText: typeof body.afterText === 'string' ? body.afterText : null,
        evidenceJson: JSON.stringify(body.evidence ?? {}),
      },
    })
    const updated = await tx.reviewItem.update({
      where: { id },
      data: { state: nextState, resolution: String(body.resolution ?? (dismiss ? 'dismissed' : 'student_response')), resolvedAt: nextState === 'resolved' ? new Date() : null },
      include: { responses: true },
    })
    if (item.type.startsWith('reference_metadata_') && nextState === 'resolved') {
      const evidence = JSON.parse(item.evidenceJson) as { referenceId?: string }
      if (!evidence.referenceId) throw new Error('Reference confirmation target is missing')
      await tx.reference.update({ where: { id: evidence.referenceId }, data: { metadataStatus: 'confirmed' } })
    }
    const content = item.project.document?.content
    if (content && nextState === 'resolved') await createDocumentVersion(tx, item.projectId, content, 'resolution')
    await appendAuditEvent(tx, {
      projectId: item.projectId, userId, type: 'review_item_responded',
      documentHash: item.project.document?.contentHash ?? null,
      payload: { itemId: id, itemType: item.type, state: nextState, resolution: updated.resolution, idempotencyKey },
    })
    const latestRun = await tx.reviewRun.findFirst({ where: { projectId: item.projectId, status: 'ready' }, orderBy: { createdAt: 'desc' }, select: { id: true } })
    const blockers = latestRun ? await tx.reviewItem.count({
      where: { reviewRunId: latestRun.id, blocksCertification: true, state: { not: 'resolved' } },
    }) : 1
    await tx.project.update({ where: { id: item.projectId }, data: { lifecycleState: blockers === 0 ? 'ready' : 'reviewing' } })
    return { updated, response, blockers }
  })
  return NextResponse.json({ reviewItem: result.updated, response: result.response, blockersRemaining: result.blockers })
}
