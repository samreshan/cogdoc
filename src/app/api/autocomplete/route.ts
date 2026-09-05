/**
 * POST /api/autocomplete — Devil's Autocomplete (PRODUCT.md §7.1).
 * Body: { projectId, paragraphId?, draft, friction_mode? }
 *
 * Compatibility endpoint for the former Devil's Autocomplete. It now returns
 * a non-insertable question cue and always leaves `suggestion` empty.
 *
 * TODO(§12.1): the FastAPI service is the intended owner (POST /api/ai/
 * autocomplete). This lives in the Next.js BFF to match the other engines'
 * current location; the port is deferred until the SSE migration (Phase 3).
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/auth-supabase'
import { getAIService } from '@/lib/ai-service'
import { sanitizeSuggestion } from '@/lib/autocomplete'
import { applyGenerationGuard } from '@/lib/engine-guard'
import type { FrictionMode } from '@/lib/friction'
import { appendAuditEvent } from '@/lib/workspace-server'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { projectId, paragraphId, draft, friction_mode } = body as {
    projectId: string
    paragraphId?: string
    draft: string
    friction_mode?: FrictionMode
  }

  if (!projectId || !draft) {
    return NextResponse.json({ error: 'projectId and draft are required' }, { status: 400 })
  }

  const mode: FrictionMode = friction_mode ?? 'socratic'
  const userId = await requireUserId(req)
  const project = await db.project.findUnique({ where: { id: projectId, userId } })
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const ai = getAIService()
  const { suggestion: raw } = await ai.generateSuggestion(draft)

  const seed = sanitizeSuggestion(raw)
  const cue = seed
    ? `What assumption, evidence, or implication should you examine next around “${seed}”?`
    : 'What assumption, evidence, or implication should you examine next?'
  const guarded = applyGenerationGuard(cue, mode)

  const intervention = await db.$transaction(async (tx) => {
    const created = await tx.intervention.create({
      data: {
        userId,
        projectId,
        paragraphId: paragraphId ?? null,
        promptTemplateTag: null,
        engineType: 'socratic',
        promptText: draft.slice(-200),
        responseText: guarded.text,
        status: 'active',
        userAction: 'ignored', // updated on the commit-interaction PATCH
      },
    })
    await appendAuditEvent(tx, {
      projectId, userId, type: 'intervention_created', actor: 'system',
      modelVersion: process.env.AI_MODEL ?? process.env.GEMINI_MODEL ?? null, promptVersion: 'devils-autocomplete-v2',
      payload: { summary: 'Cogdoc raised a writing question', interventionId: created.id, engineType: 'socratic', paragraphId: paragraphId ?? null },
    })
    return created
  })

  return NextResponse.json({ suggestion: '', cue: guarded.text, insertable: false, intervention })
}
