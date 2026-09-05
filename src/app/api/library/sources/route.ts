import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/auth-supabase'

export async function GET(req: NextRequest) {
  const userId = await requireUserId(req)
  const sources = await db.librarySource.findMany({ where: { userId }, include: { _count: { select: { workspaces: true } } }, orderBy: { updatedAt: 'desc' } })
  return NextResponse.json({ sources: sources.map(({ storageKey: _storageKey, storageProvider: _storageProvider, ...source }) => source) })
}

export async function DELETE(req: NextRequest) {
  const userId = await requireUserId(req)
  const body = await req.json().catch(() => ({}))
  const source = await db.librarySource.findFirst({ where: { id: String(body.sourceId ?? ''), userId }, include: { _count: { select: { workspaces: true } } } })
  if (!source) return NextResponse.json({ error: 'Library source not found' }, { status: 404 })
  if (source._count.workspaces > 0) return NextResponse.json({ error: 'Detach this source from every workspace before deleting it from the private library', workspaceCount: source._count.workspaces }, { status: 409 })
  await db.librarySource.delete({ where: { id: source.id } })
  return NextResponse.json({ ok: true, privateFileCleanup: source.storageKey ? 'retained_for_storage_retention_job' : 'not_applicable' })
}
