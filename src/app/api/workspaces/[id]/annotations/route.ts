import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/auth-supabase'
import { appendAuditEvent } from '@/lib/workspace-server'

async function workspace(req: NextRequest, id: string) {
  const userId = await requireUserId(req)
  const project = await db.project.findFirst({ where: { id, userId, deletedAt: null }, select: { id: true } })
  return project ? { ...project, userId } : null
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const project = await workspace(req, id)
  if (!project) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  return NextResponse.json({ annotations: await db.sourceAnnotation.findMany({ where: { projectId: id }, orderBy: { updatedAt: 'desc' } }) })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const project = await workspace(req, id)
  if (!project) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const workspaceSourceId = String(body.workspaceSourceId ?? '')
  const passageId = typeof body.passageId === 'string' ? body.passageId : null
  if (!await db.workspaceSource.findFirst({ where: { id: workspaceSourceId, projectId: id } })) return NextResponse.json({ error: 'Source link not found' }, { status: 400 })
  if (passageId && !await db.pdfChunk.findFirst({ where: { id: passageId, pdf: { projectId: id } } })) return NextResponse.json({ error: 'Passage not found' }, { status: 400 })
  if (!body.anchor || typeof body.anchor !== 'object') return NextResponse.json({ error: 'An exact source anchor is required' }, { status: 400 })
  const annotation = await db.$transaction(async (tx) => {
    const created = await tx.sourceAnnotation.create({ data: { projectId: id, workspaceSourceId, passageId, anchorJson: JSON.stringify(body.anchor), color: typeof body.color === 'string' ? body.color.slice(0, 30) : 'ochre', comment: typeof body.comment === 'string' ? body.comment.slice(0, 5_000) : null } })
    await appendAuditEvent(tx, { projectId: id, userId: project.userId, type: 'source_annotation_created', actor: 'student', payload: { summary: 'Annotated a source passage', annotationId: created.id, workspaceSourceId, passageId, color: created.color } })
    return created
  })
  return NextResponse.json({ annotation }, { status: 201 })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const project = await workspace(req, id)
  if (!project) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  const body = await req.json().catch(() => ({}))
  const current = await db.sourceAnnotation.findFirst({ where: { id: String(body.annotationId ?? ''), projectId: id } })
  if (!current) return NextResponse.json({ error: 'Annotation not found' }, { status: 404 })
  await db.$transaction(async (tx) => {
    await tx.sourceAnnotation.delete({ where: { id: current.id } })
    await appendAuditEvent(tx, { projectId: id, userId: project.userId, type: 'source_annotation_deleted', actor: 'student', payload: { summary: 'Removed a source annotation', annotationId: current.id, workspaceSourceId: current.workspaceSourceId, passageId: current.passageId } })
  })
  return NextResponse.json({ ok: true })
}
