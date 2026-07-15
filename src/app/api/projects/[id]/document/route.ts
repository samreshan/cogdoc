/**
 * PUT /api/projects/[id]/document — save the document content (auto-save)
 *
 * Phase 6: this was the only mutation route without auth. Now wrapped so an
 * unauthenticated request gets a clean 401 (matches all other mutation routes).
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/auth-supabase'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const userId = await requireUserId(req)
  const body = await req.json().catch(() => ({}))
  const content = typeof body.content === 'string' ? body.content : ''

  // Verify the project belongs to the acting user (isolation, §8).
  const project = await db.project.findUnique({ where: { id }, select: { userId: true, document: true } })
  if (!project || project.userId !== userId) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const document = await db.document.upsert({
    where: { projectId: id },
    update: { content, lastSaved: new Date() },
    create: { projectId: id, content, lastSaved: new Date() },
  })

  // Touch project.updatedAt
  await db.project.update({ where: { id }, data: { updatedAt: new Date() } })

  return NextResponse.json({ ok: true, lastSaved: document.lastSaved })
}
