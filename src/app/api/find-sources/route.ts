/**
 * POST /api/find-sources
 * Body: { claim, projectId }
 *
 * Searches OpenAlex and then Crossref before considering Gemini grounding.
 * DOI-bearing results can be enriched with a legal open-access location from
 * Unpaywall. Research discovery therefore remains useful when the LLM quota is
 * exhausted, while every result exposes its metadata and access provenance.
 *
 * This makes Cogdoc a SMART writing assistant — it proactively finds
 * evidence for your claims without you having to manually search.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/auth-supabase'
import { formatCitation, type FormattedCitation } from '@/lib/citation-format'
import type { CitationStyle } from '@/lib/workspace'

export const runtime = 'nodejs'
export const maxDuration = 45

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models'
const UNPAYWALL_CACHE_TTL_MS = 6 * 60 * 60 * 1000
const UNPAYWALL_CACHE_LIMIT = 1_000

type RecordProvider = 'openalex' | 'crossref' | 'gemini'
type OpenAccessProvider = 'openalex' | 'unpaywall'

interface SearchResult {
  title: string
  url: string
  snippet: string
  relevance: 'high' | 'medium' | 'low'
  publishedTime?: string
  recordProvider: RecordProvider
  openAccessUrl?: string | null
  isOpenAccess?: boolean
  openAccessProvider?: OpenAccessProvider | null
  openAccessHostType?: string | null
  openAccessVersion?: string | null
  openAccessLicense?: string | null
  citation?: {
    authors: string[]
    year: string | null
    venue: string | null
    doi: string | null
    volume?: string | null
    issue?: string | null
    pages?: string | null
    publisher?: string | null
    formatted?: FormattedCitation
  }
}

interface OpenAlexWork {
  id?: string
  display_name?: string
  doi?: string | null
  publication_date?: string | null
  cited_by_count?: number
  abstract_inverted_index?: Record<string, number[]> | null
  authorships?: Array<{ author?: { display_name?: string | null } | null }>
  primary_location?: { landing_page_url?: string | null; source?: { display_name?: string | null } | null } | null
  best_oa_location?: {
    landing_page_url?: string | null
    pdf_url?: string | null
    license?: string | null
    version?: string | null
    source?: { host_organization_name?: string | null; type?: string | null } | null
  } | null
  open_access?: { is_oa?: boolean; oa_url?: string | null } | null
  biblio?: { volume?: string | null; issue?: string | null; first_page?: string | null; last_page?: string | null } | null
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { claim, projectId } = body as { claim: string; projectId?: string }

  if (!claim || claim.trim().length < 10) {
    return NextResponse.json({ error: 'A claim (10+ chars) is required' }, { status: 400 })
  }

  let citationStyle: CitationStyle = 'harvard'
  // Verify project ownership (if projectId provided)
  if (projectId) {
    const userId = await requireUserId(req)
    const project = await db.project.findFirst({
      where: { id: projectId, userId }, select: { citationStyle: true },
    })
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    citationStyle = project.citationStyle === 'apa' ? 'apa' : 'harvard'
  }

  try {
    const searchQuery = buildSearchQuery(claim)

    let sources: SearchResult[] = []
    let provider: RecordProvider | null = null
    let reachableProviders = 0
    const providersTried: RecordProvider[] = []

    const scholarlyProviders: Array<{
      name: Exclude<RecordProvider, 'gemini'>
      search: (query: string) => Promise<SearchResult[]>
    }> = [
      { name: 'openalex', search: openAlexFindSources },
      { name: 'crossref', search: crossrefFindSources },
    ]

    for (const scholarly of scholarlyProviders) {
      providersTried.push(scholarly.name)
      try {
        const matches = await scholarly.search(searchQuery)
        reachableProviders += 1
        if (matches.length > 0) {
          sources = matches
          provider = scholarly.name
          break
        }
      } catch (error) {
        console.warn(`${providerLabel(scholarly.name)} source search unavailable:`, (error as Error).message)
      }
    }

    if (sources.length === 0) {
      providersTried.push('gemini')
      try {
        sources = await geminiFindSources(claim, searchQuery)
        reachableProviders += 1
        if (sources.length > 0) provider = 'gemini'
      } catch (geminiError) {
        if (reachableProviders === 0) {
          console.error('Source search failed:', geminiError)
          return NextResponse.json({
            error: 'Source search failed. OpenAlex, Crossref, and grounded web search were unavailable.',
            detail: (geminiError as Error).message,
            providersTried,
          }, { status: 502 })
        }
        console.warn('Grounded web fallback unavailable:', (geminiError as Error).message)
      }
    }

    if (sources.length === 0) {
      return NextResponse.json({
        sources: [],
        message: 'No sources found for this claim.',
        providersTried,
      })
    }

    const accessEnrichedSources = await enrichWithUnpaywall(sources)
    const formattedSources = accessEnrichedSources.map((source) => {
      if (!source.citation) return source
      try {
        return {
          ...source,
          citation: {
            ...source.citation,
            formatted: formatCitation({
              title: source.title,
              authors: source.citation.authors,
              year: source.citation.year,
              venue: source.citation.venue,
              doi: source.citation.doi,
              url: source.url,
              volume: source.citation.volume,
              issue: source.citation.issue,
              pages: source.citation.pages,
              publisher: source.citation.publisher,
            }, citationStyle),
          },
        }
      } catch (error) {
        console.warn('CSL rendering skipped for source:', source.url, (error as Error).message)
        return source
      }
    })

    return NextResponse.json({
      sources: formattedSources,
      query: searchQuery,
      totalFound: sources.length,
      provider,
      providersTried,
      accessResolver: process.env.UNPAYWALL_EMAIL?.trim() ? 'unpaywall' : null,
      ...(provider === 'crossref' ? { message: 'OpenAlex returned no matches; showing Crossref scholarly records.' } : {}),
      ...(provider === 'gemini' ? { message: 'No scholarly-index match was found; showing grounded web results.' } : {}),
    })
  } catch (e) {
    console.error('Find-sources failed:', e)
    return NextResponse.json({
      error: 'Failed to find sources',
      detail: (e as Error).message,
    }, { status: 500 })
  }
}

/**
 * Free academic source discovery. OpenAlex ranks works by the
 * search query and provides stable DOI or landing-page links. It intentionally
 * returns neutral relevance because it does not infer whether a work proves a
 * particular claim.
 */
export async function openAlexFindSources(query: string): Promise<SearchResult[]> {
  const endpoint = new URL('https://api.openalex.org/works')
  endpoint.searchParams.set('search', query)
  endpoint.searchParams.set('per_page', '8')
  endpoint.searchParams.set('select', 'id,display_name,doi,publication_date,cited_by_count,abstract_inverted_index,authorships,primary_location,best_oa_location,open_access,biblio')
  const apiKey = process.env.OPENALEX_API_KEY?.trim()
  if (apiKey) endpoint.searchParams.set('api_key', apiKey)
  const mailto = process.env.OPENALEX_MAILTO?.trim()
  if (mailto) endpoint.searchParams.set('mailto', mailto)

  const res = await fetch(endpoint, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`OpenAlex search failed: ${res.status}`)

  const data = await res.json() as { results?: OpenAlexWork[] }
  const sources: SearchResult[] = []
  for (const work of data.results ?? []) {
    const url = work.doi || work.primary_location?.landing_page_url || work.id
    if (!url || !work.display_name) continue
    sources.push({
      title: work.display_name,
      url,
      snippet: openAlexSnippet(work),
      relevance: 'medium',
      recordProvider: 'openalex',
      isOpenAccess: Boolean(work.open_access?.is_oa),
      openAccessUrl: work.best_oa_location?.pdf_url
        || work.best_oa_location?.landing_page_url
        || work.open_access?.oa_url
        || null,
      openAccessProvider: work.open_access?.is_oa ? 'openalex' : null,
      openAccessHostType: work.best_oa_location?.source?.type ?? null,
      openAccessVersion: work.best_oa_location?.version ?? null,
      openAccessLicense: work.best_oa_location?.license ?? null,
      citation: {
        authors: (work.authorships ?? []).map((authorship) => authorship.author?.display_name?.trim() ?? '').filter(Boolean),
        year: work.publication_date?.slice(0, 4) ?? null,
        venue: work.primary_location?.source?.display_name?.trim() || null,
        doi: work.doi ?? null,
        volume: work.biblio?.volume ?? null,
        issue: work.biblio?.issue ?? null,
        pages: work.biblio?.first_page
          ? work.biblio.last_page && work.biblio.last_page !== work.biblio.first_page
            ? `${work.biblio.first_page}–${work.biblio.last_page}`
            : work.biblio.first_page
          : null,
      },
    })
  }
  return sources
}

interface CrossrefWork {
  DOI?: string | null
  URL?: string | null
  title?: string[] | null
  abstract?: string | null
  author?: Array<{ given?: string | null; family?: string | null; name?: string | null }> | null
  issued?: { 'date-parts'?: Array<Array<number | null>> } | null
  'published-print'?: { 'date-parts'?: Array<Array<number | null>> } | null
  'published-online'?: { 'date-parts'?: Array<Array<number | null>> } | null
  'container-title'?: string[] | null
  volume?: string | null
  issue?: string | null
  page?: string | null
  publisher?: string | null
  'is-referenced-by-count'?: number | null
}

/** A second, free scholarly metadata index used before any LLM fallback. */
export async function crossrefFindSources(query: string): Promise<SearchResult[]> {
  const endpoint = new URL('https://api.crossref.org/works')
  endpoint.searchParams.set('query.bibliographic', query)
  endpoint.searchParams.set('rows', '8')
  endpoint.searchParams.set('select', [
    'DOI', 'URL', 'title', 'abstract', 'author', 'issued', 'published-print',
    'published-online', 'container-title', 'volume', 'issue', 'page',
    'publisher', 'is-referenced-by-count',
  ].join(','))
  const mailto = process.env.CROSSREF_MAILTO?.trim()
  if (mailto) endpoint.searchParams.set('mailto', mailto)

  const res = await fetch(endpoint, {
    headers: {
      Accept: 'application/json',
      'User-Agent': `Cogdoc/1.0 (${mailto ? `mailto:${mailto}` : 'https://github.com/cogdoc'})`,
    },
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`Crossref search failed: ${res.status}`)

  const data = await res.json() as { message?: { items?: CrossrefWork[] } }
  const sources: SearchResult[] = []
  for (const work of data.message?.items ?? []) {
    const title = work.title?.find((value) => value.trim())?.trim()
    const doi = normalizeDoi(work.DOI)
    const url = doi ? `https://doi.org/${doi}` : validHttpUrl(work.URL)
    if (!title || !url) continue
    const year = crossrefYear(work)
    const authors = (work.author ?? []).map(crossrefAuthorName).filter(Boolean)
    sources.push({
      title,
      url,
      snippet: crossrefSnippet(work, year),
      relevance: 'medium',
      recordProvider: 'crossref',
      ...(year ? { publishedTime: year } : {}),
      isOpenAccess: false,
      openAccessUrl: null,
      openAccessProvider: null,
      citation: {
        authors,
        year,
        venue: work['container-title']?.find((value) => value.trim())?.trim() || null,
        doi,
        volume: work.volume?.trim() || null,
        issue: work.issue?.trim() || null,
        pages: work.page?.trim() || null,
        publisher: work.publisher?.trim() || null,
      },
    })
  }
  return sources
}

function crossrefAuthorName(author: NonNullable<CrossrefWork['author']>[number]): string {
  if (author.name?.trim()) return author.name.trim()
  return [author.given?.trim(), author.family?.trim()].filter(Boolean).join(' ')
}

function crossrefYear(work: CrossrefWork): string | null {
  const date = work['published-print'] ?? work['published-online'] ?? work.issued
  const year = date?.['date-parts']?.[0]?.[0]
  return typeof year === 'number' && Number.isFinite(year) ? String(year) : null
}

function crossrefSnippet(work: CrossrefWork, year: string | null): string {
  const abstract = plainText(work.abstract ?? '').slice(0, 300)
  if (abstract) return abstract
  const details = [
    work['container-title']?.[0]?.trim(),
    year ? `Published ${year}` : null,
    typeof work['is-referenced-by-count'] === 'number'
      ? `${work['is-referenced-by-count']} citations`
      : null,
  ].filter(Boolean)
  return details.join(' · ') || 'Scholarly metadata registered with Crossref.'
}

interface UnpaywallLocation {
  url_for_pdf?: string | null
  url?: string | null
  host_type?: string | null
  version?: string | null
  license?: string | null
}

interface UnpaywallResolution {
  url: string
  hostType: string | null
  version: string | null
  license: string | null
}

const unpaywallCache = new Map<string, { expiresAt: number; resolution: UnpaywallResolution | null }>()

async function enrichWithUnpaywall(sources: SearchResult[]): Promise<SearchResult[]> {
  const email = process.env.UNPAYWALL_EMAIL?.trim()
  if (!email) return sources

  return mapWithConcurrency(sources, 4, async (source) => {
    if (source.openAccessUrl || !source.citation?.doi) return source
    try {
      const resolution = await unpaywallLookup(source.citation.doi, email)
      if (!resolution) return source
      return {
        ...source,
        isOpenAccess: true,
        openAccessUrl: resolution.url,
        openAccessProvider: 'unpaywall' as const,
        openAccessHostType: resolution.hostType,
        openAccessVersion: resolution.version,
        openAccessLicense: resolution.license,
      }
    } catch (error) {
      console.warn('Unpaywall lookup unavailable for DOI:', source.citation.doi, (error as Error).message)
      return source
    }
  })
}

async function unpaywallLookup(doiValue: string, email: string): Promise<UnpaywallResolution | null> {
  const doi = normalizeDoi(doiValue)
  if (!doi) return null
  const now = Date.now()
  const cached = unpaywallCache.get(doi)
  if (cached && cached.expiresAt > now) return cached.resolution

  const endpoint = new URL(`https://api.unpaywall.org/v2/${encodeURIComponent(doi)}`)
  endpoint.searchParams.set('email', email)
  let lastStatus = 0
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const res = await fetch(endpoint, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(6_000),
    })
    lastStatus = res.status
    if (res.status === 404) return rememberUnpaywall(doi, null, now)
    if (res.ok) {
      const data = await res.json() as {
        is_oa?: boolean
        best_oa_location?: UnpaywallLocation | null
        oa_locations?: UnpaywallLocation[] | null
      }
      const location = data.best_oa_location ?? data.oa_locations?.[0] ?? null
      const url = validHttpUrl(location?.url_for_pdf) ?? validHttpUrl(location?.url)
      const resolution = data.is_oa && url ? {
        url,
        hostType: location?.host_type?.trim() || null,
        version: location?.version?.trim() || null,
        license: location?.license?.trim() || null,
      } : null
      return rememberUnpaywall(doi, resolution, now)
    }
    if (attempt === 0 && (res.status === 429 || res.status >= 500)) {
      await new Promise((resolve) => setTimeout(resolve, 250))
      continue
    }
    break
  }
  throw new Error(`Unpaywall lookup failed: ${lastStatus}`)
}

function rememberUnpaywall(
  doi: string,
  resolution: UnpaywallResolution | null,
  now: number,
): UnpaywallResolution | null {
  if (unpaywallCache.size >= UNPAYWALL_CACHE_LIMIT) {
    const oldestKey = unpaywallCache.keys().next().value as string | undefined
    if (oldestKey) unpaywallCache.delete(oldestKey)
  }
  unpaywallCache.set(doi, { expiresAt: now + UNPAYWALL_CACHE_TTL_MS, resolution })
  return resolution
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length)
  let nextIndex = 0
  async function worker() {
    while (nextIndex < values.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await mapper(values[index]!)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, () => worker()))
  return results
}

function normalizeDoi(value: string | null | undefined): string | null {
  const doi = value?.trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')
  return doi || null
}

function validHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : null
  } catch {
    return null
  }
}

function plainText(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function providerLabel(provider: RecordProvider): string {
  if (provider === 'openalex') return 'OpenAlex'
  if (provider === 'crossref') return 'Crossref'
  return 'Gemini'
}

function openAlexSnippet(work: OpenAlexWork): string {
  const abstract = work.abstract_inverted_index
    ? Object.entries(work.abstract_inverted_index)
      .flatMap(([word, positions]) => positions.map((position) => ({ word, position })))
      .sort((a, b) => a.position - b.position)
      .map(({ word }) => word)
      .join(' ')
      .slice(0, 300)
    : ''
  if (abstract) return abstract

  const details = [
    work.primary_location?.source?.display_name,
    work.publication_date ? `Published ${work.publication_date}` : null,
    typeof work.cited_by_count === 'number' ? `${work.cited_by_count} citations` : null,
  ].filter(Boolean)
  return details.join(' · ') || 'Scholarly record indexed by OpenAlex.'
}

/**
 * Build a research-oriented search query from a claim.
 * Strips filler, adds "evidence" and "research" to bias toward academic sources.
 */
function buildSearchQuery(claim: string): string {
  // Remove trailing punctuation
  let q = claim.trim().replace(/[.!?]+$/, '')
  // If the claim is a full sentence, extract the key assertion
  // (remove leading "Research shows that", "Studies show", etc.)
  q = q.replace(/^(research|studies|data|evidence)\s+(shows?|demonstrates?|indicates?|suggests?|proves?)\s+that\s+/i, '')
  // Add research-oriented suffix
  return `${q} research evidence study`
}

interface GeminiSearchResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> }
    groundingMetadata?: {
      groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>
    }
  }>
}

/**
 * One grounded Gemini call: search the web for the claim, assess each hit's
 * relevance, and return up to 8 assessed sources. Falls back to the raw
 * grounding chunks (relevance "medium") when the model's JSON is unparseable,
 * so a formatting hiccup degrades to unassessed sources instead of an error.
 */
async function geminiFindSources(claim: string, query: string): Promise<SearchResult[]> {
  // AI_API_KEY is the documented application-level setting. Keep the
  // provider-specific name for deployments that use it, but accept either so
  // local source search uses the same Gemini credential as the other engines.
  const key = process.env.GEMINI_API_KEY || process.env.AI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY or AI_API_KEY is not set')
  const model = process.env.GEMINI_MODEL ?? 'gemini-3.5-flash-lite'

  const prompt = `You are a research assistant. A writer made the following claim:

"""
${claim}
"""

Search the web for evidence related to this claim (suggested query: "${query}").

Then respond with ONLY a JSON array (no markdown, no code fences) of up to 8 sources you found. Each element must be:
{"title": "<source title>", "url": "<source url>", "snippet": "<one sentence on what the source says about the claim>", "relevance": "high"|"medium"|"low"}`

  const res = await fetch(`${GEMINI_ENDPOINT}/${model}:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      tools: [{ google_search: {} }],
    }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Gemini search failed: ${res.status} ${detail.slice(0, 200)}`)
  }

  const data = (await res.json()) as GeminiSearchResponse
  const cand = data.candidates?.[0]
  const text = cand?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
  const chunks = cand?.groundingMetadata?.groundingChunks ?? []

  const norm = (r: { title?: string; url?: string; snippet?: string; relevance?: string }): SearchResult => ({
    title: r.title || 'Untitled',
    url: r.url || '#',
    snippet: (r.snippet ?? '').slice(0, 300),
    relevance: r.relevance === 'high' || r.relevance === 'low' ? r.relevance : 'medium',
    recordProvider: 'gemini',
  })

  // Prefer the model's assessed JSON list
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start !== -1 && end > start) {
    try {
      const parsed = JSON.parse(text.slice(start, end + 1)) as Array<Record<string, string>>
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.slice(0, 8).map(norm)
      }
    } catch (e) {
      console.error('Relevance assessment unparseable, falling back to grounding chunks:', e)
    }
  }

  // Fallback: raw grounding hits without assessment
  return chunks
    .filter((c) => c.web?.uri)
    .slice(0, 8)
    .map((c) => norm({ title: c.web?.title, url: c.web?.uri }))
}
