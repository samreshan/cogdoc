/**
 * POST /api/interceptor
 * Body: { projectId, paragraphId, prompt, context }
 *
 * 1. Classifies the prompt (heuristic first, LLM second).
 * 2. If delegative, generates a Socratic reframing using [The Spark Gap] tag.
 * 3. Persists an Intervention row.
 * 4. Returns the intervention payload (the frontend renders it in the margin).
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId, authed } from '@/lib/auth-supabase'
import { getAIService } from '@/lib/ai-service'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { projectId, paragraphId, prompt, context } = body as {
    projectId: string
    paragraphId?: string
    prompt: string
    context?: string
  }

  if (!projectId || !prompt) {
    return NextResponse.json({ error: 'projectId and prompt are required' }, { status: 400 })
  }

  // authed handles the 401 (no session) → 401 JSON mapping automatically.
  return authed(req, async (userId) => {
    const project = await db.project.findUnique({ where: { id: projectId } })
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    const ai = getAIService()
    const classification = await ai.classifyPrompt(prompt, context ?? '')

    if (!classification.isDelegative) {
      // Non-delegative prompt — pass through silently (no intervention persisted)
      return NextResponse.json({
        action: 'pass',
        isDelegative: false,
        confidence: classification.confidence,
      })
    }

    // Delegative — generate Socratic reframing
    const socratic = await ai.generateSocratic(
      'The Spark Gap',
      context ?? '',
      undefined,
      prompt,
    )

    const intervention = await db.intervention.create({
      data: {
        userId,
        projectId,
        paragraphId: paragraphId ?? null,
        promptTemplateTag: 'The Spark Gap',
        engineType: 'interceptor',
        promptText: prompt,
        responseText: socratic.question,
        status: 'active',
      },
    })

    return NextResponse.json({
      action: 'reframe',
      isDelegative: true,
      confidence: classification.confidence,
      socraticQuestion: socratic.question,
      intervention,
    })
  })
}
