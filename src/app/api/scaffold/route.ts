/**
 * POST /api/scaffold
 * Body: { projectId, paragraphId, prompt, context }
 *
 * Generates a structural scaffold (Claim/Evidence/Limitation/Implication outline)
 * using [Structural Scaffold] tag. The scaffold is empty of content — only structure.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getDefaultUser } from '@/lib/auth'
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

  const user = await getDefaultUser()
  const project = await db.project.findUnique({ where: { id: projectId } })
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const ai = getAIService()
  const scaffold = await ai.generateScaffold(prompt, context ?? '')

  const intervention = await db.intervention.create({
    data: {
      userId: user.id,
      projectId,
      paragraphId: paragraphId ?? null,
      promptTemplateTag: 'Structural Scaffold',
      engineType: 'scaffold',
      promptText: prompt,
      responseText: scaffold.scaffold,
      status: 'active',
    },
  })

  return NextResponse.json({
    scaffold: scaffold.scaffold,
    intervention,
  })
}
