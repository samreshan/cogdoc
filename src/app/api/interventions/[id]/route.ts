/**
 * PATCH /api/interventions/[id]
 * Body: { userAction: 'engaged' | 'dismissed' | 'ignored', status?: 'active' | 'faded' | 'resolved' }
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))

  const data: { userAction?: string; status?: string; resolvedAt?: Date } = {}
  if (body.userAction) data.userAction = body.userAction
  if (body.status) data.status = body.status
  if (body.status === 'resolved' || body.userAction === 'engaged' || body.userAction === 'dismissed') {
    data.resolvedAt = new Date()
  }

  const intervention = await db.intervention.update({
    where: { id },
    data,
  })
  return NextResponse.json({ intervention })
}
