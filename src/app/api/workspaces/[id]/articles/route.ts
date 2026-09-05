import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/auth-supabase'
import { assertActiveOwnedWorkspace, assertOperationAllowed, CollaboratorDomainError } from '@/lib/research-collaborator'
import { findingArticleEligibility, findingDependencyHash } from '@/lib/finding-review'
import { configuredArticleDraft, manualOutlineContent } from '@/lib/article-composition'
import type { ArticleFindingInput } from '@/lib/article-composition-types'
import { appendAuditEvent } from '@/lib/workspace-server'

export const runtime = 'nodejs'

function text(value: unknown, max = 500) { return typeof value === 'string' ? value.trim().slice(0, max) : '' }

function errorResponse(error: unknown) {
  if (error instanceof CollaboratorDomainError) {
    const status = error.code === 'forbidden_operation' ? 403 : error.code === 'archived_workspace' ? 409 : 400
    return NextResponse.json({ error: error.message, code: error.code }, { status })
  }
  throw error
}

async function ownedContext(req: NextRequest, projectId: string) {
  const userId = await requireUserId(req)
  const project = await db.project.findFirst({ where: { id: projectId, userId }, select: { id: true, userId: true, archived: true, deletedAt: true } })
  assertActiveOwnedWorkspace(project, userId)
  const context = await db.researchContext.findUnique({ where: { projectId } })
  if (!context) throw new CollaboratorDomainError('Start an investigation before creating an article.', 'invalid_state')
  return { userId, context }
}

async function selectedFindings(projectId: string, revisionIds: string[]) {
  const revisions = await db.findingRevision.findMany({
    where: { id: { in: revisionIds }, projectId },
    include: {
      finding: { include: { question: true } },
      evidences: { include: { workspaceSource: { include: { source: true } } } },
      reviews: { orderBy: { createdAt: 'desc' }, take: 1, select: { decision: true } },
    },
  })
  if (revisions.length !== revisionIds.length || new Set(revisionIds).size !== revisionIds.length) {
    throw new CollaboratorDomainError('Select only distinct current findings from this workspace.', 'cross_workspace')
  }
  return revisions.map((revision) => {
    const eligibility = findingArticleEligibility({
      reviewState: revision.finding.reviewState as 'draft' | 'review_needed' | 'reviewed' | 'archived',
      findingRevision: revision.revision,
      currentRevision: revision.finding.currentRevision,
      latestDecision: revision.reviews[0]?.decision,
    })
    if (!eligibility.eligible) throw new CollaboratorDomainError(eligibility.reason ?? 'Finding is not eligible for article use.', 'invalid_state')
    const evidence = revision.evidences.map((item) => ({
      id: item.id,
      workspaceSourceId: item.workspaceSourceId,
      sourceFingerprint: item.sourceFingerprint,
      contentFingerprint: item.contentFingerprint,
      locatorType: item.locatorType,
      locatorValue: item.locatorValue,
      locatorPrecision: item.locatorPrecision,
    }))
    const dependencyHash = findingDependencyHash({
      findingId: revision.findingId,
      findingRevisionId: revision.id,
      findingRevision: revision.revision,
      revisionContentHash: revision.contentHash,
      questionId: revision.finding.questionId,
      questionRevision: revision.finding.question.revision,
      evidence,
    })
    const input: ArticleFindingInput = {
      findingId: revision.findingId,
      findingRevisionId: revision.id,
      dependencyHash,
      question: revision.finding.question.wording,
      conclusion: revision.conclusion,
      explanation: revision.researcherExplanation,
      uncertainty: revision.uncertainty,
      limitations: revision.limitations,
      conflicts: revision.conflicts,
      evidence: revision.evidences.map((item) => ({
        sourceTitle: item.workspaceSource?.source.title ?? 'Unlinked source',
        locator: item.locatorValue,
        excerpt: item.excerpt,
      })),
    }
    return { revision, input }
  })
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertOperationAllowed('article_outline')
    const { id } = await params
    await ownedContext(req, id)
    const articles = await db.researchArticle.findMany({
      where: { projectId: id },
      include: { inputs: { include: { findingRevision: true } } },
      orderBy: { updatedAt: 'desc' },
    })
    return NextResponse.json({ articles })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await params
    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const path = body.path === 'generated_draft' ? 'generated_draft' : body.path === 'manual_outline' ? 'manual_outline' : null
    if (!path) return NextResponse.json({ error: 'Choose a manual outline or generated draft path.' }, { status: 400 })
    assertOperationAllowed(path === 'generated_draft' ? 'article_draft' : 'article_outline')
    const { userId, context } = await ownedContext(req, projectId)
    const revisionIds = Array.isArray(body.findingRevisionIds) ? body.findingRevisionIds.filter((id): id is string => typeof id === 'string').slice(0, 12) : []
    if (!revisionIds.length) return NextResponse.json({ error: 'Select at least one current reviewed finding.' }, { status: 400 })
    const findings = await selectedFindings(projectId, revisionIds)
    const title = text(body.title) || 'Untitled research article'
    const audience = text(body.audience) || null
    const purpose = text(body.purpose, 2_000) || null
    const article = await db.$transaction(async (tx) => {
      const created = await tx.researchArticle.create({
        data: {
          projectId,
          contextId: context.id,
          title,
          path,
          content: path === 'manual_outline' ? manualOutlineContent(title, findings.map((item) => item.input)) : '',
          revision: path === 'manual_outline' ? 1 : 0,
          status: path === 'manual_outline' ? 'outline' : 'draft',
          generationStatus: path === 'generated_draft' ? 'running' : null,
          policyVersion: 'reviewed-finding-article-v1',
          inputs: { create: findings.map((item) => ({ projectId, findingId: item.input.findingId, findingRevisionId: item.input.findingRevisionId, dependencyHash: item.input.dependencyHash })) },
        },
        include: { inputs: true },
      })
      await appendAuditEvent(tx, { projectId, userId, type: 'research_article_created', actor: 'student', payload: { articleId: created.id, path, findingRevisionIds: revisionIds } })
      return created
    })
    if (path === 'manual_outline') return NextResponse.json({ article }, { status: 201 })

    try {
      const draft = await configuredArticleDraft({ title, audience, purpose, findings: findings.map((item) => item.input) })
      let stale = false
      try {
        const fresh = await selectedFindings(projectId, revisionIds)
        stale = fresh.some((item, index) => item.input.dependencyHash !== findings[index]?.input.dependencyHash)
      } catch (error) {
        if (error instanceof CollaboratorDomainError) stale = true
        else throw error
      }
      const updated = await db.researchArticle.update({
        where: { id: article.id },
        data: {
          content: draft.content,
          revision: 1,
          status: 'review_needed',
          generationStatus: 'completed',
          policyVersion: draft.modelVersion ? 'reviewed-finding-article-v1:' + draft.modelVersion : 'reviewed-finding-article-v1',
        },
      })
      return NextResponse.json({ article: updated, stale, warning: stale ? 'Inputs changed while drafting. Review this draft against the current findings.' : null }, { status: 201 })
    } catch (error) {
      await db.researchArticle.update({ where: { id: article.id }, data: { generationStatus: 'failed', status: 'draft' } })
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Article drafting failed. You can still create a manual outline.' }, { status: 503 })
    }
  } catch (error) {
    return errorResponse(error)
  }
}
