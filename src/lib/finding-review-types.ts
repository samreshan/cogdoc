export const findingReviewDecisions = ['accept', 'retain_uncertainty', 'request_more_evidence', 'withdraw'] as const

export type FindingReviewDecision = typeof findingReviewDecisions[number]
export type FindingReviewState = 'draft' | 'review_needed' | 'reviewed' | 'archived'

export interface FindingDependencyEvidence {
  id: string
  workspaceSourceId: string | null
  sourceFingerprint: string | null
  contentFingerprint: string | null
  locatorType: string | null
  locatorValue: string | null
  locatorPrecision: string | null
}

export interface FindingDependencySnapshotInput {
  findingId: string
  findingRevisionId: string
  findingRevision: number
  revisionContentHash: string
  questionId: string
  questionRevision: number
  evidence: FindingDependencyEvidence[]
}

export interface FindingArticleEligibilityInput {
  reviewState: FindingReviewState
  findingRevision: number
  currentRevision: number
  latestDecision: string | null | undefined
}

export interface FindingArticleEligibility {
  eligible: boolean
  reason: string | null
}
