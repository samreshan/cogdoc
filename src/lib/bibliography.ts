import { formatCitation } from '@/lib/citation-format'
import type { CitationStyle } from '@/lib/workspace'

interface CitationDocument { type?: string; attrs?: Record<string, unknown>; content?: CitationDocument[] }

export interface BibliographyMetadata {
  id: string
  title: string
  authors: string[]
  year: string | null
  venue?: string | null
  doi?: string | null
  url: string
  volume?: string | null
  issue?: string | null
  pages?: string | null
  publisher?: string | null
}

export function usedCitationIds(document: CitationDocument): string[] {
  const ids: string[] = []
  const visit = (node: CitationDocument) => {
    if (node.type === 'structuredCitation' && typeof node.attrs?.referenceId === 'string') ids.push(node.attrs.referenceId)
    node.content?.forEach(visit)
  }
  visit(document)
  return [...new Set(ids)]
}

export function generateUsedBibliography(document: CitationDocument, records: BibliographyMetadata[], style: CitationStyle): string[] {
  const byId = new Map(records.map((record) => [record.id, record]))
  return usedCitationIds(document).map((id) => byId.get(id)).filter((record): record is BibliographyMetadata => Boolean(record)).map((record) => formatCitation({
    ...record,
    venue: record.venue ?? null,
    doi: record.doi ?? null,
    volume: record.volume ?? null,
    issue: record.issue ?? null,
    pages: record.pages ?? null,
    publisher: record.publisher ?? null,
  }, style).reference).sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }))
}
