import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/auth-supabase'
import { appendAuditEvent } from '@/lib/workspace-server'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId(req)
  const { id } = await params
  if (!await db.project.findFirst({ where: { id, userId } })) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  const jobs = await db.researchJob.findMany({ where: { projectId: id }, orderBy: { createdAt: 'desc' }, take: 100 })
  return NextResponse.json({ jobs })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId(req)
  const { id } = await params
  if (!await db.project.findFirst({ where: { id, userId } })) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  const body = await req.json().catch(() => ({}))
  const job = await db.researchJob.findFirst({ where: { id: String(body.jobId ?? ''), projectId: id, status: { in: ['queued', 'running'] } } })
  if (!job) return NextResponse.json({ error: 'Cancellable job not found' }, { status: 404 })
  await db.$transaction(async (tx) => {
    await tx.researchJob.update({ where: { id: job.id }, data: { status: 'cancelled', leaseOwner: null, leaseExpiresAt: null } })
    await appendAuditEvent(tx, { projectId: id, userId, type: 'research_job_cancelled', actor: 'student', payload: { summary: `Cancelled ${job.kind.replace(/_/g, ' ')} work`, jobId: job.id, kind: job.kind } })
  })
  return NextResponse.json({ ok: true })
}
