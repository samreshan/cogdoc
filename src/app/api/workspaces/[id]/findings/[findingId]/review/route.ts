import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/auth-supabase'
import {
  assertActiveOwnedWorkspace,
  assertOperationAllowed,
  CollaboratorDomainError,
  findingReviewable,
} from '@/lib/research-collaborator'
import {
  assertCurrentFindingRevision,
  decisionNeedsReviewableFinding,
  findingDependencyHash,
  isFindingReviewDecision,
  reviewStateForDecision,
} from '@/lib/finding-review'
import { appendAuditEvent } from '@/lib/workspace-server'

export const runtime = 'nodejs'

function text(value: unknown, max = 2_000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function routeError(error: unknown) {
  if (error instanceof CollaboratorDomainError) {
    const status = error.code === 'forbidden_operation' ? 403 : error.code === 'stale_revision' || error.code === 'archived_workspace' ? 409 : 400
    return NextResponse.json({ error: error.message, code: error.code }, { status })
  }
  throw error
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; findingId: string }> },
) {
  try {
    assertOperationAllowed('finding_analysis')
    const { id: projectId, findingId } = await params
    const userId = await requireUserId(req)
    const project = await db.project.findFirst({
      where: { id: projectId, userId },
      select: { id: true, userId: true, archived: true, deletedAt: true },
    })
    assertActiveOwnedWorkspace(project, userId)

    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const decision = body.decision
    const expectedRevision = body.expectedRevision
    if (!isFindingReviewDecision(decision)) {
      return NextResponse.json({ error: 'Choose accept, retain uncertainty, request more evidence, or withdraw acceptance.' }, { status: 400 })
    }
    if (typeof expectedRevision !== 'number' || !Number.isInteger(expectedRevision)) {
      return NextResponse.json({ error: 'The current finding revision is required.' }, { status: 400 })
    }

    const revision = await db.findingRevision.findFirst({
      where: { id: text(body.findingRevisionId, 200), projectId, findingId },
      include: { finding: { include: { question: true } } },
    })
    if (!revision || revision.finding.projectId !== projectId) {
      return NextResponse.json({ error: 'Finding revision not found.' }, { status: 404 })
    }
    assertCurrentFindingRevision(expectedRevision, revision.finding.currentRevision, revision.revision)

    const evidence = await db.findingEvidence.findMany({
      where: { findingRevisionId: revision.id, projectId },
      select: {
        id: true,
        workspaceSourceId: true,
        sourceFingerprint: true,
        contentFingerprint: true,
        locatorType: true,
        locatorValue: true,
        locatorPrecision: true,
      },
    })
    if (decisionNeedsReviewableFinding(decision)) {
      const eligible = findingReviewable({
        conclusion: revision.conclusion,
        researcherExplanation: revision.researcherExplanation,
        uncertainty: revision.uncertainty,
        limitations: revision.limitations,
        conflicts: revision.conflicts,
        evidenceUnavailable: revision.evidenceUnavailable,
        evidenceScope: revision.evidenceScope,
        evidenceCount: evidence.length,
        disposition: revision.finding.disposition as 'tentative' | 'supported_with_limits' | 'inconclusive',
      })
      if (!eligible.ok) return NextResponse.json({ error: eligible.reason }, { status: 422 })
    }

    const dependencyHash = findingDependencyHash({
      findingId,
      findingRevisionId: revision.id,
      findingRevision: revision.revision,
      revisionContentHash: revision.contentHash,
      questionId: revision.finding.questionId,
      questionRevision: revision.finding.question.revision,
      evidence,
    })
    const reviewState = reviewStateForDecision(decision)

    const result = await db.$transaction(async (tx) => {
      const updated = await tx.researchFinding.updateMany({
        where: { id: findingId, projectId, currentRevision: expectedRevision },
        data: { reviewState },
      })
      if (updated.count !== 1) {
        throw new CollaboratorDomainError('This finding changed before the review could be recorded.', 'stale_revision')
      }
      const review = await tx.findingReview.create({
        data: {
          projectId,
          findingRevisionId: revision.id,
          reviewerId: userId,
          decision,
          dependencyHash,
          note: text(body.note) || null,
        },
      })
      await appendAuditEvent(tx, {
        projectId,
        userId,
        type: 'research_finding_reviewed',
        actor: 'student',
        payload: {
          findingId,
          findingRevisionId: revision.id,
          revision: revision.revision,
          decision,
          dependencyHash,
          reviewState,
        },
      })
      return { review, reviewState }
    })

    return NextResponse.json({
      review: result.review,
      reviewState: result.reviewState,
      dependencyHash,
      articleEligibility: {
        eligible: reviewState === 'reviewed',
        reason: reviewState === 'reviewed' ? null : 'A current finding review is required before article selection.',
      },
    })
  } catch (error) {
    return routeError(error)
  }
}
