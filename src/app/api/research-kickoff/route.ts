import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/auth-supabase'
import { getAIService } from '@/lib/ai-service'
import type { ResearchKickoffOutlineItem, ResearchKickoffPlan } from '@/lib/types'
import { appendAuditEvent } from '@/lib/workspace-server'
import { collaboratorExposure } from '@/lib/research-collaborator'

export const runtime = 'nodejs'
export const maxDuration = 45

export function fallbackResearchKickoffPlan(topic: string): ResearchKickoffPlan {
  const focus = topic.trim().replace(/[?.!]+$/, '')
  return {
    title: focus.slice(0, 120),
    description: `A clear research path for ${focus}.`,
    outline: [
      { heading: 'What this research asks', purpose: 'Explain the main question and why it matters.' },
      { heading: 'What we know so far', purpose: 'Bring together the most useful evidence.' },
      { heading: 'Other ways to see it', purpose: 'Compare different views and possible limits.' },
      { heading: 'What the evidence may mean', purpose: 'Explain the careful conclusion the evidence allows.' },
      { heading: 'What is still open', purpose: 'Show what remains uncertain or needs more research.' },
    ],
    questions: [
      { id: 'q1', question: 'What do you want to understand?', why: 'This gives the research a clear direction.' },
      { id: 'q2', question: 'What do you think is happening?', why: 'This gives us a useful starting point.' },
      { id: 'q3', question: 'What else might be true?', why: 'This keeps another view in the outline.' },
    ],
  }
}

export async function POST(req: NextRequest) {
  const userId = await requireUserId(req)
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const action = String(body.action ?? '')

  if (action === 'plan') {
    const topic = String(body.topic ?? '').trim().slice(0, 2_000)
    const conversation = Array.isArray(body.conversation) ? body.conversation.flatMap((item) => {
      if (!item || typeof item !== 'object') return []
      const row = item as Record<string, unknown>
      const question = String(row.question ?? '').trim().slice(0, 300)
      const answer = String(row.answer ?? '').trim().slice(0, 3_000)
      return question && answer ? [{ question, answer }] : []
    }).slice(0, 5) : []
    if (topic.split(/\s+/).filter(Boolean).length < 4) {
      return NextResponse.json({ error: 'Describe the research topic in at least four words.' }, { status: 400 })
    }
    try {
      return NextResponse.json({ plan: await getAIService().planResearchKickoff(topic, conversation), assistantFallback: false })
    } catch (error) {
      console.warn('[research-kickoff] assistant planning unavailable; using research template:', (error as Error).message.slice(0, 200))
      return NextResponse.json({ plan: fallbackResearchKickoffPlan(topic), assistantFallback: true })
    }
  }

  if (action === 'draft') {
    if (collaboratorExposure() !== 'legacy') {
      return NextResponse.json({
        error: 'Article drafting becomes available after reviewed findings are selected.',
        code: 'forbidden_operation',
      }, { status: 409 })
    }
    const projectId = String(body.projectId ?? '')
    const topic = String(body.topic ?? '').trim().slice(0, 2_000)
    const outline = Array.isArray(body.outline) ? body.outline.flatMap((item) => {
      if (!item || typeof item !== 'object') return []
      const row = item as Record<string, unknown>
      const heading = String(row.heading ?? '').trim().slice(0, 160)
      const purpose = String(row.purpose ?? '').trim().slice(0, 500)
      return heading && purpose ? [{ heading, purpose }] : []
    }).slice(0, 8) : []
    const responses = Array.isArray(body.responses) ? body.responses.flatMap((item) => {
      if (!item || typeof item !== 'object') return []
      const row = item as Record<string, unknown>
      const question = String(row.question ?? '').trim().slice(0, 500)
      const answer = String(row.answer ?? '').trim().slice(0, 5_000)
      return question && answer.split(/\s+/).filter(Boolean).length >= 8 ? [{ question, answer }] : []
    }).slice(0, 5) : []
    if (!projectId || !topic || outline.length < 3 || responses.length < 3) {
      return NextResponse.json({ error: 'Complete the outline and preliminary questions before drafting.' }, { status: 422 })
    }
    const project = await db.project.findFirst({ where: { id: projectId, userId, archived: false, deletedAt: null }, select: { id: true } })
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    const draft = await getAIService().draftResearchKickoff({ topic, outline: outline as ResearchKickoffOutlineItem[], responses })
    await db.$transaction((tx) => appendAuditEvent(tx, {
        projectId,
        userId,
        type: 'research_draft_requested',
        actor: 'student',
        payload: {
          summary: 'Completed the preliminary conversation and requested a working research draft',
          outlineHeadings: outline.map((item) => item.heading),
          responseCount: responses.length,
          sourceNeeds: draft.sourceNeeds.length,
        },
      }))
    return NextResponse.json({ draft })
  }

  return NextResponse.json({ error: 'action must be plan or draft' }, { status: 400 })
}
