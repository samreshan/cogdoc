/**
 * GET    /api/projects/[id] — fetch a single project with document + interventions
 * DELETE /api/projects/[id] — delete a project (cascade)
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/auth-supabase'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const userId = await requireUserId(req)
  const project = await db.project.findUnique({
    where: { id, userId },
    include: {
      document: true,
      pdfs: {
        orderBy: { uploadedAt: 'desc' },
        select: {
          id: true,
          filename: true,
          sizeBytes: true,
          parseStatus: true,
          uploadedAt: true,
          _count: { select: { chunks: true } },
        },
      },
      interventions: {
        orderBy: { createdAt: 'desc' },
        take: 100,
      },
    },
  })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ project })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const userId = await requireUserId(req)
  const project = await db.project.findUnique({ where: { id }, select: { userId: true } })
  if (!project || project.userId !== userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  await db.project.update({
    where: { id },
    data: { archived: true, deletedAt: new Date() },
  })
  return NextResponse.json({ ok: true })
}
