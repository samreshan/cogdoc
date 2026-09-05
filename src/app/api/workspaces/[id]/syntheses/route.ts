import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/auth-supabase'
import { enqueueResearchJob } from '@/lib/research-jobs'
import { appendAuditEvent } from '@/lib/workspace-server'

const KINDS = new Set(['summary', 'comparison', 'research_gap', 'counterevidence', 'outline'])

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId(req)
  const { id } = await params
  if (!await db.project.findFirst({ where: { id, userId } })) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  const syntheses = await db.groundedSynthesis.findMany({ where: { projectId: id }, include: { findings: { orderBy: { sortOrder: 'asc' }, include: { passages: { select: { passageId: true } } } } }, orderBy: { createdAt: 'desc' } })
  return NextResponse.json({ syntheses: syntheses.map((item) => ({ ...item, findings: item.findings.map((finding) => ({ ...finding, passageIds: finding.passages.map((passage) => passage.passageId) })) })) })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId(req)
  const { id } = await params
  if (!await db.project.findFirst({ where: { id, userId } })) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  if (body.confirmedByAuthor !== true) return NextResponse.json({ error: 'Synthesis requires an explicit author action' }, { status: 400 })
  const kind = typeof body.kind === 'string' && KINDS.has(body.kind) ? body.kind : null
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim().slice(0, 2_000) : ''
  const passageIds = Array.isArray(body.passageIds) ? [...new Set(body.passageIds.filter((value): value is string => typeof value === 'string'))].slice(0, 50) : []
  if (!kind || !prompt || !passageIds.length) return NextResponse.json({ error: 'Kind, prompt, and one or more indexed passages are required' }, { status: 400 })
  const passages = await db.pdfChunk.findMany({ where: { id: { in: passageIds }, pdf: { projectId: id, userId } }, select: { id: true } })
  if (passages.length !== passageIds.length) return NextResponse.json({ error: 'Every synthesis point must reference an owned indexed passage' }, { status: 422 })
  const synthesis = await db.$transaction(async (tx) => {
    const created = await tx.groundedSynthesis.create({ data: { projectId: id, kind, prompt, status: 'queued' } })
    await appendAuditEvent(tx, { projectId: id, userId, type: 'grounded_synthesis_requested', actor: 'student', payload: { summary: `Requested a passage-grounded ${kind.replace(/_/g, ' ')}`, synthesisId: created.id, kind, passageIds } })
    return created
  })
  await enqueueResearchJob({ projectId: id, kind: 'synthesis', payload: { synthesisId: synthesis.id, passageIds }, idempotencyKey: `synthesis:${synthesis.id}` })
  return NextResponse.json({ synthesis }, { status: 202 })
}
