/**
 * PATCH /api/interventions/[id]
 * Body: { userAction: 'engaged' | 'dismissed' | 'ignored', status?: 'active' | 'faded' | 'resolved' }
 * Engagement alone does not resolve an intervention; answer evaluation or an
 * explicit dismissal controls the resolution boundary.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/auth-supabase'
import { appendAuditEvent } from '@/lib/workspace-server'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const userId = await requireUserId(req)
  const body = await req.json().catch(() => ({})) as Record<string, unknown>

  const current = await db.intervention.findFirst({ where: { id, userId, project: { deletedAt: null } } })
  if (!current) return NextResponse.json({ error: 'Intervention not found' }, { status: 404 })

  const data: { userAction?: string; status?: string; resolvedAt?: Date | null } = {}
  if (body.userAction === 'engaged' || body.userAction === 'dismissed' || body.userAction === 'ignored') data.userAction = body.userAction
  if (body.status === 'active' || body.status === 'faded' || body.status === 'resolved') data.status = body.status
  if (!data.userAction && !data.status) return NextResponse.json({ error: 'A valid intervention action or status is required' }, { status: 400 })
  if (body.status === 'resolved' || body.userAction === 'dismissed') {
    data.resolvedAt = new Date()
  } else if (body.status === 'active') {
    data.resolvedAt = null
  }

  const intervention = await db.$transaction(async (tx) => {
    const updated = await tx.intervention.update({ where: { id }, data })
    const action = data.userAction ?? data.status ?? 'updated'
    await appendAuditEvent(tx, {
      projectId: current.projectId,
      userId,
      type: `intervention_${action}`,
      actor: 'student',
      payload: {
        summary: action === 'dismissed' ? 'Dismissed an intervention' : action === 'engaged' ? 'Engaged with an intervention' : action === 'ignored' ? 'Ignored an intervention' : `Marked an intervention ${action}`,
        interventionId: id,
        engineType: current.engineType,
        previousStatus: current.status,
        status: updated.status,
      },
    })
    return updated
  })
  return NextResponse.json({ intervention })
}
