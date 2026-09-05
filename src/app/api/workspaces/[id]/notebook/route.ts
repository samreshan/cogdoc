import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/auth-supabase'
import { appendAuditEvent } from '@/lib/workspace-server'

async function owned(req: NextRequest, projectId: string) {
  const userId = await requireUserId(req)
  const workspace = await db.project.findFirst({ where: { id: projectId, userId, deletedAt: null }, select: { id: true } })
  return workspace ? { ...workspace, userId } : null
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const workspace = await owned(req, id)
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  const notes = await db.researchNote.findMany({ where: { projectId: id }, orderBy: { updatedAt: 'desc' } })
  return NextResponse.json({ notes })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const workspace = await owned(req, id)
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const noteBody = typeof body.body === 'string' ? body.body.trim().slice(0, 50_000) : ''
  if (!noteBody) return NextResponse.json({ error: 'A note body is required' }, { status: 400 })
  const workspaceSourceId = typeof body.workspaceSourceId === 'string' ? body.workspaceSourceId : null
  const passageId = typeof body.passageId === 'string' ? body.passageId : null
  if (workspaceSourceId && !await db.workspaceSource.findFirst({ where: { id: workspaceSourceId, projectId: id } })) return NextResponse.json({ error: 'Source link not found' }, { status: 400 })
  if (passageId && !await db.pdfChunk.findFirst({ where: { id: passageId, pdf: { projectId: id } } })) return NextResponse.json({ error: 'Passage not found' }, { status: 400 })
  const note = await db.$transaction(async (tx) => {
    const created = await tx.researchNote.create({ data: {
      projectId: id, workspaceSourceId, passageId, body: noteBody,
      title: typeof body.title === 'string' ? body.title.trim().slice(0, 300) || null : null,
      kind: body.kind === 'excerpt' ? 'excerpt' : 'note',
      exactExcerpt: typeof body.exactExcerpt === 'string' ? body.exactExcerpt.slice(0, 20_000) : null,
      sourceAnchorJson: body.sourceAnchor ? JSON.stringify(body.sourceAnchor) : null,
      documentAnchorJson: body.documentAnchor ? JSON.stringify(body.documentAnchor) : null,
    } })
    await appendAuditEvent(tx, { projectId: id, userId: workspace.userId, type: 'research_note_created', actor: 'student', payload: { summary: `Created ${created.kind === 'excerpt' ? 'a linked excerpt note' : 'a research note'}${created.title ? `: ${created.title}` : ''}`, noteId: created.id, workspaceSourceId, passageId } })
    return created
  })
  return NextResponse.json({ note }, { status: 201 })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const workspace = await owned(req, id)
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const current = await db.researchNote.findFirst({ where: { id: String(body.noteId ?? ''), projectId: id } })
  if (!current) return NextResponse.json({ error: 'Note not found' }, { status: 404 })
  const note = await db.$transaction(async (tx) => {
    const updated = await tx.researchNote.update({ where: { id: current.id }, data: {
      title: typeof body.title === 'string' ? body.title.trim().slice(0, 300) || null : undefined,
      body: typeof body.body === 'string' ? body.body.trim().slice(0, 50_000) : undefined,
      documentAnchorJson: body.documentAnchor ? JSON.stringify(body.documentAnchor) : undefined,
      stale: typeof body.stale === 'boolean' ? body.stale : undefined,
    } })
    await appendAuditEvent(tx, { projectId: id, userId: workspace.userId, type: 'research_note_updated', actor: 'student', payload: { summary: `Updated research note${updated.title ? `: ${updated.title}` : ''}`, noteId: current.id, stale: updated.stale } })
    return updated
  })
  return NextResponse.json({ note })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const workspace = await owned(req, id)
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  const body = await req.json().catch(() => ({}))
  const current = await db.researchNote.findFirst({ where: { id: String(body.noteId ?? ''), projectId: id } })
  if (!current) return NextResponse.json({ error: 'Note not found' }, { status: 404 })
  await db.$transaction(async (tx) => {
    await tx.researchNote.delete({ where: { id: current.id } })
    await appendAuditEvent(tx, { projectId: id, userId: workspace.userId, type: 'research_note_deleted', actor: 'student', payload: { summary: `Deleted research note${current.title ? `: ${current.title}` : ''}`, noteId: current.id } })
  })
  return NextResponse.json({ ok: true })
}
