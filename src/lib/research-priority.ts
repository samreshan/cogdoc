import type { PriorityFactors } from '@/lib/types'

export interface ResearchPriorityInput {
  pinned?: boolean
  blocksVerification?: boolean
  dueAt?: Date | string | null
  now?: Date
  evidenceState?: 'missing' | 'conflicting' | 'partial' | 'supported' | null
  requirementUncovered?: boolean
  citationState?: 'missing' | 'unverified' | 'verified' | null
  sourceQuality?: number | null
  documentCentrality?: number | null
  aiRelevanceAdjustment?: number | null
}

export interface ResearchPriorityResult {
  score: number
  factors: PriorityFactors
  explanation: string[]
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** Deterministic research-action priority. AI is intentionally bounded to ±5. */
export function calculateResearchPriority(input: ResearchPriorityInput): ResearchPriorityResult {
  const now = input.now ?? new Date()
  const due = input.dueAt ? new Date(input.dueAt) : null
  const days = due && Number.isFinite(due.getTime()) ? (due.getTime() - now.getTime()) / 86_400_000 : null
  const deadline = days === null ? 0 : days <= 0 ? 18 : days <= 2 ? 15 : days <= 7 ? 10 : days <= 14 ? 5 : 0
  const evidence = input.evidenceState === 'missing' ? 18 : input.evidenceState === 'conflicting' ? 16 : input.evidenceState === 'partial' ? 8 : 0
  const citation = input.citationState === 'missing' ? 12 : input.citationState === 'unverified' ? 6 : 0
  const quality = input.sourceQuality == null ? 0 : Math.round((1 - clamp(input.sourceQuality, 0, 1)) * 6)
  const factors: PriorityFactors = {
    pinned: input.pinned ? 100 : 0,
    blocker: input.blocksVerification ? 30 : 0,
    deadline,
    evidence,
    requirement: input.requirementUncovered ? 14 : 0,
    citation,
    quality,
    centrality: Math.round(clamp(input.documentCentrality ?? 0, 0, 1) * 10),
    aiAdjustment: clamp(Math.round(input.aiRelevanceAdjustment ?? 0), -5, 5),
  }
  const labels: Array<[keyof PriorityFactors, string]> = [
    ['pinned', 'Pinned by you'], ['blocker', 'Verification blocker'], ['deadline', 'Deadline proximity'],
    ['evidence', 'Evidence state'], ['requirement', 'Requirement coverage'], ['citation', 'Citation metadata'],
    ['quality', 'Source quality uncertainty'], ['centrality', 'Document centrality'], ['aiAdjustment', 'AI relevance adjustment'],
  ]
  return {
    score: Object.values(factors).reduce((sum, value) => sum + value, 0),
    factors,
    explanation: labels.filter(([key]) => factors[key] !== 0).map(([key, label]) => `${label}: ${factors[key] > 0 ? '+' : ''}${factors[key]}`),
  }
}

export function sortResearchActions<T extends { id: string; priority: number; pinned: boolean; createdAt: string }>(actions: T[]): T[] {
  return [...actions].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.priority - a.priority || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
}
