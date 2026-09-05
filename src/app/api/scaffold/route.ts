/**
 * POST /api/scaffold
 * Body: { projectId, paragraphId, prompt, context }
 *
 * Generates a structural scaffold (Claim/Evidence/Limitation/Implication outline)
 * using [Structural Scaffold] tag. The scaffold is empty of content — only structure.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/auth-supabase'
import { getAIService } from '@/lib/ai-service'
import { applyGenerationGuard } from '@/lib/engine-guard'
import { plainResearchQuestion } from '@/lib/intervention-language'
import { appendAuditEvent } from '@/lib/workspace-server'
import type { FrictionMode } from '@/lib/friction'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { projectId, paragraphId, prompt, context, friction_mode } = body as {
    projectId: string
    paragraphId?: string
    prompt: string
    context?: string
    friction_mode?: FrictionMode
  }

  if (!projectId || !prompt) {
    return NextResponse.json({ error: 'projectId and prompt are required' }, { status: 400 })
  }

  const mode: FrictionMode = friction_mode ?? 'socratic'
  const userId = await requireUserId(req)
  const project = await db.project.findUnique({ where: { id: projectId, userId } })
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const ai = getAIService()
  const scaffold = await ai.generateScaffold(prompt, context ?? '')

  // Friction §9: enforce the non-generation invariant before persisting.
  const guarded = applyGenerationGuard(scaffold.scaffold, mode)

  const intervention = await db.$transaction(async (tx) => {
    const created = await tx.intervention.create({
      data: {
        userId,
        projectId,
        paragraphId: paragraphId ?? null,
        promptTemplateTag: 'Structural Scaffold',
        engineType: 'scaffold',
        promptText: prompt,
        responseText: plainResearchQuestion(guarded.text, 'scaffold', context ?? prompt),
        status: 'active',
      },
    })
    await appendAuditEvent(tx, {
      projectId, userId, type: 'intervention_created', actor: 'system',
      modelVersion: process.env.AI_MODEL ?? process.env.GEMINI_MODEL ?? null, promptVersion: 'Structural Scaffold',
      payload: { summary: 'Cogdoc raised a structure question', interventionId: created.id, engineType: 'scaffold', paragraphId: paragraphId ?? null },
    })
    return created
  })

  return NextResponse.json({
    scaffold: guarded.text,
    intervention,
  })
}
