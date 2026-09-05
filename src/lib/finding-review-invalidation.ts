import { appendAuditEvent } from '@/lib/workspace-server'

type InvalidationTransaction = {
  researchFinding: {
    updateMany: (input: unknown) => Promise<{ count: number }>
    findMany: (input: unknown) => Promise<Array<{ id: string }>>
  }
  researchArticle: { updateMany: (input: unknown) => Promise<{ count: number }> }
  findingEvidence: {
    findMany: (input: unknown) => Promise<Array<{ findingRevision: { findingId: string; revision: number; finding: { id: string; currentRevision: number; reviewState: string } } }>>
  }
  auditEvent: { findFirst: (input: unknown) => Promise<unknown>; create: (input: unknown) => Promise<unknown> }
}

export interface ReviewInvalidation {
  projectId: string
  userId: string
  findingIds: string[]
  reason: string
  changed: { kind: 'finding' | 'question' | 'source' | 'locator' | 'removal'; id: string }
}

/**
 * Review history is immutable. This only moves *current reviewed* findings
 * back to review_needed, then marks articles that selected those findings for
 * review. The audit payload is the visible, durable explanation of the change.
 */
export async function invalidateFindingReviews(tx: InvalidationTransaction, input: ReviewInvalidation) {
  const findingIds = [...new Set(input.findingIds)].filter(Boolean)
  if (!findingIds.length) return { findings: 0, articles: 0 }
  const findings = await tx.researchFinding.updateMany({
    where: { id: { in: findingIds }, projectId: input.projectId, reviewState: 'reviewed' },
    data: { reviewState: 'review_needed' },
  })
  const articles = await tx.researchArticle.updateMany({
    where: {
      projectId: input.projectId,
      status: { not: 'archived' },
      inputs: { some: { findingId: { in: findingIds } } },
    },
    data: { status: 'review_needed' },
  })
  if (findings.count || articles.count) {
    await appendAuditEvent(tx as never, {
      projectId: input.projectId,
      userId: input.userId,
      type: 'research_finding_review_invalidated',
      actor: 'student',
      payload: { findingIds, reason: input.reason, changed: input.changed, affectedFindingCount: findings.count, affectedArticleCount: articles.count },
    })
  }
  return { findings: findings.count, articles: articles.count }
}

/** Finds only findings whose current revision actually carried the source. */
export async function currentFindingIdsForWorkspaceSource(tx: InvalidationTransaction, projectId: string, workspaceSourceId: string) {
  const evidence = await tx.findingEvidence.findMany({
    where: { projectId, workspaceSourceId },
    include: { findingRevision: { include: { finding: true } } },
  })
  return [...new Set(evidence.flatMap(({ findingRevision }) =>
    findingRevision.revision === findingRevision.finding.currentRevision && findingRevision.finding.reviewState === 'reviewed'
      ? [findingRevision.findingId]
      : [],
  ))]
}

export async function currentFindingIdsForQuestion(tx: InvalidationTransaction, projectId: string, questionId: string) {
  const findings = await tx.researchFinding.findMany({
    where: { projectId, questionId, reviewState: 'reviewed' },
    select: { id: true },
  })
  return findings.map((finding) => finding.id)
}
