import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/auth-supabase'
import { getAIService, publicAIConfiguration, type DocumentCollaboratorAIResponse } from '@/lib/ai-service'
import {
  assertActiveOwnedWorkspace,
  assertOperationAllowed,
  CollaboratorDomainError,
} from '@/lib/research-collaborator'
import { appendAuditEvent } from '@/lib/workspace-server'
import { sha256 } from '@/lib/crypto'
import {
  selectionIsSelfConsistent,
  type CollaboratorIntent,
  type CollaboratorProviderStatus,
  type CollaboratorTurn,
  type DockProposal,
  type DockSourceContext,
  type DocumentCollaboratorContext,
} from '@/lib/document-collaborator-contract'

export const runtime = 'nodejs'
export const maxDuration = 45

const intents = new Set<CollaboratorIntent>(['ask', 'explain', 'find_evidence', 'challenge', 'plan', 'revise_selection', 'draft_finding'])
const text = (value: unknown, limit: number) => typeof value === 'string' ? value.trim().slice(0, limit) : ''

interface StoredAssistantEnvelope {
  content: string
  intent: CollaboratorIntent
  providerStatus: CollaboratorProviderStatus
  nextStep: string | null
  hypothetical: boolean
  context: CollaboratorTurn['context']
  proposal?: DockProposal
}

function routeError(error: unknown) {
  if (error instanceof CollaboratorDomainError) {
    const status = error.code === 'forbidden_operation' ? 403 : error.code === 'archived_workspace' ? 409 : 400
    return NextResponse.json({ error: error.message, code: error.code }, { status })
  }
  throw error
}

function readEnvelope(body: string): StoredAssistantEnvelope | null {
  try {
    const value = JSON.parse(body) as Partial<StoredAssistantEnvelope>
    if (!value || typeof value.content !== 'string') return null
    return {
      content: value.content,
      intent: intents.has(value.intent as CollaboratorIntent) ? value.intent as CollaboratorIntent : 'ask',
      providerStatus: value.providerStatus === 'configured' || value.providerStatus === 'deterministic_fallback' ? value.providerStatus : 'unavailable',
      nextStep: typeof value.nextStep === 'string' ? value.nextStep : null,
      hypothetical: Boolean(value.hypothetical),
      context: {
        questionId: text(value.context?.questionId, 200) || undefined,
        selectionId: text(value.context?.selectionId, 500) || undefined,
        sourceIds: Array.isArray(value.context?.sourceIds) ? value.context.sourceIds.filter((item): item is string => typeof item === 'string').slice(0, 20) : [],
      },
      proposal: value.proposal,
    }
  } catch { return null }
}

function toTurn(exchange: {
  id: string
  speaker: string
  body: string
  operation: string | null
  modelVersion: string | null
  referencedIdsJson: string
  questionId: string | null
  findingRevisionId?: string | null
  createdAt: Date
}): CollaboratorTurn {
  const envelope = exchange.speaker === 'assistant' ? readEnvelope(exchange.body) : null
  let references: string[] = []
  try { references = JSON.parse(exchange.referencedIdsJson) as string[] } catch { /* empty legacy references */ }
  const background = /^background_engine:(pending|answered|superseded):([^:]+)$/.exec(exchange.operation ?? '')
  return {
    id: exchange.id,
    role: exchange.speaker === 'assistant' ? 'assistant' : 'researcher',
    content: envelope?.content ?? exchange.body,
    createdAt: exchange.createdAt.toISOString(),
    intent: envelope?.intent ?? (exchange.operation?.split(':')[2] as CollaboratorIntent | undefined),
    providerStatus: envelope?.providerStatus,
    modelVersion: exchange.modelVersion,
    context: envelope?.context ?? {
      questionId: exchange.questionId ?? undefined,
      sourceIds: references.filter((item) => !item.startsWith('selection:')),
      selectionId: references.find((item) => item.startsWith('selection:'))?.slice('selection:'.length),
    },
    proposal: envelope?.proposal,
    nextStep: envelope?.nextStep,
    hypothetical: envelope?.hypothetical,
    enginePrompt: background ? {
      status: background[1] as 'pending' | 'answered' | 'superseded',
      engine: background[2] as 'interceptor' | 'socratic' | 'citation' | 'scaffold',
      findingRevisionId: exchange.findingRevisionId ?? undefined,
    } : undefined,
  }
}

function fallbackResponse(intent: CollaboratorIntent, hasSelection: boolean): DocumentCollaboratorAIResponse {
  const content: Record<CollaboratorIntent, { answer: string; nextStep: string }> = {
    ask: { answer: 'The configured collaborator is unavailable. Your request is saved, but Cogdoc cannot answer it reliably without the provider.', nextStep: 'Retry, or continue writing and attach a passage for a later check.' },
    explain: { answer: 'The configured collaborator is unavailable, so Cogdoc cannot provide a trustworthy explanation right now. Your question and selected context are saved.', nextStep: 'Retry, or write the part that is unclear in your own words.' },
    find_evidence: { answer: 'The configured collaborator is unavailable. Cogdoc has not searched for or inspected any additional evidence.', nextStep: 'Open Sources to search by the active question or import material you already have.' },
    challenge: { answer: 'The configured collaborator is unavailable, so no new critique was generated. Your request remains in the conversation.', nextStep: 'Record one alternative explanation or limitation, then retry.' },
    plan: { answer: 'The configured collaborator is unavailable, so no question plan was generated.', nextStep: 'Open Plan to add an editable question manually.' },
    revise_selection: { answer: hasSelection ? 'The configured collaborator is unavailable. The selected passage was not changed and no revision was proposed.' : 'Select a passage before requesting a targeted revision.', nextStep: 'Keep editing in the document or retry when the provider is available.' },
    draft_finding: { answer: 'The configured collaborator is unavailable, so no finding draft was generated or reviewed.', nextStep: 'Open Findings to record your conclusion and uncertainty manually.' },
  }
  return { ...content[intent], hypothetical: false, modelVersion: 'provider-unavailable' }
}

function metadataValue(metadataJson: string, key: string): string {
  try {
    const value = (JSON.parse(metadataJson) as Record<string, unknown>)[key]
    return typeof value === 'string' ? value : ''
  } catch { return '' }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertOperationAllowed('research_help')
    const { id } = await params
    const userId = await requireUserId(req)
    const project = await db.project.findFirst({ where: { id, userId }, select: { id: true, userId: true, archived: true, deletedAt: true } })
    assertActiveOwnedWorkspace(project, userId)
    const exchanges = await db.researchExchange.findMany({
      where: { projectId: id, OR: [{ operation: { startsWith: 'document_collaborator:' } }, { operation: { startsWith: 'background_engine:' } }] },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 120,
    })
    return NextResponse.json({ turns: exchanges.map(toTurn), assistant: publicAIConfiguration() })
  } catch (error) { return routeError(error) }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertOperationAllowed('research_help')
    const { id } = await params
    const userId = await requireUserId(req)
    const project = await db.project.findFirst({
      where: { id, userId },
      select: { id: true, userId: true, title: true, description: true, archived: true, deletedAt: true, researchContext: true },
    })
    assertActiveOwnedWorkspace(project, userId)
    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const message = text(body.message, 8_000)
    const intent = intents.has(body.intent as CollaboratorIntent) ? body.intent as CollaboratorIntent : 'ask'
    const requestId = text(body.requestId, 200)
    if (!message) return NextResponse.json({ error: 'Write a request for the collaborator.' }, { status: 400 })
    const answerToEnginePromptId = text(body.answerToEnginePromptId, 200)
    if (answerToEnginePromptId) {
      const prompt = await db.researchExchange.findFirst({
        where: { id: answerToEnginePromptId, projectId: id, operation: { startsWith: 'background_engine:pending:' } },
      })
      if (!prompt) return NextResponse.json({ error: 'This engine question was answered or superseded. Refresh the conversation.', code: 'stale_engine_prompt' }, { status: 409 })
      const engine = prompt.operation?.split(':')[2] || 'socratic'
      const uncertain = /\b(i(?:'| a)?m not sure|not sure|unsure|help me investigate|do not know|don't know)\b/i.test(message)
      const contextSnapshot: CollaboratorTurn['context'] = { questionId: prompt.questionId ?? undefined, sourceIds: [] }
      const result = await db.$transaction(async (tx) => {
        const researcher = await tx.researchExchange.create({ data: {
          projectId: id, questionId: prompt.questionId, findingRevisionId: prompt.findingRevisionId,
          speaker: 'researcher', origin: 'researcher', body: message, referencedIdsJson: JSON.stringify([prompt.id]),
          operation: 'background_engine:answer', commandKey: requestId ? `background-engine-answer:${requestId}` : null,
        } })
        await tx.researchExchange.update({ where: { id: prompt.id }, data: { operation: `background_engine:answered:${engine}` } })
        const envelope: StoredAssistantEnvelope = {
          content: uncertain
            ? 'Uncertainty recorded. You can keep investigating or explicitly retain this uncertainty when you review the finding; it is not treated as evidence.'
            : 'Your response is recorded against this exact engine question and revision. Review the finding separately when you are ready.',
          intent: 'challenge', providerStatus: 'deterministic_fallback', hypothetical: false, context: contextSnapshot,
          nextStep: uncertain ? 'Open Findings and choose retain uncertainty if that accurately reflects your judgement.' : 'Open Findings to make the separate review decision.',
        }
        const assistant = await tx.researchExchange.create({ data: {
          projectId: id, questionId: prompt.questionId, findingRevisionId: prompt.findingRevisionId,
          speaker: 'assistant', origin: 'assistant', body: JSON.stringify(envelope), referencedIdsJson: JSON.stringify([prompt.id, researcher.id]),
          operation: 'document_collaborator:assistant:challenge', modelVersion: 'deterministic-background-v1', promptVersion: `background-${engine}-answer-v1`,
          commandKey: requestId ? `background-engine-answer:${requestId}:assistant` : null,
        } })
        await appendAuditEvent(tx, { projectId: id, userId, type: 'background_engine_answered', actor: 'student', payload: { promptId: prompt.id, answerId: researcher.id, engine, findingRevisionId: prompt.findingRevisionId, uncertaintyRecorded: uncertain } })
        return { researcher, assistant }
      })
      return NextResponse.json({ researcherTurn: toTurn(result.researcher), assistantTurn: toTurn(result.assistant), assistant: publicAIConfiguration() })
    }
    const contextInput = body.context && typeof body.context === 'object' ? body.context as Partial<DocumentCollaboratorContext> : {}
    const selection = contextInput.selection ?? null
    if (selection && (selection.projectId !== id || !selectionIsSelfConsistent(selection) || selection.textFingerprint !== sha256(selection.exactText))) {
      return NextResponse.json({ error: 'The selected document passage is stale or invalid.', code: 'stale_selection' }, { status: 409 })
    }
    const questionId = text(contextInput.activeQuestion?.id, 200) || null
    const question = questionId ? await db.researchQuestion.findFirst({ where: { id: questionId, projectId: id } }) : null
    if (questionId && !question) return NextResponse.json({ error: 'The active question is not available in this project.' }, { status: 404 })

    const requestedSources = Array.isArray(contextInput.sources) ? contextInput.sources.slice(0, 8) : []
    const sourceIds = [...new Set(requestedSources.map((source) => text(source.workspaceSourceId, 200)).filter(Boolean))]
    const sourceRows = sourceIds.length ? await db.workspaceSource.findMany({
      where: { id: { in: sourceIds }, projectId: id }, include: { source: true },
    }) : []
    if (sourceRows.length !== sourceIds.length) return NextResponse.json({ error: 'One or more chosen sources are not available in this project.' }, { status: 404 })
    const sourceById = new Map(sourceRows.map((source) => [source.id, source]))
    const resolvedSources: DockSourceContext[] = []
    for (const requested of requestedSources) {
      const source = sourceById.get(requested.workspaceSourceId)
      if (!source) continue
      let passage: { id: string; content: string; pageApprox: number } | null = null
      if (requested.passageId) {
        passage = await db.pdfChunk.findFirst({
          where: { id: requested.passageId, pdf: { projectId: id, librarySourceId: source.librarySourceId } },
          select: { id: true, content: true, pageApprox: true },
        })
        if (!passage) return NextResponse.json({ error: `The chosen passage for ${source.source.title} is not available.` }, { status: 404 })
      }
      const manualExcerpt = source.source.parseStatus === 'manual_excerpt' ? metadataValue(source.source.metadataJson, 'manualExcerpt') : ''
      const abstract = metadataValue(source.source.metadataJson, 'abstract')
      const transcript = source.source.parseStatus === 'transcript_ready' ? metadataValue(source.source.metadataJson, 'transcript') : ''
      const accessBasis = passage ? 'extracted_text' : manualExcerpt ? 'manual_excerpt' : transcript ? 'transcript' : abstract ? 'abstract' : 'metadata'
      resolvedSources.push({
        workspaceSourceId: source.id,
        passageId: passage?.id,
        title: source.source.title,
        excerpt: passage?.content.slice(0, 5_000) || manualExcerpt.slice(0, 5_000) || transcript.slice(0, 5_000) || abstract.slice(0, 5_000) || undefined,
        locator: passage ? `Approximate page ${passage.pageApprox}` : requested.locator,
        accessBasis,
      })
    }
    const contextSnapshot: CollaboratorTurn['context'] = {
      questionId: question?.id,
      selectionId: selection?.selectionId,
      sourceIds: resolvedSources.map((source) => source.workspaceSourceId),
    }
    const references = [...contextSnapshot.sourceIds, ...(selection ? [`selection:${selection.selectionId}`] : [])]
    const human = await db.$transaction(async (tx) => {
      const existing = requestId ? await tx.researchExchange.findFirst({ where: { projectId: id, commandKey: `document-collaborator:${requestId}:researcher` } }) : null
      if (existing) return existing
      const created = await tx.researchExchange.create({ data: {
        projectId: id, questionId: question?.id ?? null, speaker: 'researcher', origin: 'researcher', body: message,
        referencedIdsJson: JSON.stringify(references), operation: `document_collaborator:researcher:${intent}`,
        commandKey: requestId ? `document-collaborator:${requestId}:researcher` : null,
      } })
      await appendAuditEvent(tx, { projectId: id, userId, type: 'document_collaborator_requested', actor: 'student', payload: { exchangeId: created.id, intent, questionId: question?.id ?? null, selectionId: selection?.selectionId ?? null, sourceIds: contextSnapshot.sourceIds } })
      return created
    })
    const recent = await db.researchExchange.findMany({
      where: { projectId: id, operation: { startsWith: 'document_collaborator:' }, id: { not: human.id } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 20,
    })
    const history = recent.reverse().map(toTurn).map((turn) => ({ role: turn.role, content: turn.content }))
    let providerStatus: CollaboratorProviderStatus = 'configured'
    let result: DocumentCollaboratorAIResponse
    try {
      result = await getAIService().collaborateOnDocument({
        message, intent, projectTitle: project.title, topic: project.researchContext?.topic || project.description || project.title,
        question: question?.wording, selection, sources: resolvedSources, history,
      })
    } catch {
      providerStatus = 'unavailable'
      result = fallbackResponse(intent, Boolean(selection))
    }
    const proposalId = `proposal:${sha256(`${human.id}:${intent}:${result.answer}`).slice(0, 20)}`
    const proposal: DockProposal | undefined = result.proposal?.kind === 'document_revision' && selection
      ? { ...result.proposal, id: proposalId, selection, model: result.modelVersion }
      : result.proposal?.kind === 'finding_draft'
        ? { ...result.proposal, id: proposalId }
        : result.proposal?.kind === 'plan'
          ? { ...result.proposal, id: proposalId }
          : undefined
    const envelope: StoredAssistantEnvelope = { content: result.answer, intent, providerStatus, nextStep: result.nextStep, hypothetical: result.hypothetical, context: contextSnapshot, proposal }
    const assistant = await db.$transaction(async (tx) => {
      const existing = requestId ? await tx.researchExchange.findFirst({ where: { projectId: id, commandKey: `document-collaborator:${requestId}:assistant` } }) : null
      if (existing) return existing
      const created = await tx.researchExchange.create({ data: {
        projectId: id, questionId: question?.id ?? null, speaker: 'assistant', origin: proposal ? 'assistant_proposal' : 'assistant',
        body: JSON.stringify(envelope), referencedIdsJson: JSON.stringify(references), operation: `document_collaborator:assistant:${intent}`,
        modelVersion: result.modelVersion, promptVersion: 'document-collaborator-v1',
        commandKey: requestId ? `document-collaborator:${requestId}:assistant` : null,
      } })
      await appendAuditEvent(tx, { projectId: id, userId, type: 'document_collaborator_responded', actor: 'system', payload: { exchangeId: created.id, requestExchangeId: human.id, intent, providerStatus, proposalKind: proposal?.kind ?? null } })
      return created
    })
    return NextResponse.json({ researcherTurn: toTurn(human), assistantTurn: toTurn(assistant), assistant: publicAIConfiguration() })
  } catch (error) { return routeError(error) }
}
