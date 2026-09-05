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
import { applyGenerationGuard } from '@/lib/engine-guard'
import type { FrictionMode } from '@/lib/friction'
import { appendAuditEvent } from '@/lib/workspace-server'

export const runtime = 'nodejs'
export const maxDuration = 30
export const SOCRATIC_PROVIDER_FALLBACK =
  'What would change your mind?'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { projectId, paragraphId, context, stub, friction_mode } = body as {
    projectId: string
    paragraphId?: string
    context: string
    stub?: string
    friction_mode?: FrictionMode
  }

  if (!projectId) {
    return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
  }

  const mode: FrictionMode = friction_mode ?? 'socratic'
  const userId = await requireUserId(req)
  const project = await db.project.findUnique({ where: { id: projectId, userId } })
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const anchorText = stub?.trim() ?? ''
  if (anchorText) {
    const existing = await db.intervention.findFirst({
      where: { userId, projectId, status: 'active', promptText: anchorText },
      orderBy: { createdAt: 'desc' },
    })
    if (existing) {
      return NextResponse.json({
        ghostQuestion: existing.responseText,
        intervention: existing,
        deduplicated: true,
      })
    }
  }

  const ai = getAIService()
  let question = SOCRATIC_PROVIDER_FALLBACK
  let assistantFallback = false
  try {
    const socratic = await ai.generateSocratic('Provocation', context, stub)
    question = socratic.question
  } catch (error) {
    assistantFallback = true
    const reason = error instanceof Error ? error.message.slice(0, 200) : 'unknown provider error'
    console.warn(`[socratic-spacer] assistant unavailable; using local research question: ${reason}`)
  }

  // Friction §9: enforce the non-generation invariant before persisting.
  const guarded = applyGenerationGuard(question, mode)

  const intervention = await db.$transaction(async (tx) => {
    const created = await tx.intervention.create({
      data: {
        userId,
        projectId,
        paragraphId: paragraphId ?? null,
        promptTemplateTag: 'Provocation',
        engineType: 'socratic',
        promptText: anchorText,
        responseText: guarded.text,
        status: 'active',
      },
    })
    await appendAuditEvent(tx, {
      projectId, userId, type: 'intervention_created', actor: 'system',
      modelVersion: assistantFallback ? 'local-fallback' : process.env.AI_MODEL ?? process.env.GEMINI_MODEL ?? null, promptVersion: 'Provocation',
      payload: { summary: 'Cogdoc raised a research question', interventionId: created.id, engineType: 'socratic', paragraphId: paragraphId ?? null, assistantFallback },
    })
    return created
  })

  return NextResponse.json({
    ghostQuestion: guarded.text,
    intervention,
    assistantFallback,
    assistantMessage: assistantFallback
      ? 'The research assistant was temporarily unavailable, so Cogdoc used a local question.'
      : undefined,
  })
}
