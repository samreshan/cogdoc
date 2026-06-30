/**
 * GET /api/settings — public runtime settings (no auth required).
 *
 * Returns the values the frontend needs that aren't suitable for
 * NEXT_PUBLIC_* inlining (because they're set at runtime by the
 * Docker wizard, after the build is done).
 */
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    idleThresholdSeconds: Number(process.env.IDLE_THRESHOLD ?? 5),
    dailyTokenBudget: Number(process.env.DAILY_TOKEN_BUDGET ?? 100000),
  })
}
