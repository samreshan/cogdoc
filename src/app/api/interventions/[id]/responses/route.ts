import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/auth-supabase'
import { getAIService } from '@/lib/ai-service'
import { evaluateInterventionAnswerLocally, structuredResolutionLines } from '@/lib/intervention-response'
import { plainResearchQuestion } from '@/lib/intervention-language'
import { appendAuditEvent } from '@/lib/workspace-server'
import { collaboratorExposure } from '@/lib/research-collaborator'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId(req)
  const { id } = await params
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const answer = typeof body.answer === 'string' ? body.answer.trim().slice(0, 10_000) : ''
  if (answer.length < 5) return NextResponse.json({ error: 'Write a substantive answer before asking Cogdoc to evaluate it.' }, { status: 400 })

  const intervention = await db.intervention.findFirst({
    where: { id, userId, status: 'active', project: { deletedAt: null } },
    include: {
      evidences: {
        include: { chunk: { select: { id: true, content: true, pageApprox: true, pdf: { select: { filename: true } } } } },
      },
    },
  })
  if (!intervention) return NextResponse.json({ error: 'Active intervention not found' }, { status: 404 })

  const evaluationInput = {
    engineType: intervention.engineType as 'interceptor' | 'socratic' | 'citation' | 'scaffold',
    passage: intervention.promptText ?? '',
    intervention: plainResearchQuestion(intervention.responseText, intervention.engineType as 'interceptor' | 'socratic' | 'citation' | 'scaffold', intervention.promptText ?? intervention.id),
    answer,
    evidence: intervention.evidences.map((item) => ({ chunkId: item.chunk.id, content: item.chunk.content })),
  }
  let evaluator: 'ai' | 'local' = 'ai'
  let evaluation
  try {
    evaluation = await getAIService().evaluateInterventionAnswer(evaluationInput)
  } catch {
    evaluator = 'local'
    evaluation = evaluateInterventionAnswerLocally({ answer, engineType: evaluationInput.engineType })
  }

  if (!evaluation.satisfied) {
    const followUp = plainResearchQuestion(evaluation.followUpQuestion, evaluationInput.engineType, evaluationInput.passage)
    const updated = await db.$transaction(async (tx) => {
      const saved = await tx.intervention.update({
        where: { id: intervention.id },
        data: { responseText: followUp, userAction: 'engaged', status: 'active', resolvedAt: null },
        include: {
          evidences: {
            select: { id: true, similarityScore: true, citedExcerpt: true, chunk: { select: { pageApprox: true, pdf: { select: { filename: true } } } } },
          },
        },
      })
      await appendAuditEvent(tx, {
        projectId: intervention.projectId,
        userId,
        type: 'intervention_answer_followup',
        actor: 'student',
        payload: { summary: 'Answered an intervention; Cogdoc asked a follow-up', interventionId: intervention.id, answer, evaluation, evaluator },
      })
      return saved
    })
    return NextResponse.json({ satisfied: false, evaluation, evaluator, intervention: updated, note: null, structuredLines: [], revisionProposal: null })
  }

  const structuredLines = structuredResolutionLines({
    claim: intervention.promptText ?? 'Highlighted passage',
    answer,
    rationale: evaluation.rationale,
    evidence: intervention.evidences.map((item) => ({
      filename: item.chunk.pdf.filename,
      pageApprox: item.chunk.pageApprox,
      excerpt: item.citedExcerpt,
    })),
  })
  const result = await db.$transaction(async (tx) => {
    const updated = await tx.intervention.update({
      where: { id: intervention.id },
      data: { userAction: 'engaged', status: 'resolved', resolvedAt: new Date() },
      include: {
        evidences: {
          select: { id: true, similarityScore: true, citedExcerpt: true, chunk: { select: { pageApprox: true, pdf: { select: { filename: true } } } } },
        },
      },
    })
    await tx.intervention.updateMany({
      where: {
        id: { not: intervention.id },
        userId,
        projectId: intervention.projectId,
        status: 'active',
        promptText: intervention.promptText,
      },
      data: { status: 'resolved', userAction: 'engaged', resolvedAt: new Date() },
    })
    const note = await tx.researchNote.create({ data: {
      projectId: intervention.projectId,
      passageId: intervention.evidences[0]?.chunk.id ?? null,
      kind: 'intervention_resolution',
      title: `Resolved ${intervention.engineType} intervention`,
      body: structuredLines.map((line) => `${line.label}:\n${line.value}`).join('\n\n'),
      exactExcerpt: intervention.evidences[0]?.citedExcerpt ?? null,
      sourceAnchorJson: intervention.evidences[0] ? JSON.stringify({ passageId: intervention.evidences[0].chunk.id, page: intervention.evidences[0].chunk.pageApprox }) : null,
      documentAnchorJson: JSON.stringify({ quote: intervention.promptText, interventionId: intervention.id, exact: true }),
    } })
    await appendAuditEvent(tx, {
      projectId: intervention.projectId,
      userId,
      type: 'intervention_answer_satisfied',
      actor: 'student',
      payload: { summary: 'Resolved an intervention with an answer', interventionId: intervention.id, answer, evaluation, evaluator, noteId: note.id },
    })
    return { updated, note }
  })

  let revisionProposal: string | null = null
  if (collaboratorExposure() === 'legacy') {
    try {
      revisionProposal = await getAIService().restructureFromIntervention({
        passage: intervention.promptText ?? '',
        intervention: intervention.responseText ?? '',
        answer,
        rationale: evaluation.rationale,
      })
    } catch (error) {
      console.warn('[intervention-response] restructuring unavailable:', (error as Error).message.slice(0, 160))
    }
  }

  return NextResponse.json({ satisfied: true, evaluation, evaluator, intervention: result.updated, note: result.note, structuredLines, revisionProposal })
}
