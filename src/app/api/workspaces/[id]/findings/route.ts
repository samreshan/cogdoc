import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/auth-supabase'
import {
  assertActiveOwnedWorkspace,
  assertNestedWorkspace,
  assertOperationAllowed,
  CollaboratorDomainError,
  findingRevisionHash,
  operationAllowed,
} from '@/lib/research-collaborator'
import { sha256 } from '@/lib/crypto'
import { appendAuditEvent } from '@/lib/workspace-server'
import { canonicalizeSourceUrl, normalizeDoi } from '@/lib/research-source'
import { enqueueBackgroundEnginePrompt } from '@/lib/research-jobs'

export const runtime = 'nodejs'

function text(value: unknown, max = 8_000) { return typeof value === 'string' ? value.trim().slice(0, max) : '' }

function discoveredMetadata(body: Record<string, unknown>, kind: 'discovery' | 'video') {
  const provider = text(body.recordProvider, 80)
  const availability = text(body.accessState, 80)
  const rationaleBasis = text(body.rationaleBasis, 160)
  const metadata = typeof body.metadata === 'object' && body.metadata ? body.metadata as Record<string, unknown> : {}
  return {
    ...metadata,
    provenance: kind === 'video' ? 'researcher_supplied_video' : 'discovery_record',
    recordProvider: ['openalex', 'crossref', 'semantic_scholar', 'gemini'].includes(provider) ? provider : 'researcher',
    accessState: availability || (kind === 'video' ? 'transcript_unavailable' : 'metadata_only'),
    rationaleBasis: rationaleBasis || 'metadata',
    inspectedContent: false,
  }
}

function validTimestampRange(value: unknown): string | null {
  const range = text(value, 80)
  if (!range) return null
  const match = /^(\d{1,2}:)?\d{1,2}:\d{2}\s*(?:-|–|to)\s*(\d{1,2}:)?\d{1,2}:\d{2}$/.exec(range)
  if (!match) return null
  const toSeconds = (part: string) => part.split(':').map(Number).reduce((total, unit) => total * 60 + unit, 0)
  const pieces = range.split(/\s*(?:-|–|to)\s*/)
  return pieces.length === 2 && toSeconds(pieces[1]) > toSeconds(pieces[0]) ? range : null
}

function routeError(error: unknown) {
  if (error instanceof CollaboratorDomainError) {
    const status = error.code === 'forbidden_operation' ? 403 : error.code === 'stale_revision' || error.code === 'archived_workspace' ? 409 : 400
    return NextResponse.json({ error: error.message, code: error.code }, { status })
  }
  throw error
}

async function workspace(req: NextRequest, projectId: string) {
  const userId = await requireUserId(req)
  const project = await db.project.findFirst({ where: { id: projectId, userId }, select: { id: true, userId: true, archived: true, deletedAt: true } })
  assertActiveOwnedWorkspace(project, userId)
  const context = await db.researchContext.findUnique({ where: { projectId } })
  if (!context) throw new CollaboratorDomainError('Start an investigation before saving research work.', 'invalid_state')
  return { userId, project, context }
}

async function questionFor(projectId: string, contextId: string, questionId: unknown) {
  const id = typeof questionId === 'string' ? questionId : ''
  const question = await db.researchQuestion.findFirst({ where: { id, projectId, contextId } })
  assertNestedWorkspace(projectId, question?.projectId)
  return question
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertOperationAllowed('finding_analysis')
    const { id } = await params
    const { context } = await workspace(req, id)
    const selectedQuestion = context.selectedQuestionId
      ? await db.researchQuestion.findFirst({ where: { id: context.selectedQuestionId, projectId: id, contextId: context.id } })
      : null
    const allQuestions = req.nextUrl.searchParams.get('scope') === 'all'
    const questionId = selectedQuestion?.id
    const workspaceSources = await db.workspaceSource.findMany({ where: { projectId: id }, include: { source: true }, orderBy: { updatedAt: 'desc' } })
    const [resources, exchanges, findings] = questionId && !allQuestions ? await Promise.all([
      db.questionResource.findMany({ where: { projectId: id, questionId }, include: { workspaceSource: { include: { source: true } } }, orderBy: { createdAt: 'asc' } }),
      db.researchExchange.findMany({ where: { projectId: id, questionId, speaker: 'researcher' }, orderBy: { createdAt: 'desc' }, take: 20 }),
      db.researchFinding.findMany({
        where: { projectId: id, questionId },
        include: {
          question: { select: { id: true, wording: true } },
          revisions: {
            orderBy: { revision: 'desc' },
            take: 1,
            include: {
              evidences: { include: { workspaceSource: { include: { source: true } } } },
              reviews: { orderBy: { createdAt: 'desc' }, take: 1, select: { decision: true, createdAt: true } },
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
      }),
    ]) : allQuestions ? [[], [], await db.researchFinding.findMany({
      where: { projectId: id },
      include: {
        question: { select: { id: true, wording: true } },
        revisions: {
          orderBy: { revision: 'desc' }, take: 1,
          include: {
            evidences: { include: { workspaceSource: { include: { source: true } } } },
            reviews: { orderBy: { createdAt: 'desc' }, take: 1, select: { decision: true, createdAt: true } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })] : [[], [], []]
    return NextResponse.json({ context, question: selectedQuestion, workspaceSources, resources, exchanges, findings, scope: allQuestions ? 'all' : 'selected', articleEnabled: operationAllowed('article_outline') })
  } catch (error) {
    return routeError(error)
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertOperationAllowed('finding_analysis')
    const { id } = await params
    const { userId, context } = await workspace(req, id)
    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const action = text(body.action, 50)
    const question = await questionFor(id, context.id, body.questionId ?? context.selectedQuestionId)
    if (!question) return NextResponse.json({ error: 'Select a question before saving research work.' }, { status: 400 })

    if (action === 'attach_source') {
      const workspaceSourceId = text(body.workspaceSourceId, 200)
      const source = await db.workspaceSource.findFirst({ where: { id: workspaceSourceId, projectId: id }, include: { source: true } })
      assertNestedWorkspace(id, source?.projectId)
      if (!source) return NextResponse.json({ error: 'Workspace source not found.' }, { status: 404 })
      const resource = await db.questionResource.upsert({
        where: { questionId_workspaceSourceId: { questionId: question.id, workspaceSourceId: source.id } },
        update: { role: text(body.role, 80) || 'evidence_candidate', rationale: text(body.rationale, 2_000) || null, rationaleBasis: 'researcher' },
        create: { projectId: id, questionId: question.id, workspaceSourceId: source.id, role: text(body.role, 80) || 'evidence_candidate', rationale: text(body.rationale, 2_000) || null, rationaleBasis: 'researcher' },
        include: { workspaceSource: { include: { source: true } } },
      })
      await db.$transaction((tx) => appendAuditEvent(tx, { projectId: id, userId, type: 'question_source_attached', actor: 'student', payload: { questionId: question.id, workspaceSourceId: source.id } }))
      return NextResponse.json({ resource }, { status: 201 })
    }

    if (action === 'add_manual_excerpt') {
      const sourceTitle = text(body.sourceTitle, 500)
      const excerpt = text(body.excerpt, 12_000)
      const locator = text(body.locator, 500)
      if (!sourceTitle || !excerpt) return NextResponse.json({ error: 'A source label and the supplied excerpt are required.' }, { status: 400 })
      const contentHash = sha256(`${sourceTitle}\n${excerpt}`)
      const result = await db.$transaction(async (tx) => {
        const source = await tx.librarySource.upsert({
          where: { userId_contentHash: { userId, contentHash } },
          update: {},
          create: { userId, title: sourceTitle, contentHash, parseStatus: 'manual_excerpt', metadataJson: JSON.stringify({ manualExcerpt: excerpt, locator: locator || null, provenance: 'researcher_supplied', locatorChecked: Boolean(body.locatorChecked) }) },
        })
        const workspaceSource = await tx.workspaceSource.upsert({ where: { projectId_librarySourceId: { projectId: id, librarySourceId: source.id } }, update: { status: 'saved' }, create: { projectId: id, librarySourceId: source.id } })
        const resource = await tx.questionResource.upsert({
          where: { questionId_workspaceSourceId: { questionId: question.id, workspaceSourceId: workspaceSource.id } },
          update: { role: 'evidence_candidate', rationaleBasis: 'researcher' },
          create: { projectId: id, questionId: question.id, workspaceSourceId: workspaceSource.id, role: 'evidence_candidate', rationaleBasis: 'researcher' },
        })
        await appendAuditEvent(tx, { projectId: id, userId, type: 'manual_excerpt_added', actor: 'student', payload: { questionId: question.id, workspaceSourceId: workspaceSource.id, locator: locator || null, locatorChecked: Boolean(body.locatorChecked) } })
        return { resource, workspaceSource: { ...workspaceSource, source } }
      })
      void enqueueBackgroundEnginePrompt({ projectId: id, trigger: 'source_added', entityId: result.workspaceSource.id, questionId: question.id })
        .catch((error) => console.warn('Background engine prompt could not be enqueued:', (error as Error).message))
      return NextResponse.json(result, { status: 201 })
    }

    if (action === 'save_discovered_source' || action === 'add_video_resource') {
      const isVideo = action === 'add_video_resource'
      const title = text(body.title, 500)
      const canonicalUrl = canonicalizeSourceUrl(body.url)
      const doi = normalizeDoi(body.doi)
      if (!title || !canonicalUrl) return NextResponse.json({ error: isVideo ? 'A video title and an http(s) URL are required.' : 'A source title and an http(s) URL are required.' }, { status: 400 })
      const role = ['orientation', 'evidence_candidate', 'both'].includes(text(body.role, 80)) ? text(body.role, 80) : 'evidence_candidate'
      const rationale = text(body.rationale, 2_000)
      const metadata = discoveredMetadata(body, isVideo ? 'video' : 'discovery')
      const timestamp = isVideo ? validTimestampRange(body.timestampRange) : null
      const manualNote = isVideo ? text(body.manualNote, 12_000) : ''
      if (isVideo && text(body.timestampRange, 80) && !timestamp) return NextResponse.json({ error: 'Use a timestamp range such as 01:15–02:30, with an end after the start.' }, { status: 400 })
      if (isVideo && manualNote && !timestamp) return NextResponse.json({ error: 'A timestamped video note needs a valid timestamp range.' }, { status: 400 })
      if (isVideo) Object.assign(metadata, { medium: 'video', transcriptAvailable: Boolean(body.transcriptAvailable), manualTimestampNote: manualNote || null, timestampRange: timestamp })
      const result = await db.$transaction(async (tx) => {
        const existing = await tx.librarySource.findFirst({ where: { userId, OR: [...(doi ? [{ doi }] : []), { canonicalUrl }] } })
        const source = existing ?? await tx.librarySource.create({ data: {
          userId, title, doi, canonicalUrl, parseStatus: isVideo ? (body.transcriptAvailable ? 'transcript_pending' : 'transcript_unavailable') : 'metadata_only',
          metadataJson: JSON.stringify(metadata), qualityExplanation: 'Saved from a discovery record. Metadata signals are not an assessment of credibility or claim support.',
        } })
        const workspaceSource = await tx.workspaceSource.upsert({ where: { projectId_librarySourceId: { projectId: id, librarySourceId: source.id } }, update: { status: 'saved' }, create: { projectId: id, librarySourceId: source.id } })
        const resource = await tx.questionResource.upsert({
          where: { questionId_workspaceSourceId: { questionId: question.id, workspaceSourceId: workspaceSource.id } },
          update: { role, rationale: rationale || null, rationaleBasis: isVideo ? 'researcher' : 'metadata_or_abstract' },
          create: { projectId: id, questionId: question.id, workspaceSourceId: workspaceSource.id, role, rationale: rationale || null, rationaleBasis: isVideo ? 'researcher' : 'metadata_or_abstract' },
        })
        await appendAuditEvent(tx, { projectId: id, userId, type: isVideo ? 'video_resource_saved' : 'discovery_source_saved', actor: 'student', payload: { questionId: question.id, workspaceSourceId: workspaceSource.id, librarySourceId: source.id, reused: Boolean(existing), accessState: metadata.accessState, timestampRange: timestamp } })
        return { resource, workspaceSource: { ...workspaceSource, source }, alreadySaved: Boolean(existing), transcriptAvailable: Boolean(body.transcriptAvailable), timestampRange: timestamp }
      })
      void enqueueBackgroundEnginePrompt({ projectId: id, trigger: 'source_added', entityId: result.workspaceSource.id, questionId: question.id })
        .catch((error) => console.warn('Background engine prompt could not be enqueued:', (error as Error).message))
      return NextResponse.json(result, { status: result.alreadySaved ? 200 : 201 })
    }

    if (action === 'save_explanation') {
      const explanation = text(body.explanation, 12_000)
      if (!explanation) return NextResponse.json({ error: 'Write an explanation before saving it.' }, { status: 400 })
      const exchange = await db.researchExchange.create({ data: { projectId: id, questionId: question.id, speaker: 'researcher', body: explanation, origin: 'researcher', referencedIdsJson: JSON.stringify(Array.isArray(body.referencedIds) ? body.referencedIds.filter((value) => typeof value === 'string').slice(0, 20) : []) } })
      return NextResponse.json({ exchange }, { status: 201 })
    }

    if (action === 'incorporate_proposal') {
      const helpExchangeId = text(body.helpExchangeId, 200)
      const proposal = await db.researchExchange.findFirst({
        where: {
          id: helpExchangeId,
          projectId: id,
          questionId: question.id,
          speaker: 'assistant',
          origin: 'assistant_proposal',
          operation: 'research_help:proposal',
        },
        select: { id: true },
      })
      if (!proposal) return NextResponse.json({ error: 'The proposed organization is no longer available for this question.' }, { status: 404 })
      const exchange = await db.$transaction(async (tx) => {
        const recorded = await tx.researchExchange.create({
          data: {
            projectId: id,
            questionId: question.id,
            speaker: 'researcher',
            origin: 'researcher',
            body: 'Researcher chose to copy a proposed finding organization into an editable draft.',
            referencedIdsJson: JSON.stringify([proposal.id]),
            operation: 'assistant_proposal_incorporated',
          },
        })
        await appendAuditEvent(tx, { projectId: id, userId, type: 'research_proposal_incorporated', actor: 'student', payload: { questionId: question.id, proposalExchangeId: proposal.id, incorporationExchangeId: recorded.id } })
        return recorded
      })
      return NextResponse.json({ exchange }, { status: 201 })
    }

    if (action === 'save_finding') {
      const findingId = text(body.findingId, 200)
      const disposition = ['tentative', 'supported_with_limits', 'inconclusive'].includes(text(body.disposition, 80)) ? text(body.disposition, 80) as 'tentative' | 'supported_with_limits' | 'inconclusive' : 'tentative'
      const evidenceInput = Array.isArray(body.evidence) ? body.evidence.slice(0, 20).filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object') : []
      const sourceIds = evidenceInput.map((item) => text(item.workspaceSourceId, 200)).filter(Boolean)
      const sources = sourceIds.length ? await db.workspaceSource.findMany({ where: { id: { in: sourceIds }, projectId: id }, include: { source: true } }) : []
      if (sources.length !== new Set(sourceIds).size) throw new CollaboratorDomainError('Evidence must belong to this workspace.', 'cross_workspace')
      const sourceById = new Map(sources.map((source) => [source.id, source]))
      const existing = findingId ? await db.researchFinding.findFirst({ where: { id: findingId, projectId: id, questionId: question.id } }) : null
      if (findingId) assertNestedWorkspace(id, existing?.projectId)
      const result = await db.$transaction(async (tx) => {
        const finding = existing
          ? await tx.researchFinding.update({ where: { id: existing.id }, data: { disposition, reviewState: existing.reviewState === 'reviewed' ? 'review_needed' : 'draft', currentRevision: { increment: 1 } } })
          : await tx.researchFinding.create({ data: { projectId: id, questionId: question.id, disposition, reviewState: 'draft', currentRevision: 1 } })
        const revision = await tx.findingRevision.create({ data: {
          projectId: id, findingId: finding.id, revision: finding.currentRevision,
          conclusion: text(body.conclusion) || null, researcherExplanation: text(body.researcherExplanation) || null,
          uncertainty: text(body.uncertainty) || null, limitations: text(body.limitations) || null, conflicts: text(body.conflicts) || null,
          evidenceUnavailable: Boolean(body.evidenceUnavailable), evidenceScope: text(body.evidenceScope) || null, contentHash: 'pending', origin: text(body.origin, 80) === 'assistant_proposal' ? 'assistant_proposal' : 'researcher',
        } })
        const evidence = await Promise.all(evidenceInput.map((item) => {
          const workspaceSourceId = text(item.workspaceSourceId, 200) || null
          const source = workspaceSourceId ? sourceById.get(workspaceSourceId) : undefined
          const excerpt = text(item.excerpt, 12_000) || null
          return tx.findingEvidence.create({ data: {
            projectId: id, findingRevisionId: revision.id, workspaceSourceId, excerpt,
            sourceFingerprint: source?.source.contentHash ?? source?.librarySourceId ?? (text(item.sourceFingerprint, 200) || null),
            contentFingerprint: excerpt ? sha256(excerpt) : null, locatorType: text(item.locatorType, 80) || null,
            locatorValue: text(item.locatorValue, 500) || null, locatorPrecision: text(item.locatorPrecision, 80) || null,
            acquisition: text(item.acquisition, 80) || (source ? 'workspace_source' : 'researcher_supplied'), role: ['supports', 'qualifies', 'contradicts', 'context'].includes(text(item.role, 80)) ? text(item.role, 80) : 'supports', interpretation: text(item.interpretation) || null,
          } })
        }))
        const hash = findingRevisionHash({ conclusion: revision.conclusion, researcherExplanation: revision.researcherExplanation, uncertainty: revision.uncertainty, limitations: revision.limitations, conflicts: revision.conflicts, evidenceUnavailable: revision.evidenceUnavailable, evidenceScope: revision.evidenceScope, disposition, evidenceIds: evidence.map((item) => item.id) })
        const savedRevision = await tx.findingRevision.update({ where: { id: revision.id }, data: { contentHash: hash } })
        if (existing?.reviewState === 'reviewed') {
          const affectedArticles = await tx.researchArticle.updateMany({
            where: { projectId: id, status: { not: 'archived' }, inputs: { some: { findingId: finding.id } } },
            data: { status: 'review_needed' },
          })
          await appendAuditEvent(tx, { projectId: id, userId, type: 'research_finding_review_invalidated', actor: 'student', payload: { findingIds: [finding.id], reason: 'The researcher saved a newer finding revision.', changed: { kind: 'finding', id: finding.id }, affectedFindingCount: 1, affectedArticleCount: affectedArticles.count } })
        }
        await appendAuditEvent(tx, { projectId: id, userId, type: 'research_finding_saved', actor: 'student', payload: { findingId: finding.id, revision: savedRevision.revision, questionId: question.id, evidenceCount: evidence.length, disposition } })
        return { finding, revision: savedRevision, evidence }
      })
      void enqueueBackgroundEnginePrompt({
        projectId: id, trigger: 'finding_saved', entityId: `${result.finding.id}:${result.revision.revision}`,
        questionId: question.id, findingRevisionId: result.revision.id,
      }).catch((error) => console.warn('Background engine prompt could not be enqueued:', (error as Error).message))
      return NextResponse.json(result, { status: existing ? 200 : 201 })
    }

    return NextResponse.json({ error: 'Unsupported finding action.' }, { status: 400 })
  } catch (error) {
    return routeError(error)
  }
}
