/**
 * POST /api/autocomplete — Devil's Autocomplete (PRODUCT.md §7.1).
 * Body: { projectId, paragraphId?, draft, friction_mode? }
 *
 * Generates a short ghost-text continuation, sanitizes it (≤12 words, single
 * sentence), runs the non-generation guard, and persists an Intervention with
 * engineType='autocomplete'. The suggestion starts as userAction='ignored' and
 * is PATCHed to typed/overruled once the user interacts (client-side).
 *
 * TODO(§12.1): the FastAPI service is the intended owner (POST /api/ai/
 * autocomplete). This lives in the Next.js BFF to match the other engines'
 * current location; the port is deferred until the SSE migration (Phase 3).
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/auth-supabase'
import { getAIService } from '@/lib/ai-service'
import { sanitizeSuggestion, isSuggestionValid } from '@/lib/autocomplete'
import { applyGenerationGuard } from '@/lib/engine-guard'
import type { FrictionMode } from '@/lib/friction'

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
  const project = await db.project.findUnique({ where: { id: projectId } })
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const ai = getAIService()
  const { suggestion: raw } = await ai.generateSuggestion(draft)

  // Sanitize the raw LLM output to a valid ghost phrase (cap + single sentence).
  let suggestion = sanitizeSuggestion(raw)
  if (!isSuggestionValid(suggestion)) {
    // Nothing usable — return empty, persist nothing (no intervention).
    return NextResponse.json({ suggestion: '' })
  }

  // Friction §9: the non-generation guard runs even on autocomplete, so an
  // over-long blob can never slip through. (Sanitize usually prevents this, but
  // the guard is the belt-and-suspenders invariant.)
  const guarded = applyGenerationGuard(suggestion, mode)
  suggestion = guarded.text

  const intervention = await db.intervention.create({
    data: {
      userId,
      projectId,
      paragraphId: paragraphId ?? null,
      promptTemplateTag: null,
      engineType: 'autocomplete',
      promptText: draft.slice(-200),
      responseText: suggestion,
      status: 'active',
      userAction: 'ignored', // updated on the commit-interaction PATCH
    },
  })

  return NextResponse.json({ suggestion, intervention })
}
