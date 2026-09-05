import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/auth-supabase'
import { calculateResearchPriority } from '@/lib/research-priority'
import { appendAuditEvent } from '@/lib/workspace-server'

async function owned(req: NextRequest, projectId: string) {
  const userId = await requireUserId(req)
  const workspace = await db.project.findFirst({ where: { id: projectId, userId, deletedAt: null }, select: { id: true, dueAt: true } })
  return workspace ? { ...workspace, userId } : null
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!await owned(req, id)) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  const actions = await db.researchAction.findMany({ where: { projectId: id }, orderBy: [{ pinned: 'desc' }, { priority: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }] })
  return NextResponse.json({ actions })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const workspace = await owned(req, id)
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 300) : ''
  if (!title) return NextResponse.json({ error: 'An action title is required' }, { status: 400 })
  const ranked = calculateResearchPriority({
    dueAt: workspace.dueAt, pinned: body.pinned === true, blocksVerification: body.blocksVerification === true,
    evidenceState: body.evidenceState === 'missing' || body.evidenceState === 'conflicting' || body.evidenceState === 'partial' || body.evidenceState === 'supported' ? body.evidenceState : null,
    requirementUncovered: body.requirementUncovered === true,
    citationState: body.citationState === 'missing' || body.citationState === 'unverified' || body.citationState === 'verified' ? body.citationState : null,
    sourceQuality: typeof body.sourceQuality === 'number' ? body.sourceQuality : null,
    documentCentrality: typeof body.documentCentrality === 'number' ? body.documentCentrality : null,
    aiRelevanceAdjustment: typeof body.aiRelevanceAdjustment === 'number' ? body.aiRelevanceAdjustment : 0,
  })
  const action = await db.$transaction(async (tx) => {
    const created = await tx.researchAction.create({ data: {
      projectId: id, kind: typeof body.kind === 'string' ? body.kind.slice(0, 100) : 'manual', title,
      detail: typeof body.detail === 'string' ? body.detail.trim().slice(0, 2_000) : '', pinned: body.pinned === true,
      priority: ranked.score, priorityFactorsJson: JSON.stringify(ranked.factors),
      targetKind: typeof body.targetKind === 'string' ? body.targetKind : null, targetId: typeof body.targetId === 'string' ? body.targetId : null,
      documentAnchorJson: body.documentAnchor ? JSON.stringify(body.documentAnchor) : null,
    } })
    await appendAuditEvent(tx, { projectId: id, userId: workspace.userId, type: 'research_action_created', actor: 'student', payload: { summary: `Created action: ${title}`, actionId: created.id, priority: created.priority } })
    return created
  })
  return NextResponse.json({ action, explanation: ranked.explanation }, { status: 201 })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const workspace = await owned(req, id)
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const current = await db.researchAction.findFirst({ where: { id: String(body.actionId ?? ''), projectId: id } })
  if (!current) return NextResponse.json({ error: 'Action not found' }, { status: 404 })
  let factors: Record<string, number> = {}
  try { factors = JSON.parse(current.priorityFactorsJson) as Record<string, number> } catch {}
  const pinned = typeof body.pinned === 'boolean' ? body.pinned : current.pinned
  factors.pinned = pinned ? 100 : 0
  const priority = Object.values(factors).reduce((sum, value) => sum + Number(value || 0), 0)
  const state = body.state === 'completed' || body.state === 'dismissed' || body.state === 'open' ? body.state : undefined
  const snoozedUntil = typeof body.snoozedUntil === 'string' ? new Date(body.snoozedUntil) : body.snoozedUntil === null ? null : undefined
  if (snoozedUntil instanceof Date && !Number.isFinite(snoozedUntil.getTime())) return NextResponse.json({ error: 'Invalid snooze date' }, { status: 400 })
  const action = await db.$transaction(async (tx) => {
    const updated = await tx.researchAction.update({ where: { id: current.id }, data: {
      pinned, priority, priorityFactorsJson: JSON.stringify(factors), state, snoozedUntil,
      completedAt: state === 'completed' ? new Date() : state === 'open' ? null : undefined,
      dismissedAt: state === 'dismissed' ? new Date() : state === 'open' ? null : undefined,
    } })
    const change = state ? `marked ${state}` : snoozedUntil ? 'snoozed' : pinned !== current.pinned ? pinned ? 'pinned' : 'unpinned' : 'updated'
    await appendAuditEvent(tx, { projectId: id, userId: workspace.userId, type: `research_action_${change.replace(/\s+/g, '_')}`, actor: 'student', payload: { summary: `${change[0]!.toUpperCase()}${change.slice(1)} action: ${current.title}`, actionId: current.id, previousState: current.state, state: updated.state, pinned: updated.pinned, snoozedUntil: updated.snoozedUntil?.toISOString() ?? null } })
    return updated
  })
  return NextResponse.json({ action })
}
