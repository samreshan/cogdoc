import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/auth-supabase'
import { appendAuditEvent } from '@/lib/workspace-server'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId(req)
  const { id } = await params
  const workspace = await db.project.findFirst({ where: { id, userId }, select: { id: true } })
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  const references = await db.reference.findMany({
    where: { projectId: id },
    orderBy: { createdAt: 'asc' },
    include: { source: { select: { id: true, filename: true } } },
  })
  return NextResponse.json({ references })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId(req)
  const { id } = await params
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 500) : ''
  const url = typeof body.url === 'string' ? body.url.trim().slice(0, 2_000) : ''
  if (!title || !url) {
    return NextResponse.json({ error: 'A source title and URL are required' }, { status: 400 })
  }
  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('unsupported protocol')
  } catch {
    return NextResponse.json({ error: 'A valid HTTP(S) source URL is required' }, { status: 400 })
  }

  const workspace = await db.project.findFirst({ where: { id, userId, deletedAt: null }, select: { id: true, citationStyle: true } })
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  const doi = typeof body.doi === 'string'
    ? body.doi.trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '').toLowerCase().slice(0, 500) || null
    : null
  const authors = Array.isArray(body.authors)
    ? body.authors.filter((author): author is string => typeof author === 'string').map((author) => author.trim().slice(0, 200)).filter(Boolean).slice(0, 50)
    : []
  const existing = await db.reference.findFirst({
    where: { projectId: id, OR: [...(doi ? [{ doi }] : []), { url }] },
    include: { source: { select: { id: true, filename: true } } },
  })
  if (existing) return NextResponse.json({ reference: existing, alreadySaved: true })

  const year = typeof body.year === 'string' ? body.year.trim().slice(0, 20) || null : null
  const venue = typeof body.venue === 'string' ? body.venue.trim().slice(0, 500) || null : null
  const provider = body.provider === 'openalex' || body.provider === 'gemini' ? body.provider : null
  const style = body.style === 'apa' || body.style === 'harvard' ? body.style : workspace.citationStyle
  const rawText = typeof body.rawText === 'string' && body.rawText.trim()
    ? body.rawText.trim().slice(0, 5_000)
    : [authors.join(', '), year ? `(${year})` : '', title, venue, doi ? `https://doi.org/${doi}` : url].filter(Boolean).join('. ')

  const reference = await db.$transaction(async (tx) => {
    const saved = await tx.reference.create({
      data: {
        projectId: id,
        rawText,
        style,
        authorsJson: JSON.stringify(authors),
        year,
        title,
        doi,
        url,
        metadataStatus: 'unverified',
        metadataJson: JSON.stringify({ provider, venue, savedFromDiscovery: true }),
      },
      include: { source: { select: { id: true, filename: true } } },
    })
    await appendAuditEvent(tx, {
      projectId: id,
      userId,
      type: 'reference_saved',
      payload: { referenceId: saved.id, doi, url, provider },
    })
    return saved
  })

  return NextResponse.json({ reference, alreadySaved: false }, { status: 201 })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId(req)
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const referenceId = String(body.referenceId ?? '')
  const reference = await db.reference.findFirst({ where: { id: referenceId, projectId: id, project: { userId } } })
  if (!reference) return NextResponse.json({ error: 'Reference not found' }, { status: 404 })
  if (body.sourceId) {
    const source = await db.pdf.findFirst({ where: { id: String(body.sourceId), projectId: id, userId } })
    if (!source) return NextResponse.json({ error: 'Source not found' }, { status: 404 })
  }
  const updated = await db.$transaction(async (tx) => {
    const saved = await tx.reference.update({
      where: { id: referenceId },
      data: {
        sourceId: body.sourceId === null ? null : body.sourceId ? String(body.sourceId) : undefined,
        metadataStatus: body.confirmMetadata === true ? 'confirmed' : undefined,
        title: typeof body.title === 'string' ? body.title.trim() || null : undefined,
        year: typeof body.year === 'string' ? body.year.trim() || null : undefined,
        doi: typeof body.doi === 'string' ? body.doi.trim() || null : undefined,
      },
    })
    await appendAuditEvent(tx, { projectId: id, userId, type: 'reference_updated', payload: { referenceId, sourceId: body.sourceId ?? null, confirmed: body.confirmMetadata === true } })
    return saved
  })
  return NextResponse.json({ reference: updated })
}
