/**
 * POST /api/find-sources
 * Body: { claim, projectId }
 *
 * Searches the internet for evidence related to the claim using the
 * z-ai-web-dev-sdk web_search function. Returns a list of sources with
 * title, URL, snippet, and relevance assessment.
 *
 * This makes Cogdoc a SMART writing assistant — it proactively finds
 * evidence for your claims without you having to manually search.
 */
import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/auth-supabase'

export const runtime = 'nodejs'
export const maxDuration = 45

interface SearchResult {
  title: string
  url: string
  snippet: string
  relevance: 'high' | 'medium' | 'low'
  publishedTime?: string
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
    const zai = await ZAI.create()

    // Step 1: Search the web for evidence related to the claim
    // Construct a research-oriented query from the claim
    const searchQuery = buildSearchQuery(claim)

    let searchResults: any[]
    try {
      const results = await zai.functions.invoke('web_search', {
        query: searchQuery,
        num: 8,
        recency_days: 365, // prefer recent sources
      })
      // The SDK returns results in a specific format — extract the list
      searchResults = extractSearchResults(results)
    } catch (e) {
      console.error('Web search failed:', e)
      return NextResponse.json({
        error: 'Web search failed. The AI provider may not support web_search.',
        detail: (e as Error).message,
      }, { status: 502 })
    }

    if (searchResults.length === 0) {
      return NextResponse.json({
        sources: [],
        message: 'No sources found for this claim.',
      })
    }

    // Step 2: Use the LLM to assess relevance of each source to the claim
    // and classify as supporting / refuting / contextual
    const assessed = await assessRelevance(claim, searchResults)

    return NextResponse.json({
      sources: assessed,
      query: searchQuery,
      totalFound: searchResults.length,
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

/**
 * Extract search results from the SDK response.
 * The format varies by provider — handle common shapes.
 */
function extractSearchResults(results: any): any[] {
  if (!results) return []
  // Shape 1: { data: { results: [...] } }
  if (results.data?.results) return results.data.results
  // Shape 2: { data: [...] }
  if (Array.isArray(results.data)) return results.data
  // Shape 3: { results: [...] }
  if (Array.isArray(results.results)) return results.results
  // Shape 4: direct array
  if (Array.isArray(results)) return results
  // Shape 5: { data: { items: [...] } }
  if (results.data?.items) return results.data.items
  return []
}

/**
 * Use the LLM to assess the relevance of each search result to the claim.
 * Returns sources with a relevance classification and a one-line note.
 */
async function assessRelevance(claim: string, results: any[]): Promise<SearchResult[]> {
  // Build a compact representation of the results for the LLM
  const compact = results.slice(0, 8).map((r, i) => ({
    i,
    title: r.title ?? r.name ?? 'Untitled',
    snippet: (r.snippet ?? r.description ?? r.summary ?? '').slice(0, 300),
    url: r.url ?? r.link ?? r.href ?? '#',
  }))

  const prompt = `You are a research assistant. A writer made the following claim:

"""
${claim}
"""

Here are ${compact.length} web search results. For each one, classify its relevance to the claim as "high", "medium", or "low", and write a one-sentence note explaining what the source says about the claim.

Search results:
${JSON.stringify(compact, null, 2)}

Respond with a JSON array (no markdown, no code fences) where each element is:
{"i": <index>, "relevance": "high"|"medium"|"low", "note": "<one sentence>"}`

  let assessment: Array<{ i: number; relevance: string; note: string }> = []
  try {
    const zai = await ZAI.create()
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: prompt },
        { role: 'user', content: 'Respond now.' },
      ],
      thinking: { type: 'disabled' },
    })
    const raw = completion.choices[0]?.message?.content ?? ''
    // Extract JSON array from the response
    const start = raw.indexOf('[')
    const end = raw.lastIndexOf(']')
    if (start !== -1 && end !== -1) {
      assessment = JSON.parse(raw.slice(start, end + 1))
    }
  } catch (e) {
    console.error('Relevance assessment failed, returning unassessed:', e)
  }

  // Merge assessment back into results
  return compact.map((r) => {
    const a = assessment.find((x) => x.i === r.i)
    return {
      title: r.title,
      url: r.url,
      snippet: a?.note || r.snippet,
      relevance: (a?.relevance as 'high' | 'medium' | 'low') || 'medium',
    }
  })
}
