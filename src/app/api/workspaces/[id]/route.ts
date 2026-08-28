import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/auth-supabase'
import { isCitationStyle, normalizeReviewPace } from '@/lib/workspace'
import { appendAuditEvent } from '@/lib/workspace-server'
import { formatStoredReference } from '@/lib/citation-format'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId(req)
  const { id } = await params
  const workspace = await db.project.findFirst({
    where: { id, userId, archived: false, deletedAt: null },
    include: {
      document: true,
      interventions: {
        where: { status: 'active' },
        orderBy: { createdAt: 'desc' },
        take: 30,
        include: {
          evidences: { include: { chunk: { include: { pdf: { select: { filename: true } } } } } },
        },
      },
      pdfs: { orderBy: { uploadedAt: 'desc' }, include: { _count: { select: { chunks: true } } } },
      requirements: { orderBy: { createdAt: 'asc' } },
      reviewRuns: { orderBy: { createdAt: 'desc' }, take: 5 },
      reviewItems: { orderBy: [{ severity: 'asc' }, { createdAt: 'asc' }], include: { responses: true } },
      references: { orderBy: { createdAt: 'asc' } },
      codeSnapshots: { orderBy: { createdAt: 'desc' }, include: { _count: { select: { files: true } } } },
      assets: { orderBy: { createdAt: 'desc' }, take: 20 },
      reports: { orderBy: { createdAt: 'desc' }, take: 5 },
      certificates: { orderBy: { createdAt: 'desc' }, take: 5, include: { shares: true } },
      _count: { select: { pdfs: true, interventions: true, reviewItems: true, codeSnapshots: true } },
    },
  })
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  return NextResponse.json({ workspace })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId(req)
  const { id } = await params
  const existing = await db.project.findFirst({ where: { id, userId }, select: { id: true, citationStyle: true } })
  if (!existing) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  const body = await req.json().catch(() => ({}))
  if (body.citationStyle !== undefined && !isCitationStyle(body.citationStyle)) {
    return NextResponse.json({ error: 'citationStyle must be harvard or apa' }, { status: 400 })
  }
  const dueAt = body.dueAt === null ? null : body.dueAt ? new Date(body.dueAt) : undefined
  if (dueAt instanceof Date && Number.isNaN(dueAt.valueOf())) {
    return NextResponse.json({ error: 'dueAt must be a valid date' }, { status: 400 })
  }
  const requestedCitationStyle = isCitationStyle(body.citationStyle) ? body.citationStyle : undefined
  const citationStyleChanged = Boolean(requestedCitationStyle && requestedCitationStyle !== existing.citationStyle)
  const result = await db.$transaction(async (tx) => {
    const updated = await tx.project.update({
      where: { id },
      data: {
        title: typeof body.title === 'string' ? body.title.trim().slice(0, 200) || undefined : undefined,
        description: typeof body.description === 'string' ? body.description.trim() || null : undefined,
        dueAt,
        reviewPace: body.reviewPace ? normalizeReviewPace(body.reviewPace) : undefined,
        citationStyle: requestedCitationStyle,
        briefText: typeof body.briefText === 'string' ? body.briefText.trim() || null : undefined,
      },
    })
    let referencesReformatted = 0
    let referencesNeedingReview = 0
    if (citationStyleChanged && requestedCitationStyle) {
      const references = await tx.reference.findMany({
        where: { projectId: id },
        select: { id: true, title: true, authorsJson: true, year: true, doi: true, url: true, metadataJson: true },
      })
      for (const reference of references) {
        const formatted = formatStoredReference(reference, requestedCitationStyle)
        if (!formatted) {
          referencesNeedingReview += 1
          continue
        }
        await tx.reference.update({
          where: { id: reference.id },
          data: { rawText: formatted.reference, style: requestedCitationStyle },
        })
        referencesReformatted += 1
      }
    }
    await appendAuditEvent(tx, {
      projectId: id,
      userId,
      type: citationStyleChanged ? 'citation_style_changed' : 'workspace_updated',
      payload: { fields: Object.keys(body), referencesReformatted, referencesNeedingReview },
    })
    return { workspace: updated, referencesReformatted, referencesNeedingReview }
  })
  return NextResponse.json(result)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId(req)
  const { id } = await params
  const result = await db.$transaction(async (tx) => {
    const existing = await tx.project.findFirst({ where: { id, userId }, select: { id: true } })
    if (!existing) return false
    await tx.shareGrant.updateMany({ where: { certificate: { projectId: id } }, data: { revokedAt: new Date() } })
    await tx.certificate.updateMany({ where: { projectId: id, status: { not: 'revoked' } }, data: { status: 'revoked', revokedAt: new Date() } })
    await tx.project.update({ where: { id }, data: { archived: true, deletedAt: new Date() } })
    await appendAuditEvent(tx, { projectId: id, userId, type: 'workspace_deleted', payload: { retentionDays: 30 } })
    return true
  })
  if (!result) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
