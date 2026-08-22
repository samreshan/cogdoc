import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/auth-supabase'
import { appendAuditEvent } from '@/lib/workspace-server'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId(req)
  const { id } = await params
  const workspace = await db.project.findFirst({ where: { id, userId }, select: { id: true } })
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  const references = await db.reference.findMany({ where: { projectId: id }, orderBy: { createdAt: 'asc' }, include: { source: true } })
  return NextResponse.json({ references })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId(req)
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const referenceId = String(body.referenceId ?? '')
  const reference = await db.reference.findFirst({ where: { id: referenceId, projectId: id, project: { userId } } })
  if (!reference) return NextResponse.json({ error: 'Reference not found' }, { status: 404 })
  if (body.sourceId) {
    const source = await db.pdf.findFirst({ where: { id: String(body.sourceId), projectId: id, userId } })
    if (!source) return NextResponse.json({ error: 'Source not found' }, { status: 404 })
  }
  const updated = await db.$transaction(async (tx) => {
    const saved = await tx.reference.update({
      where: { id: referenceId },
      data: {
        sourceId: body.sourceId === null ? null : body.sourceId ? String(body.sourceId) : undefined,
        metadataStatus: body.confirmMetadata === true ? 'confirmed' : undefined,
        title: typeof body.title === 'string' ? body.title.trim() || null : undefined,
        year: typeof body.year === 'string' ? body.year.trim() || null : undefined,
        doi: typeof body.doi === 'string' ? body.doi.trim() || null : undefined,
      },
    })
    await appendAuditEvent(tx, { projectId: id, userId, type: 'reference_updated', payload: { referenceId, sourceId: body.sourceId ?? null, confirmed: body.confirmMetadata === true } })
    return saved
  })
  return NextResponse.json({ reference: updated })
}

