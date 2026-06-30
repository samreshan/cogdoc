/**
 * GET /api/analytics?projectId=...
 * Returns aggregate counts: total interventions, by engine, by user_action, by verdict.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId')
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 })

  const interventions = await db.intervention.findMany({
    where: { projectId },
    select: { engineType: true, userAction: true, verdict: true, status: true, createdAt: true },
  })

  const byEngine: Record<string, number> = {}
  const byAction: Record<string, number> = {}
  const byVerdict: Record<string, number> = {}

  for (const i of interventions) {
    byEngine[i.engineType] = (byEngine[i.engineType] ?? 0) + 1
    if (i.userAction) byAction[i.userAction] = (byAction[i.userAction] ?? 0) + 1
    if (i.verdict) byVerdict[i.verdict] = (byVerdict[i.verdict] ?? 0) + 1
  }

  const engagementRate = interventions.length === 0
    ? 0
    : (byAction.engaged ?? 0) / interventions.length

  return NextResponse.json({
    total: interventions.length,
    byEngine,
    byAction,
    byVerdict,
    engagementRate,
  })
}
