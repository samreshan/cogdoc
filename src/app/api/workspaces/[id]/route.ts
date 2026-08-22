import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/auth-supabase'
import { isCitationStyle, normalizeReviewPace } from '@/lib/workspace'
import { appendAuditEvent } from '@/lib/workspace-server'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId(req)
  const { id } = await params
  const workspace = await db.project.findFirst({
    where: { id, userId, archived: false, deletedAt: null },
    include: {
      document: true,
      pdfs: { orderBy: { uploadedAt: 'desc' }, include: { _count: { select: { chunks: true } } } },
      requirements: { orderBy: { createdAt: 'asc' } },
      reviewRuns: { orderBy: { createdAt: 'desc' }, take: 5 },
      reviewItems: { orderBy: [{ severity: 'asc' }, { createdAt: 'asc' }], include: { responses: true } },
      references: { orderBy: { createdAt: 'asc' } },
      codeSnapshots: { orderBy: { createdAt: 'desc' }, include: { _count: { select: { files: true } } } },
      assets: { orderBy: { createdAt: 'desc' }, take: 20 },
      reports: { orderBy: { createdAt: 'desc' }, take: 5 },
      certificates: { orderBy: { createdAt: 'desc' }, take: 5, include: { shares: true } },
      _count: { select: { pdfs: true, reviewItems: true, codeSnapshots: true } },
    },
  })
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  return NextResponse.json({ workspace })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId(req)
  const { id } = await params
  const existing = await db.project.findFirst({ where: { id, userId }, select: { id: true } })
  if (!existing) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  const body = await req.json().catch(() => ({}))
  const dueAt = body.dueAt === null ? null : body.dueAt ? new Date(body.dueAt) : undefined
  if (dueAt instanceof Date && Number.isNaN(dueAt.valueOf())) {
    return NextResponse.json({ error: 'dueAt must be a valid date' }, { status: 400 })
  }
  const workspace = await db.$transaction(async (tx) => {
    const updated = await tx.project.update({
      where: { id },
      data: {
        title: typeof body.title === 'string' ? body.title.trim().slice(0, 200) || undefined : undefined,
        description: typeof body.description === 'string' ? body.description.trim() || null : undefined,
        dueAt,
        reviewPace: body.reviewPace ? normalizeReviewPace(body.reviewPace) : undefined,
        citationStyle: body.citationStyle && isCitationStyle(body.citationStyle) ? body.citationStyle : undefined,
        briefText: typeof body.briefText === 'string' ? body.briefText.trim() || null : undefined,
      },
    })
    await appendAuditEvent(tx, { projectId: id, userId, type: 'workspace_updated', payload: { fields: Object.keys(body) } })
    return updated
  })
  return NextResponse.json({ workspace })
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
