import { Cite } from '@citation-js/core'
import '@citation-js/plugin-csl'
import type { CitationStyle } from '@/lib/workspace'

export interface CitationMetadataInput {
  title: string
  authors: string[]
  year: string | null
  venue: string | null
  doi: string | null
  url: string
  volume?: string | null
  issue?: string | null
  pages?: string | null
  publisher?: string | null
}

export interface FormattedCitation {
  reference: string
  inText: string
  style: CitationStyle
  processor: 'citation-js/citeproc-js'
}

export interface StoredReferenceCitationInput {
  title: string | null
  authorsJson: string
  year: string | null
  doi: string | null
  url: string | null
  metadataJson?: string | null
}

const FAMILY_PARTICLES = new Set(['da', 'de', 'del', 'der', 'di', 'du', 'la', 'le', 'van', 'von'])

export function parseDisplayName(value: string): { family: string; given?: string } {
  const author = value.trim()
  const commaParts = author.split(',').map((part) => part.trim()).filter(Boolean)
  if (commaParts.length > 1) {
    return { family: commaParts[0]!, given: commaParts.slice(1).join(' ') || undefined }
  }
  const parts = author.split(/\s+/).filter(Boolean)
  if (parts.length < 2) return { family: author }
  let familyStart = parts.length - 1
  while (familyStart > 0 && FAMILY_PARTICLES.has(parts[familyStart - 1]!.toLowerCase())) familyStart -= 1
  return {
    family: parts.slice(familyStart).join(' '),
    given: parts.slice(0, familyStart).join(' ') || undefined,
  }
}

function normalizedDoi(value: string | null): string | undefined {
  const doi = value?.trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')
  return doi || undefined
}

function cleanOutput(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

/** Render a bibliography entry and an in-text citation through CSL. */
export function formatCitation(metadata: CitationMetadataInput, style: CitationStyle): FormattedCitation {
  const doi = normalizedDoi(metadata.doi)
  const year = metadata.year?.match(/\d{4}/)?.[0]
  const item = {
    id: doi || metadata.url || metadata.title,
    type: 'article-journal',
    title: metadata.title,
    author: metadata.authors.map(parseDisplayName),
    ...(year ? { issued: { 'date-parts': [[Number(year)]] } } : {}),
    ...(metadata.venue ? { 'container-title': metadata.venue } : {}),
    ...(metadata.volume ? { volume: metadata.volume } : {}),
    ...(metadata.issue ? { issue: metadata.issue } : {}),
    ...(metadata.pages ? { page: metadata.pages } : {}),
    ...(metadata.publisher ? { publisher: metadata.publisher } : {}),
    ...(doi ? { DOI: doi } : {}),
    URL: doi ? `https://doi.org/${doi}` : metadata.url,
  }
  const cite = new Cite([item])
  const template = style === 'apa' ? 'apa' : 'harvard1'
  return {
    reference: cleanOutput(cite.format('bibliography', { format: 'text', template, lang: 'en-US' })),
    inText: cleanOutput(cite.format('citation', { format: 'text', template, lang: 'en-US' })),
    style,
    processor: 'citation-js/citeproc-js',
  }
}

/** Re-render a saved metadata-backed reference when its workspace style changes. */
export function formatStoredReference(
  reference: StoredReferenceCitationInput,
  style: CitationStyle,
): FormattedCitation | null {
  if (!reference.title || (!reference.url && !reference.doi)) return null
  let authors: string[] = []
  try {
    const parsed = JSON.parse(reference.authorsJson) as unknown
    if (Array.isArray(parsed)) {
      authors = parsed.filter((author): author is string => typeof author === 'string' && Boolean(author.trim()))
    }
  } catch { /* malformed legacy metadata requires manual review */ }

  let metadata: Record<string, unknown> = {}
  try {
    const parsed = JSON.parse(reference.metadataJson ?? '{}') as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) metadata = parsed as Record<string, unknown>
  } catch { /* metadata is optional */ }
  const raw = metadata.raw && typeof metadata.raw === 'object' && !Array.isArray(metadata.raw)
    ? metadata.raw as Record<string, unknown>
    : {}
  const containerTitle = Array.isArray(raw['container-title'])
    ? raw['container-title'].find((value): value is string => typeof value === 'string' && Boolean(value.trim()))
    : null
  const venue = typeof metadata.venue === 'string'
    ? metadata.venue.trim() || null
    : containerTitle?.trim() || null
  const stringValue = (key: string, rawKeys: string[] = [key]): string | null => {
    if (typeof metadata[key] === 'string') return metadata[key].trim() || null
    for (const rawKey of rawKeys) {
      const value = raw[rawKey]
      if (typeof value === 'string') return value.trim() || null
      if (Array.isArray(value)) {
        const first = value.find((item): item is string => typeof item === 'string' && Boolean(item.trim()))
        if (first) return first.trim()
      }
    }
    return null
  }

  return formatCitation({
    title: reference.title,
    authors,
    year: reference.year,
    venue,
    doi: reference.doi,
    url: reference.url ?? `https://doi.org/${reference.doi}`,
    volume: stringValue('volume'),
    issue: stringValue('issue'),
    pages: stringValue('pages', ['page', 'pages']),
    publisher: stringValue('publisher'),
  }, style)
}
