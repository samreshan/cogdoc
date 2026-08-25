/**
 * POST /api/find-sources
 * Body: { claim, projectId }
 *
 * Searches the internet for evidence related to the claim using the Gemini
 * generateContent API with the google_search grounding tool (same
 * GEMINI_API_KEY as the engines and embeddings). Returns a list of sources
 * with title, URL, snippet, and relevance assessment — search and relevance
 * assessment happen in a single grounded call.
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
    try {
      sources = await geminiFindSources(claim, searchQuery)
    } catch (e) {
      console.error('Web search failed:', e)
      return NextResponse.json({
        error: 'Web search failed. The AI provider may not support search grounding.',
        detail: (e as Error).message,
      }, { status: 502 })
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
  const model = process.env.GEMINI_MODEL ?? 'gemini-3.1-flash-lite'

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
