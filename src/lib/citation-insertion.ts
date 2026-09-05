import type { ReferenceSummary } from '@/lib/types'
import type { StructuredCitationAttrs } from '@/lib/extensions/citation-node'

export function structuredCitationForReference(reference: ReferenceSummary, locator = ''): StructuredCitationAttrs | null {
  if (!['matched', 'confirmed'].includes(reference.metadataStatus)) return null
  let authors: string[] = []
  try {
    const parsed = JSON.parse(reference.authorsJson) as unknown
    if (Array.isArray(parsed)) authors = parsed.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
  } catch {
    return null
  }
  const family = (author: string) => author.split(/\s+/).at(-1) ?? author
  const lead = family(authors[0] ?? 'Unknown')
  const author = authors.length > 2 ? `${lead} et al.` : authors.length === 2 ? `${lead} & ${family(authors[1])}` : lead
  return {
    referenceId: reference.id,
    title: reference.title ?? reference.rawText,
    author,
    year: reference.year,
    locator: locator.trim() || null,
    verified: true,
    metadataVersion: `${reference.metadataStatus}:${reference.metadataConfidence}`,
  }
}
