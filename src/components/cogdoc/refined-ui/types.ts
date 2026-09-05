import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

/**
 * Presentation contracts for the research collaborator. These deliberately
 * contain no API or store types so feature work can adapt existing domain
 * records at the integration boundary.
 */
export type SaveState = 'saved' | 'saving' | 'error' | 'idle'
export type LocatorPrecision = 'exact' | 'approximate' | 'unavailable'
export type SourceAvailability = 'full_text' | 'excerpt' | 'metadata'
export type FindingReviewState = 'draft' | 'accepted' | 'review_needed' | 'uncertain'

export interface RefinedNavigationItem {
  id: string
  label: string
  icon?: LucideIcon
  count?: number
  disabled?: boolean
}

export interface ResearchQuestionItem {
  id: string
  title: string
  purpose?: string
  state?: 'active' | 'draft' | 'answered' | 'archived'
  branchDepth?: number
}

export interface PassageLocator {
  label?: string
  precision: LocatorPrecision
  detail?: string
}

export interface ResearchPassage {
  id: string
  heading?: string
  content: ReactNode
  locator: PassageLocator
}

export interface ResearchSource {
  id: string
  title: string
  authors?: string
  year?: string
  kind?: string
  availability: SourceAvailability
  availabilityDetail?: string
}

export interface ContextualPrompt {
  title: string
  body: string
  sourceLabel?: string
}

export interface FindingSummary {
  id: string
  title: string
  reviewState: FindingReviewState
  updatedLabel?: string
  evidenceCount?: number
}

export interface FindingDetail extends FindingSummary {
  questionLabel: string
  conclusion: ReactNode
  rationale?: ReactNode
  evidence?: Array<{ id: string; label: string; locator?: string }>
  limitations?: ReactNode
  uncertainty?: ReactNode
  reviewNote?: string
}
