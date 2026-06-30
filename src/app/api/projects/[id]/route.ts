/**
 * GET    /api/projects/[id] — fetch a single project with document + interventions
 * DELETE /api/projects/[id] — delete a project (cascade)
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const project = await db.project.findUnique({
    where: { id },
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
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  await db.project.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
