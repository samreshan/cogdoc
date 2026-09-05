import { describe, expect, it } from 'vitest'
import {
  assertCurrentFindingRevision,
  findingArticleEligibility,
  findingDependencyHash,
  reviewDecisionLabel,
  reviewStateForDecision,
} from './finding-review'
import { CollaboratorDomainError } from './research-collaborator'

describe('finding review contract', () => {
  const base = {
    findingId: 'finding-1',
    findingRevisionId: 'revision-1',
    findingRevision: 2,
    revisionContentHash: 'revision-hash',
    questionId: 'question-1',
    questionRevision: 3,
    evidence: [{
      id: 'evidence-1',
      workspaceSourceId: 'source-1',
      sourceFingerprint: 'source-hash',
      contentFingerprint: 'excerpt-hash',
      locatorType: 'section',
      locatorValue: '§ 2',
      locatorPrecision: 'user_confirmed',
    }],
  }

  it('keeps explicit acceptance and retained uncertainty distinct while both are reviewed', () => {
    expect(reviewStateForDecision('accept')).toBe('reviewed')
    expect(reviewStateForDecision('retain_uncertainty')).toBe('reviewed')
    expect(reviewDecisionLabel('retain_uncertainty')).toContain('Uncertainty retained')
    expect(reviewStateForDecision('request_more_evidence')).toBe('review_needed')
    expect(reviewStateForDecision('withdraw')).toBe('review_needed')
  })

  it('pins locator and question semantics into the dependency snapshot', () => {
    const initial = findingDependencyHash(base)
    expect(findingDependencyHash({ ...base, questionRevision: 4 })).not.toBe(initial)
    expect(findingDependencyHash({ ...base, evidence: [{ ...base.evidence[0], locatorValue: '§ 3' }] })).not.toBe(initial)
  })

  it('rejects stale current-revision actions and only exposes current accepted reviews to article selection', () => {
    expect(() => assertCurrentFindingRevision(2, 3, 2)).toThrow(CollaboratorDomainError)
    expect(findingArticleEligibility({ reviewState: 'reviewed', findingRevision: 2, currentRevision: 2, latestDecision: 'retain_uncertainty' })).toEqual({ eligible: true, reason: null })
    expect(findingArticleEligibility({ reviewState: 'review_needed', findingRevision: 2, currentRevision: 2, latestDecision: 'withdraw' }).eligible).toBe(false)
    expect(findingArticleEligibility({ reviewState: 'reviewed', findingRevision: 1, currentRevision: 2, latestDecision: 'accept' }).eligible).toBe(false)
  })
})
