/**
 * GET  /api/interventions?projectId=... — list interventions for a project
 * PATCH /api/interventions/[id] — update user_action / status
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { dedupeInterventionsByPhrase } from '@/lib/intervention-dedupe'
import type { Intervention } from '@/lib/types'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId')
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 })

  const interventions = await db.intervention.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      evidences: {
        select: {
          id: true,
          similarityScore: true,
          citedExcerpt: true,
          chunk: { select: { pageApprox: true, pdf: { select: { filename: true } } } },
        },
      },
    },
  })
  return NextResponse.json({ interventions: dedupeInterventionsByPhrase(interventions as unknown as Intervention[]) })
}
