import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/auth-supabase'
import { assertActiveOwnedWorkspace, assertNestedWorkspace, assertOperationAllowed, CollaboratorDomainError } from '@/lib/research-collaborator'
import { contextualHelpKey, createContextualHelp, type ResearchHelpKind } from '@/lib/contextual-research-help'
import { appendAuditEvent } from '@/lib/workspace-server'
import { getAIService } from '@/lib/ai-service'

const kinds = new Set<ResearchHelpKind>(['help', 'hint', 'example', 'alternative', 'next', 'proposal'])
const text = (value: unknown, limit = 12_000) => typeof value === 'string' ? value.trim().slice(0, limit) : ''

function errorResponse(error: unknown) {
  if (error instanceof CollaboratorDomainError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.code === 'forbidden_operation' ? 403 : 400 })
  throw error
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertOperationAllowed('research_help')
    const { id } = await params
    const userId = await requireUserId(req)
    const project = await db.project.findFirst({ where: { id, userId }, select: { id: true, userId: true, archived: true, deletedAt: true } })
    assertActiveOwnedWorkspace(project, userId)
    const context = await db.researchContext.findUnique({ where: { projectId: id } })
    if (!context) return NextResponse.json({ error: 'Start an investigation before asking for contextual help.' }, { status: 400 })
    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const questionId = text(body.questionId, 200) || context.selectedQuestionId || ''
    const question = await db.researchQuestion.findFirst({ where: { id: questionId, projectId: id, contextId: context.id } })
    assertNestedWorkspace(id, question?.projectId)
    if (!question) return NextResponse.json({ error: 'Select a question before asking for contextual help.' }, { status: 400 })
    const kind = kinds.has(body.kind as ResearchHelpKind) ? body.kind as ResearchHelpKind : 'help'
    const explanation = text(body.explanation)
    const passageId = text(body.passageId, 200)
    let passage: { id: string; content: string; sourceTitle: string } | null = null
    if (passageId) {
      const found = await db.pdfChunk.findFirst({ where: { id: passageId, pdf: { projectId: id } }, include: { pdf: true } })
      if (!found) return NextResponse.json({ error: 'The requested passage is not available in this workspace.' }, { status: 404 })
      passage = { id: found.id, content: found.content.slice(0, 8_000), sourceTitle: found.pdf.filename }
    }
    const input = { kind, question: question.wording, explanation, passage }
    const key = contextualHelpKey(input)
    const requested = Boolean(body.requested)
    const previous = !requested ? await db.researchExchange.findFirst({ where: { projectId: id, questionId: question.id, commandKey: key, operation: { in: ['research_help_dismissed', 'research_help_snoozed'] } } }) : null
    if (previous) return NextResponse.json({ suppressed: true, message: 'This concern was dismissed for unchanged context. Ask for help explicitly or change the explanation/evidence to revisit it.' })
    // A user may ask through this endpoint without the panel. Save the exact
    // human wording before any configured-provider call so a failed request
    // cannot discard or replace it.
    if (explanation) {
      const persisted = await db.researchExchange.findFirst({
        where: { projectId: id, questionId: question.id, speaker: 'researcher', origin: 'researcher', body: explanation },
        select: { id: true },
      })
      if (!persisted) {
        await db.researchExchange.create({
          data: { projectId: id, questionId: question.id, speaker: 'researcher', origin: 'researcher', body: explanation, referencedIdsJson: JSON.stringify(passage ? [passage.id] : []) },
        })
      }
    }

    const result = createContextualHelp(input)
    let modelVersion = 'deterministic-contextual-v1'
    let providerStatus: 'configured' | 'deterministic_fallback' = 'deterministic_fallback'
    // The action is passed through unchanged. Provider text is bounded to
    // contextual assistance and cannot create a source link, finding, review,
    // or article operation. A failure is visibly identified as deterministic
    // fallback rather than represented as AI analysis.
    if (explanation) {
      try {
        const ai = await getAIService().provideContextualHelp({ action: kind, question: question.wording, explanation, passage })
        result.body = ai.body
        result.action = ai.action
        if (kind === 'proposal' && ai.proposal) result.proposal = ai.proposal
        result.basis = `${result.basis} Wording supplied by the configured assistant over this bounded context.`
        modelVersion = ai.modelVersion
        providerStatus = 'configured'
      } catch { /* provider availability never blocks manual research */ }
    }
    const exchange = await db.researchExchange.create({ data: { projectId: id, questionId: question.id, speaker: 'assistant', origin: 'assistant_proposal', body: JSON.stringify(result), referencedIdsJson: JSON.stringify(passage ? [passage.id] : []), operation: `research_help:${kind}`, modelVersion, promptVersion: 's5-contextual-v1', commandKey: requested ? null : key } })
    await db.$transaction((tx) => appendAuditEvent(tx, { projectId: id, userId, type: 'contextual_help_requested', actor: 'student', payload: { questionId: question.id, exchangeId: exchange.id, kind, passageId: passage?.id ?? null, requested } }))
    return NextResponse.json({ help: result, exchange, contextKey: key, providerStatus })
  } catch (error) { return errorResponse(error) }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertOperationAllowed('research_help')
    const { id } = await params
    const userId = await requireUserId(req)
    const project = await db.project.findFirst({ where: { id, userId }, select: { id: true, userId: true, archived: true, deletedAt: true } })
    assertActiveOwnedWorkspace(project, userId)
    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const questionId = text(body.questionId, 200)
    const contextKey = text(body.contextKey, 200)
    if (!questionId || !contextKey || !['dismiss', 'snooze'].includes(text(body.action, 20))) return NextResponse.json({ error: 'A question, contextual-help key, and dismiss or snooze action are required.' }, { status: 400 })
    const question = await db.researchQuestion.findFirst({ where: { id: questionId, projectId: id } })
    assertNestedWorkspace(id, question?.projectId)
    if (!question) return NextResponse.json({ error: 'Question not found.' }, { status: 404 })
    const operation = text(body.action, 20) === 'dismiss' ? 'research_help_dismissed' : 'research_help_snoozed'
    const exchange = await db.researchExchange.upsert({ where: { projectId_commandKey: { projectId: id, commandKey: contextKey } }, update: { operation }, create: { projectId: id, questionId, speaker: 'researcher', origin: 'researcher', body: operation === 'research_help_dismissed' ? 'Researcher continued without this contextual prompt.' : 'Researcher saved this contextual prompt for later.', referencedIdsJson: '[]', operation, commandKey: contextKey } })
    await db.$transaction((tx) => appendAuditEvent(tx, { projectId: id, userId, type: operation, actor: 'student', payload: { questionId, contextKey } }))
    return NextResponse.json({ exchange })
  } catch (error) { return errorResponse(error) }
}
