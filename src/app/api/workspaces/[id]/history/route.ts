import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/auth-supabase'
import { appendAuditEvent, verifyAuditChain } from '@/lib/workspace-server'

const DECISION_TYPE = /^[a-z][a-z0-9_]{2,79}$/
const INTERVENTION_ENGINES = new Set(['interceptor', 'socratic', 'citation', 'scaffold'])

function payload(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

function category(type: string, actor: string): 'decision' | 'intervention' | 'system' {
  if (type.startsWith('intervention_')) return 'intervention'
  return actor === 'student' ? 'decision' : 'system'
}

async function ownedWorkspace(req: NextRequest, id: string) {
  const userId = await requireUserId(req)
  const workspace = await db.project.findFirst({ where: { id, userId, deletedAt: null }, select: { id: true } })
  return { userId, workspace }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { workspace } = await ownedWorkspace(req, id)
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  const [allEvents, interventions] = await Promise.all([
    db.auditEvent.findMany({ where: { projectId: id }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 1_001 }),
    db.intervention.findMany({
      where: { projectId: id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 500,
      include: { _count: { select: { evidences: true } } },
    }),
  ])
  const truncated = allEvents.length > 1_000
  const chronological = allEvents.slice(0, 1_000)
  const legacyEventCount = chronological.filter((event) => !event.eventHash).length
  const integrity = legacyEventCount
    ? 'legacy_unsealed'
    : verifyAuditChain(chronological) ? 'verified' : 'broken'
  const events = chronological.reverse().map((event) => ({
    id: event.id,
    type: event.type,
    actor: event.actor === 'system' ? 'system' as const : 'student' as const,
    category: category(event.type, event.actor),
    payload: payload(event.payloadJson),
    documentHash: event.documentHash,
    modelVersion: event.modelVersion,
    promptVersion: event.promptVersion,
    sealed: Boolean(event.eventHash),
    createdAt: event.createdAt,
  }))
  return NextResponse.json({
    events,
    interventions: interventions.map((item) => ({
      id: item.id,
      engineType: INTERVENTION_ENGINES.has(item.engineType) ? item.engineType : 'citation',
      promptText: item.promptText,
      responseText: item.responseText,
      verdict: item.verdict,
      status: item.status,
      userAction: item.userAction,
      evidenceCount: item._count.evidences,
      createdAt: item.createdAt,
      resolvedAt: item.resolvedAt,
    })),
    integrity,
    legacyEventCount,
    truncated,
  })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { userId, workspace } = await ownedWorkspace(req, id)
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const type = typeof body.type === 'string' ? body.type.trim() : ''
  const summary = typeof body.summary === 'string' ? body.summary.trim().slice(0, 500) : ''
  if (!DECISION_TYPE.test(type) || !summary) {
    return NextResponse.json({ error: 'A valid decision type and summary are required' }, { status: 400 })
  }
  const event = await db.$transaction((tx) => appendAuditEvent(tx, {
    projectId: id,
    userId,
    type,
    actor: 'student',
    payload: {
      summary,
      entityType: typeof body.entityType === 'string' ? body.entityType.slice(0, 80) : null,
      entityId: typeof body.entityId === 'string' ? body.entityId.slice(0, 200) : null,
      detail: body.detail && typeof body.detail === 'object' && !Array.isArray(body.detail) ? body.detail as Record<string, unknown> : {},
    },
  }))
  return NextResponse.json({ event: { id: event.id, type: event.type, createdAt: event.createdAt } }, { status: 201 })
}
