export type WorkspaceType = 'assignment' | 'research'
export type ReviewPace = 'rapid' | 'guided' | 'deep'
export type CitationStyle = 'harvard' | 'apa'
export type WorkspaceLifecycle = 'draft' | 'reviewing' | 'ready' | 'certified'
export type ReviewSeverity = 'critical' | 'advisory'
export type ReviewItemState =
  | 'open' | 'in_progress' | 'submitted' | 'rechecking'
  | 'resolved' | 'dismissed' | 'unresolved'

export const LEGACY_FRICTION_TO_PACE = {
  assistant: 'rapid',
  coach: 'guided',
  socratic: 'deep',
} as const

export function normalizeReviewPace(value: unknown): ReviewPace {
  if (value === 'rapid' || value === 'guided' || value === 'deep') return value
  if (value === 'assistant' || value === 'coach' || value === 'socratic') {
    return LEGACY_FRICTION_TO_PACE[value]
  }
  return 'deep'
}

export function isWorkspaceType(value: unknown): value is WorkspaceType {
  return value === 'assignment' || value === 'research'
}

export function isCitationStyle(value: unknown): value is CitationStyle {
  return value === 'harvard' || value === 'apa'
}

