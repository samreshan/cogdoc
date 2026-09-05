import type { ResearchAction, ReviewItem } from '@/lib/types'

export function documentAnchorQuote(anchorJson: string | null | undefined): string | null {
  if (!anchorJson) return null
  try {
    const anchor = JSON.parse(anchorJson) as Record<string, unknown>
    for (const key of ['quote', 'exact', 'text', 'selectedText']) {
      const value = anchor[key]
      if (typeof value === 'string' && value.trim().length >= 5) return value.trim()
    }
  } catch {
    return null
  }
  return null
}

export function quoteForResearchAction(action: ResearchAction): string | null {
  return documentAnchorQuote(action.documentAnchorJson)
}

export function quoteForReviewItem(item: ReviewItem): string | null {
  return documentAnchorQuote(item.anchorJson)
}
