/**
 * POST /api/find-sources
 * Body: { claim, projectId }
 *
 * Searches the internet for evidence related to the claim using the Gemini
 * generateContent API with the google_search grounding tool. When the Gemini
 * provider is temporarily unavailable or quota-limited, falls back to the
 * public OpenAlex scholarly index so source discovery remains available.
 *
 * This makes Cogdoc a SMART writing assistant — it proactively finds
 * evidence for your claims without you having to manually search.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/auth-supabase'

export const runtime = 'nodejs'
export const maxDuration = 45

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models'

interface SearchResult {
  title: string
  url: string
  snippet: string
  relevance: 'high' | 'medium' | 'low'
  publishedTime?: string
}

interface OpenAlexWork {
  id?: string
  display_name?: string
  doi?: string | null
  publication_date?: string | null
  cited_by_count?: number
  abstract_inverted_index?: Record<string, number[]> | null
  primary_location?: { landing_page_url?: string | null; source?: { display_name?: string | null } | null } | null
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { claim, projectId } = body as { claim: string; projectId?: string }

  if (!claim || claim.trim().length < 10) {
    return NextResponse.json({ error: 'A claim (10+ chars) is required' }, { status: 400 })
  }

  // Verify project ownership (if projectId provided)
  if (projectId) {
    const userId = await requireUserId(req)
    const project = await db.project.findFirst({
      where: { id: projectId, userId },
    })
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  try {
    const searchQuery = buildSearchQuery(claim)

    let sources: SearchResult[]
    let provider: 'gemini' | 'openalex' = 'gemini'
    try {
      sources = await geminiFindSources(claim, searchQuery)
    } catch (e) {
      console.warn('Gemini source search unavailable; trying OpenAlex:', (e as Error).message)
      try {
        sources = await openAlexFindSources(searchQuery)
        provider = 'openalex'
      } catch (fallbackError) {
        console.error('Source search failed:', fallbackError)
        return NextResponse.json({
          error: 'Source search failed. Both Gemini and the scholarly index were unavailable.',
          detail: (fallbackError as Error).message,
        }, { status: 502 })
      }
    }

    if (sources.length === 0) {
      return NextResponse.json({
        sources: [],
        message: 'No sources found for this claim.',
      })
    }

    return NextResponse.json({
      sources,
      query: searchQuery,
      totalFound: sources.length,
      provider,
      ...(provider === 'openalex' ? { message: 'Gemini was unavailable; showing matching scholarly records from OpenAlex.' } : {}),
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
 * No-key academic fallback for source discovery. OpenAlex ranks works by the
 * search query and provides stable DOI or landing-page links. It intentionally
 * returns neutral relevance because it does not infer whether a work proves a
 * particular claim.
 */
export async function openAlexFindSources(query: string): Promise<SearchResult[]> {
  const endpoint = new URL('https://api.openalex.org/works')
  endpoint.searchParams.set('search', query)
  endpoint.searchParams.set('per-page', '8')
  endpoint.searchParams.set('select', 'id,display_name,doi,publication_date,cited_by_count,abstract_inverted_index,primary_location')
  const mailto = process.env.OPENALEX_MAILTO?.trim()
  if (mailto) endpoint.searchParams.set('mailto', mailto)

  const res = await fetch(endpoint, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`OpenAlex search failed: ${res.status}`)

  const data = await res.json() as { results?: OpenAlexWork[] }
  return (data.results ?? [])
    .map((work) => {
      const url = work.doi || work.primary_location?.landing_page_url || work.id
      if (!url || !work.display_name) return null
      return {
        title: work.display_name,
        url,
        snippet: openAlexSnippet(work),
        relevance: 'medium' as const,
      }
    })
    .filter((work): work is SearchResult => work !== null)
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
