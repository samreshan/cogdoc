/**
 * PUT /api/projects/[id]/document — save the document content (auto-save)
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const content = typeof body.content === 'string' ? body.content : ''

  const project = await db.project.findUnique({ where: { id }, select: { document: true } })
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const document = await db.document.upsert({
    where: { projectId: id },
    update: { content, lastSaved: new Date() },
    create: { projectId: id, content, lastSaved: new Date() },
  })

  // Touch project.updatedAt
  await db.project.update({ where: { id }, data: { updatedAt: new Date() } })

  return NextResponse.json({ ok: true, lastSaved: document.lastSaved })
}
