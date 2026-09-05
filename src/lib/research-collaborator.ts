import { sha256 } from '@/lib/crypto'

/**
 * Shared domain rules for the research-collaborator rollout.
 *
 * This module intentionally keeps product state separate from legacy document
 * claims, synthesis findings, intervention satisfaction, and certificates.
 * Route handlers use these pure helpers before they read or mutate Prisma data.
 */
export type CollaboratorExposure = 'legacy' | 'investigation' | 'article'
export type ResearchOperation =
  | 'investigation_plan'
  | 'research_help'
  | 'finding_analysis'
  | 'article_outline'
  | 'article_draft'

export type FindingDisposition = 'tentative' | 'supported_with_limits' | 'inconclusive'
export type FindingReviewState = 'draft' | 'review_needed' | 'reviewed' | 'archived'

export class CollaboratorDomainError extends Error {
  constructor(
    message: string,
    public readonly code: 'forbidden_operation' | 'invalid_state' | 'stale_revision' | 'cross_workspace' | 'invalid_shape' | 'archived_workspace',
  ) {
    super(message)
  }
}

export function collaboratorExposure(environment: NodeJS.ProcessEnv = process.env): CollaboratorExposure {
  const value = environment.COGDOC_RESEARCH_COLLABORATOR?.trim().toLowerCase()
  if (value === 'article') return 'article'
  if (value === '1' || value === 'true' || value === 'investigation') return 'investigation'
  return 'legacy'
}

export function operationAllowed(operation: ResearchOperation, exposure = collaboratorExposure()): boolean {
  if (operation === 'article_outline' || operation === 'article_draft') return exposure === 'article'
  return exposure === 'investigation' || exposure === 'article'
}

/** Article operations are intentionally unavailable in the Sprint 1 default. */
export function assertOperationAllowed(operation: ResearchOperation, exposure = collaboratorExposure()) {
  if (!operationAllowed(operation, exposure)) {
    throw new CollaboratorDomainError(
      operation.startsWith('article_')
        ? 'Article composition is not enabled for this research workspace yet.'
        : 'The research collaborator is not enabled for this workspace.',
      'forbidden_operation',
    )
  }
}

export interface WorkspaceOwnership {
  id: string
  userId: string
  archived: boolean
  deletedAt: Date | null
}

export function assertActiveOwnedWorkspace(
  workspace: WorkspaceOwnership | null | undefined,
  userId: string,
): asserts workspace is WorkspaceOwnership {
  if (!workspace || workspace.userId !== userId) {
    throw new CollaboratorDomainError('Workspace was not found.', 'cross_workspace')
  }
  if (workspace.archived || workspace.deletedAt) {
    throw new CollaboratorDomainError('This workspace is archived or deleted.', 'archived_workspace')
  }
}

export function assertNestedWorkspace(projectId: string, nestedProjectId: string | null | undefined) {
  if (!nestedProjectId || nestedProjectId !== projectId) {
    throw new CollaboratorDomainError('This item belongs to a different workspace.', 'cross_workspace')
  }
}

export function assertExpectedRevision(expectedRevision: number, actualRevision: number) {
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0) {
    throw new CollaboratorDomainError('A non-negative expected revision is required.', 'invalid_shape')
  }
  if (expectedRevision !== actualRevision) {
    throw new CollaboratorDomainError('This item changed before your update could be saved.', 'stale_revision')
  }
}

/** Reject a parent change that would make a question its own ancestor. */
export function assertQuestionTree(parentByQuestionId: ReadonlyMap<string, string | null>, questionId: string, parentId: string | null) {
  if (!parentId) return
  if (parentId === questionId) throw new CollaboratorDomainError('A question cannot be its own parent.', 'invalid_shape')
  const visited = new Set<string>([questionId])
  let cursor: string | null | undefined = parentId
  while (cursor) {
    if (visited.has(cursor)) throw new CollaboratorDomainError('Question branches cannot contain a cycle.', 'invalid_shape')
    visited.add(cursor)
    cursor = parentByQuestionId.get(cursor)
  }
}

export interface FindingRevisionInput {
  conclusion?: string | null
  researcherExplanation?: string | null
  uncertainty?: string | null
  limitations?: string | null
  conflicts?: string | null
  evidenceUnavailable: boolean
  evidenceScope?: string | null
  evidenceCount: number
  disposition: FindingDisposition
}

function hasText(value: string | null | undefined) { return Boolean(value?.trim()) }

/**
 * Structural review eligibility only. It never judges whether the researcher
 * understands the topic or whether the conclusion is true.
 */
export function findingReviewable(input: FindingRevisionInput): { ok: true } | { ok: false; reason: string } {
  if (!hasText(input.conclusion)) return { ok: false, reason: 'A conclusion or explicit inconclusive answer is required.' }
  if (!hasText(input.researcherExplanation)) return { ok: false, reason: 'Explain why this conclusion follows in your own words.' }
  if (!hasText(input.uncertainty) || !hasText(input.limitations) || !hasText(input.conflicts)) {
    return { ok: false, reason: 'Record uncertainty, limitations, and conflicts (or explicitly state none identified).' }
  }
  if (input.evidenceCount === 0 && !input.evidenceUnavailable) {
    return { ok: false, reason: 'Attach evidence or record that usable evidence was unavailable.' }
  }
  if (input.evidenceUnavailable && !hasText(input.evidenceScope)) {
    return { ok: false, reason: 'Describe the material or search scope behind the evidence gap.' }
  }
  if (input.disposition === 'supported_with_limits' && input.evidenceCount === 0) {
    return { ok: false, reason: 'A supported conclusion needs attached evidence.' }
  }
  return { ok: true }
}

/** Stable content hash for immutable finding revision snapshots. */
export function findingRevisionHash(input: Omit<FindingRevisionInput, 'evidenceCount'> & { evidenceIds: string[] }) {
  return sha256(JSON.stringify({
    conclusion: input.conclusion?.trim() ?? '',
    researcherExplanation: input.researcherExplanation?.trim() ?? '',
    uncertainty: input.uncertainty?.trim() ?? '',
    limitations: input.limitations?.trim() ?? '',
    conflicts: input.conflicts?.trim() ?? '',
    evidenceUnavailable: input.evidenceUnavailable,
    evidenceScope: input.evidenceScope?.trim() ?? '',
    disposition: input.disposition,
    evidenceIds: [...input.evidenceIds].sort(),
  }))
}

export function nextRevision(currentRevision: number) {
  if (!Number.isInteger(currentRevision) || currentRevision < 0) {
    throw new CollaboratorDomainError('Current revision is invalid.', 'invalid_shape')
  }
  return currentRevision + 1
}

/** A no-provider plan proposal. The researcher edits or rejects every item. */
export function manualQuestionPlan(topic: string, purpose?: string | null) {
  const focus = topic.trim().replace(/[?.!]+$/, '')
  const purposeText = purpose?.trim()
  return [
    { wording: `What do I need to understand about ${focus}?`, rationale: purposeText || 'Set the scope of this investigation.' },
    { wording: `What evidence would help answer this question about ${focus}?`, rationale: 'Identify material to inspect rather than a conclusion to accept.' },
    { wording: `What limits, alternatives, or uncertainties matter for ${focus}?`, rationale: 'Keep the investigation open to competing evidence.' },
  ]
}
