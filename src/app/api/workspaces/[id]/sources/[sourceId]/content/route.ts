import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/auth-supabase'
import { readPrivateAsset } from '@/lib/private-storage'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; sourceId: string }> }) {
  const userId = await requireUserId(req)
  const { id, sourceId } = await params
  const linked = await db.workspaceSource.findFirst({ where: { id: sourceId, projectId: id, project: { userId } }, include: { source: true } })
  if (!linked?.source.storageKey || !linked.source.storageProvider) return NextResponse.json({ error: 'Private full text is unavailable' }, { status: 404 })
  const storageScope = linked.source.storageKey.split('/')[0]
  const bytes = await readPrivateAsset(linked.source.storageProvider, linked.source.storageKey, storageScope)
  return new NextResponse(new Uint8Array(bytes), { headers: { 'Content-Type': linked.source.mimeType ?? 'application/pdf', 'Content-Disposition': `inline; filename="${(linked.source.filename ?? 'source.pdf').replace(/["\r\n]/g, '')}"`, 'Cache-Control': 'private, no-store' } })
}
