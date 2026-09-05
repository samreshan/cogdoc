import { sha256 } from '@/lib/crypto'
import { CollaboratorDomainError } from '@/lib/research-collaborator'
import type {
  FindingArticleEligibility,
  FindingArticleEligibilityInput,
  FindingDependencySnapshotInput,
  FindingReviewDecision,
  FindingReviewState,
} from '@/lib/finding-review-types'
import { findingReviewDecisions } from '@/lib/finding-review-types'

export function isFindingReviewDecision(value: unknown): value is FindingReviewDecision {
  return typeof value === 'string' && (findingReviewDecisions as readonly string[]).includes(value)
}

export function reviewStateForDecision(decision: FindingReviewDecision): FindingReviewState {
  return decision === 'accept' || decision === 'retain_uncertainty' ? 'reviewed' : 'review_needed'
}

export function decisionNeedsReviewableFinding(decision: FindingReviewDecision) {
  return decision === 'accept' || decision === 'retain_uncertainty'
}

export function reviewDecisionLabel(decision: FindingReviewDecision | string | null | undefined) {
  switch (decision) {
    case 'accept': return 'Accepted by the researcher'
    case 'retain_uncertainty': return 'Uncertainty retained by the researcher'
    case 'request_more_evidence': return 'More evidence requested'
    case 'withdraw': return 'Acceptance withdrawn'
    default: return 'Awaiting explicit researcher review'
  }
}

export function assertCurrentFindingRevision(expectedRevision: number, currentRevision: number, revision: number) {
  if (!Number.isInteger(expectedRevision) || expectedRevision < 1) {
    throw new CollaboratorDomainError('A current finding revision is required.', 'invalid_shape')
  }
  if (expectedRevision !== currentRevision || revision !== currentRevision) {
    throw new CollaboratorDomainError('This finding changed before the review could be recorded.', 'stale_revision')
  }
}

export function findingDependencyHash(input: FindingDependencySnapshotInput) {
  const evidence = input.evidence
    .map((item) => ({
      id: item.id,
      workspaceSourceId: item.workspaceSourceId,
      sourceFingerprint: item.sourceFingerprint,
      contentFingerprint: item.contentFingerprint,
      locatorType: item.locatorType,
      locatorValue: item.locatorValue,
      locatorPrecision: item.locatorPrecision,
    }))
    .sort((left, right) => left.id.localeCompare(right.id))

  return sha256(JSON.stringify({
    findingId: input.findingId,
    findingRevisionId: input.findingRevisionId,
    findingRevision: input.findingRevision,
    revisionContentHash: input.revisionContentHash,
    questionId: input.questionId,
    questionRevision: input.questionRevision,
    evidence,
  }))
}

export function findingArticleEligibility(input: FindingArticleEligibilityInput): FindingArticleEligibility {
  if (input.reviewState !== 'reviewed') return { eligible: false, reason: 'This finding needs an explicit current-revision review.' }
  if (input.findingRevision !== input.currentRevision) return { eligible: false, reason: 'This reviewed revision is no longer current.' }
  if (input.latestDecision !== 'accept' && input.latestDecision !== 'retain_uncertainty') {
    return { eligible: false, reason: 'The current review does not accept this finding for use.' }
  }
  return { eligible: true, reason: null }
}
