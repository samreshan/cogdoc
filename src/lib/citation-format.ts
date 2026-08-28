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
