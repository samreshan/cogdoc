/**
 * GET/PUT /api/settings — runtime settings + friction-mode persistence.
 *
 * GET returns the public env-derived settings (idle threshold, token budget) and
 * the acting user's frictionMode.
 *
 * PUT validates and persists a friction-mode change on the User row
 * (PRODUCT.md §9 friction calibration). The mode flows client (store) → request
 * body → engine routes → cooldown/guard logic.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/auth-supabase'
import { FRICTION_MODES, type FrictionMode } from '@/lib/friction'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const userId = await requireUserId(req)
  const user = await db.user.findUnique({ where: { id: userId }, select: { frictionMode: true } })
  const frictionMode = (user?.frictionMode as FrictionMode | undefined) ?? 'socratic'
  return NextResponse.json({
    idleThresholdSeconds: Number(process.env.IDLE_THRESHOLD ?? 2),
    dailyTokenBudget: Number(process.env.DAILY_TOKEN_BUDGET ?? 100000),
    frictionMode,
  })
}

export async function PUT(req: NextRequest) {
  const userId = await requireUserId(req)
  const body = await req.json().catch(() => ({}))
  const { frictionMode } = body as { frictionMode?: string }

  if (!frictionMode || !FRICTION_MODES.includes(frictionMode as FrictionMode)) {
    return NextResponse.json(
      { error: `frictionMode must be one of ${FRICTION_MODES.join(', ')}` },
      { status: 400 },
    )
  }

  const updated = await db.user.update({
    where: { id: userId },
    data: { frictionMode },
    select: { frictionMode: true },
  })
  return NextResponse.json({ frictionMode: updated.frictionMode })
}
