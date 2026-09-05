/**
 * GET /api/projects — list all projects for the default user
 * POST /api/projects — create a new project (auto-creates an empty Document)
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/auth-supabase'
import { appendAuditEvent } from '@/lib/workspace-server'

export async function GET(req = new NextRequest('http://localhost/api/projects')) {
  const userId = await requireUserId(req)
  const projects = await db.project.findMany({
    where: { userId, archived: false },
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
  const userId = await requireUserId(req)
  const body = await req.json().catch(() => ({}))
  const title = (body.title ?? '').trim() || 'Untitled Project'
  const description = (body.description ?? '').trim() || null

  const project = await db.$transaction(async (tx) => {
    const created = await tx.project.create({
      data: {
        userId,
        title,
        description,
        document: { create: { content: '' } },
      },
      include: { document: true },
    })
    await appendAuditEvent(tx, {
      projectId: created.id,
      userId,
      type: 'workspace_created',
      actor: 'student',
      payload: { summary: `Created research project: ${title}`, compatibilityRoute: true },
    })
    return created
  })
  return NextResponse.json({ project }, { status: 201 })
}
