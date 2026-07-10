/**
 * POST /api/socratic-spacer
 * Body: { projectId, paragraphId, context, stub }
 *
 * Generates a Socratic ghost question using [Provocation] tag and persists
 * an intervention. The frontend idle detector fires this after 45s of inactivity.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/auth-supabase'
import { getAIService } from '@/lib/ai-service'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { projectId, paragraphId, context, stub } = body as {
    projectId: string
    paragraphId?: string
    context: string
    stub?: string
  }

  if (!projectId) {
    return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
  }

  const userId = await requireUserId(req)
  const project = await db.project.findUnique({ where: { id: projectId } })
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const ai = getAIService()
  const socratic = await ai.generateSocratic('Provocation', context, stub)

  const intervention = await db.intervention.create({
    data: {
      userId,
      projectId,
      paragraphId: paragraphId ?? null,
      promptTemplateTag: 'Provocation',
      engineType: 'socratic',
      promptText: stub ?? '',
      responseText: socratic.question,
      status: 'active',
    },
  })

  return NextResponse.json({
    ghostQuestion: socratic.question,
    intervention,
  })
}
