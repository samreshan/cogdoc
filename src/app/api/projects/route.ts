/**
 * GET /api/projects — list all projects for the default user
 * POST /api/projects — create a new project (auto-creates an empty Document)
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getDefaultUser } from '@/lib/auth'

export async function GET() {
  const user = await getDefaultUser()
  const projects = await db.project.findMany({
    where: { userId: user.id, archived: false },
    orderBy: { updatedAt: 'desc' },
    include: {
      _count: {
        select: { pdfs: true, interventions: true },
      },
      document: true,
    },
  })
  return NextResponse.json({ projects })
}

export async function POST(req: NextRequest) {
  const user = await getDefaultUser()
  const body = await req.json().catch(() => ({}))
  const title = (body.title ?? '').trim() || 'Untitled Project'
  const description = (body.description ?? '').trim() || null

  const project = await db.project.create({
    data: {
      userId: user.id,
      title,
      description,
      document: { create: { content: '' } },
    },
    include: { document: true },
  })
  return NextResponse.json({ project }, { status: 201 })
}
