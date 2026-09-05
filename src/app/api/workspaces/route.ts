import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/auth-supabase'
import { isCitationStyle, isWorkspaceType, normalizeReviewPace } from '@/lib/workspace'
import { appendAuditEvent } from '@/lib/workspace-server'

export async function GET(req: NextRequest) {
  const userId = await requireUserId(req)
  const workspaces = await db.project.findMany({
    where: { userId, archived: false, deletedAt: null },
    orderBy: { updatedAt: 'desc' },
    include: {
      document: true,
      _count: { select: { pdfs: true, interventions: true, reviewItems: true, codeSnapshots: true } },
      reviewRuns: { orderBy: { createdAt: 'desc' }, take: 1 },
      certificates: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  })
  return NextResponse.json({ workspaces })
}

export async function POST(req: NextRequest) {
  const userId = await requireUserId(req)
  const body = await req.json().catch(() => ({}))
  // Research is the product default. Explicit legacy assignment values remain
  // readable during migration, but new clients never need to choose a mode.
  const workspaceType = isWorkspaceType(body.workspaceType) ? body.workspaceType : 'research'
  const title = String(body.title ?? '').trim() || 'Untitled research project'
  const reviewPace = normalizeReviewPace(body.reviewPace)
  const citationStyle = isCitationStyle(body.citationStyle) ? body.citationStyle : 'harvard'
  const dueAt = body.dueAt ? new Date(body.dueAt) : null
  if (dueAt && Number.isNaN(dueAt.valueOf())) {
    return NextResponse.json({ error: 'dueAt must be a valid date' }, { status: 400 })
  }

  const workspace = await db.$transaction(async (tx) => {
    const created = await tx.project.create({
      data: {
        userId,
        title,
        description: String(body.description ?? '').trim() || null,
        workspaceType,
        dueAt,
        reviewPace,
        citationStyle,
        briefText: String(body.briefText ?? '').trim() || null,
        document: { create: { content: '', contentHash: '', revision: 0 } },
      },
      include: { document: true },
    })
    await appendAuditEvent(tx, {
      projectId: created.id,
      userId,
      type: 'workspace_created',
      payload: { workspaceType, reviewPace, citationStyle, dueAt: dueAt?.toISOString() ?? null },
    })
    return created
  })
  return NextResponse.json({ workspace }, { status: 201 })
}
