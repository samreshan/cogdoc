import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/auth-supabase'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId(req)
  const { id } = await params
  const workspace = await db.project.findFirst({ where: { id, userId }, select: { id: true, document: { select: { contentHash: true } } } })
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  const requestedRunId = req.nextUrl.searchParams.get('reviewRunId')
  const run = requestedRunId
    ? await db.reviewRun.findFirst({ where: { id: requestedRunId, projectId: id }, include: { documentVersion: { select: { contentHash: true } } } })
    : await db.reviewRun.findFirst({ where: { projectId: id, status: 'ready' }, orderBy: { createdAt: 'desc' }, include: { documentVersion: { select: { contentHash: true } } } })
  const runId = run?.id
  if (!runId) return NextResponse.json({ reviewItems: [], reviewRunId: null })
  const reviewItems = await db.reviewItem.findMany({
    where: { projectId: id, reviewRunId: runId },
    orderBy: [{ severity: 'asc' }, { createdAt: 'asc' }],
    include: { responses: { orderBy: { createdAt: 'desc' }, take: 1 }, claim: true },
  })
  return NextResponse.json({ reviewItems, reviewRunId: runId, stale: workspace.document?.contentHash !== run.documentVersion.contentHash })
}
