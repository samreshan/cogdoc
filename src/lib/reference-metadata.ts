import type { ParsedReference } from '@/lib/review-engine'

export interface NormalizedReferenceMetadata {
  provider: 'crossref' | 'datacite'
  doi: string
  title: string | null
  year: string | null
  authors: string[]
  url: string | null
  raw: unknown
}

async function fetchJson(url: string): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5_000)
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': `Cogdoc/1.0 (mailto:${process.env.CROSSREF_MAILTO ?? 'admin@example.invalid'})` },
      cache: 'no-store',
    })
  } finally {
    clearTimeout(timeout)
  }
}

function firstYear(parts: Array<Array<number>> | undefined): string | null {
  return parts?.[0]?.[0] ? String(parts[0][0]) : null
}

export async function lookupReferenceMetadata(reference: ParsedReference): Promise<NormalizedReferenceMetadata | null> {
  if (!reference.doi) {
    const query = [reference.authors.join(' '), reference.year, reference.title, reference.rawText].filter(Boolean).join(' ')
    try {
      const response = await fetchJson(`https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(query)}&rows=3`)
      if (!response.ok) return null
      const json = await response.json() as { message?: { items?: Array<Record<string, unknown>> } }
      const candidates = (json.message?.items ?? [])
        .map((item) => crossrefMetadata(item))
        .filter((item): item is NormalizedReferenceMetadata => Boolean(item))
      return candidates.sort((a, b) => metadataConfidence(reference, b) - metadataConfidence(reference, a))[0] ?? null
    } catch { return null }
  }
  const doi = reference.doi.toLowerCase()
  try {
    const crossref = await fetchJson(`https://api.crossref.org/works/${encodeURIComponent(doi)}`)
    if (crossref.ok) {
      const json = await crossref.json() as { message?: Record<string, unknown> }
      const message = json.message ?? {}
      return crossrefMetadata(message, doi)
    }
    const datacite = await fetchJson(`https://api.datacite.org/dois/${encodeURIComponent(doi)}`)
    if (!datacite.ok) return null
    const json = await datacite.json() as { data?: { attributes?: Record<string, unknown> } }
    const attrs = json.data?.attributes ?? {}
    const creators = Array.isArray(attrs.creators) ? attrs.creators as Array<{ familyName?: string; name?: string }> : []
    const titles = Array.isArray(attrs.titles) ? attrs.titles as Array<{ title?: string }> : []
    return {
      provider: 'datacite', doi,
      title: titles[0]?.title ?? null,
      year: attrs.publicationYear ? String(attrs.publicationYear) : null,
      authors: creators.map((creator) => creator.familyName ?? creator.name ?? '').filter(Boolean),
      url: typeof attrs.url === 'string' ? attrs.url : `https://doi.org/${doi}`,
      raw: attrs,
    }
  } catch {
    return null
  }
}

function crossrefMetadata(message: Record<string, unknown>, fallbackDoi = ''): NormalizedReferenceMetadata | null {
  const doi = typeof message.DOI === 'string' ? message.DOI.toLowerCase() : fallbackDoi
  if (!doi) return null
  const authors = Array.isArray(message.author)
    ? (message.author as Array<{ family?: string; name?: string }>).map((author) => author.family ?? author.name ?? '').filter(Boolean)
    : []
  const issued = message.issued as { 'date-parts'?: Array<Array<number>> } | undefined
  return {
    provider: 'crossref', doi,
    title: Array.isArray(message.title) ? String(message.title[0] ?? '') || null : null,
    year: firstYear(issued?.['date-parts']), authors,
    url: typeof message.URL === 'string' ? message.URL : `https://doi.org/${doi}`,
    raw: message,
  }
}

function words(value: string | null): Set<string> {
  return new Set((value ?? '').toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 3))
}

export function metadataConfidence(reference: ParsedReference, metadata: NormalizedReferenceMetadata): number {
  const expected = words(reference.title)
  const actual = words(metadata.title)
  const overlap = [...expected].filter((word) => actual.has(word)).length
  const titleScore = expected.size ? overlap / expected.size : 0.5
  const yearScore = !reference.year || !metadata.year ? 0.5 : reference.year.slice(0, 4) === metadata.year ? 1 : 0
  const authorExpected = reference.authors[0]?.toLowerCase()
  const authorScore = !authorExpected ? 0.5 : metadata.authors.some((author) => author.toLowerCase().includes(authorExpected)) ? 1 : 0
  return Number((titleScore * 0.6 + yearScore * 0.2 + authorScore * 0.2).toFixed(3))
}
