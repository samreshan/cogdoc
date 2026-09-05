import { describe, expect, it } from 'vitest'
import {
  CollaboratorDomainError,
  assertActiveOwnedWorkspace,
  assertExpectedRevision,
  assertNestedWorkspace,
  assertOperationAllowed,
  assertQuestionTree,
  collaboratorExposure,
  findingReviewable,
  findingRevisionHash,
  manualQuestionPlan,
  nextRevision,
  operationAllowed,
} from './research-collaborator'

describe('research collaborator domain contract', () => {
  it('defaults to legacy exposure and only enables investigation explicitly', () => {
    expect(collaboratorExposure({})).toBe('legacy')
    expect(collaboratorExposure({ COGDOC_RESEARCH_COLLABORATOR: 'true' })).toBe('investigation')
    expect(operationAllowed('research_help', 'investigation')).toBe(true)
    expect(operationAllowed('article_draft', 'investigation')).toBe(false)
    expect(operationAllowed('article_draft', 'article')).toBe(true)
    expect(() => assertOperationAllowed('article_draft', 'investigation')).toThrow(CollaboratorDomainError)
  })

  it('rejects foreign, archived and stale writes before persistence', () => {
    expect(() => assertActiveOwnedWorkspace({ id: 'p1', userId: 'u2', archived: false, deletedAt: null }, 'u1')).toThrow('not found')
    expect(() => assertActiveOwnedWorkspace({ id: 'p1', userId: 'u1', archived: true, deletedAt: null }, 'u1')).toThrow('archived')
    expect(() => assertNestedWorkspace('p1', 'p2')).toThrow('different workspace')
    expect(() => assertExpectedRevision(2, 3)).toThrow('changed before')
    expect(nextRevision(3)).toBe(4)
  })

  it('rejects a cyclic investigation question tree', () => {
    const parents = new Map([['q1', null], ['q2', 'q1'], ['q3', 'q2']])
    expect(() => assertQuestionTree(parents, 'q1', 'q3')).toThrow('cycle')
    expect(() => assertQuestionTree(parents, 'q2', 'q2')).toThrow('own parent')
    expect(() => assertQuestionTree(parents, 'q3', null)).not.toThrow()
  })

  it('allows an explicit inconclusive finding without inventing evidence', () => {
    expect(findingReviewable({
      conclusion: 'The available material does not answer the question.',
      researcherExplanation: 'The two accessible sources discuss context but do not measure the outcome.',
      uncertainty: 'A fuller corpus could change this conclusion.',
      limitations: 'Only abstracts and one short excerpt were available.',
      conflicts: 'No conflicts identified in the material examined.',
      evidenceUnavailable: true,
      evidenceScope: 'Two abstracts and an excerpt for the selected question.',
      evidenceCount: 0,
      disposition: 'inconclusive',
    })).toEqual({ ok: true })
  })

  it('does not treat evidence gaps as support for a supported conclusion', () => {
    expect(findingReviewable({
      conclusion: 'The intervention improves outcomes.',
      researcherExplanation: 'I think the studies point that way.',
      uncertainty: 'Effect sizes remain uncertain.',
      limitations: 'The sample is small.',
      conflicts: 'No conflicts identified.',
      evidenceUnavailable: true,
      evidenceScope: 'One search result.',
      evidenceCount: 0,
      disposition: 'supported_with_limits',
    })).toEqual({ ok: false, reason: 'A supported conclusion needs attached evidence.' })
  })

  it('hashes equivalent evidence selections deterministically', () => {
    const shared = {
      conclusion: 'A cautious answer.', researcherExplanation: 'The passages point in this direction.', uncertainty: 'More work is needed.',
      limitations: 'The corpus is small.', conflicts: 'No conflicts identified.', evidenceUnavailable: false, evidenceScope: null,
      disposition: 'tentative' as const,
    }
    expect(findingRevisionHash({ ...shared, evidenceIds: ['b', 'a'] })).toBe(findingRevisionHash({ ...shared, evidenceIds: ['a', 'b'] }))
  })

  it('offers an editable manual plan without treating it as a conclusion', () => {
    const plan = manualQuestionPlan('Urban heat', 'Understand local health effects')
    expect(plan).toHaveLength(3)
    expect(plan[0]?.wording).toContain('Urban heat')
    expect(plan.some((item) => item.wording.includes('is proven'))).toBe(false)
  })
})
