import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/auth-supabase'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; sourceId: string }> }) {
  const userId = await requireUserId(req)
  const { id, sourceId } = await params
  const linked = await db.workspaceSource.findFirst({ where: { id: sourceId, projectId: id, project: { userId } }, include: { source: true } })
  if (!linked) return NextResponse.json({ error: 'Source not found' }, { status: 404 })
  const legacy = await db.pdf.findFirst({ where: { projectId: id, librarySourceId: linked.librarySourceId }, include: { chunks: { orderBy: { chunkIndex: 'asc' }, select: { id: true, chunkIndex: true, pageApprox: true, content: true } } } })
  await db.workspaceSource.update({ where: { id: linked.id }, data: { lastOpenedAt: new Date() } })
  return NextResponse.json({ workspaceSource: linked, passages: legacy?.chunks ?? [], hasPrivateFile: Boolean(linked.source.storageKey) })
}
