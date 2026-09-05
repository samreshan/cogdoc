import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/auth-supabase'
import { getAIService } from '@/lib/ai-service'
import { documentToPlainText } from '@/lib/document-content'
import type { ResearchDialogueAnswers } from '@/lib/types'
import { appendAuditEvent } from '@/lib/workspace-server'

export const runtime = 'nodejs'
export const maxDuration = 45

const QUESTIONS: Record<keyof ResearchDialogueAnswers, string> = {
  focus: 'What are you trying to say?',
  evidence: 'What makes you think that?',
  tension: 'What else could be true?',
  contribution: 'What should the reader remember?',
}

const MINIMUM_WORDS: Record<keyof ResearchDialogueAnswers, number> = {
  focus: 4,
  evidence: 4,
  tension: 4,
  contribution: 4,
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as {
    projectId?: string
    answers?: Partial<ResearchDialogueAnswers>
  }
  if (!body.projectId || !body.answers) {
    return NextResponse.json({ error: 'projectId and answers are required' }, { status: 400 })
  }

  const answers = {} as ResearchDialogueAnswers
  for (const field of Object.keys(QUESTIONS) as Array<keyof ResearchDialogueAnswers>) {
    const value = String(body.answers[field] ?? '').trim()
    const wordCount = value.split(/\s+/).filter(Boolean).length
    if (wordCount < MINIMUM_WORDS[field]) {
      return NextResponse.json({
        error: 'Explain this idea a little further before Cogdoc drafts from it.',
        field,
        question: QUESTIONS[field],
        minimumWords: MINIMUM_WORDS[field],
      }, { status: 422 })
    }
    answers[field] = value.slice(0, 4_000)
  }

  const userId = await requireUserId(req)
  const project = await db.project.findFirst({
    where: { id: body.projectId, userId, archived: false, deletedAt: null },
    include: { document: true },
  })
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const result = await getAIService().draftFromResearchDialogue(
    answers,
    documentToPlainText(project.document?.content).slice(-6_000),
  )
  await db.$transaction((tx) => appendAuditEvent(tx, { projectId: project.id, userId, type: 'research_draft_requested', actor: 'student', payload: { summary: 'Requested a working draft from the completed research conversation', sourceNeeds: result.sourceNeeds.length } }))
  return NextResponse.json(result)
}
