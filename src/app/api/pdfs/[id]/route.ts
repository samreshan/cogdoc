/**
 * DELETE /api/pdfs/[id] — delete a PDF and all its chunks (cascade).
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/auth-supabase'
import { appendAuditEvent } from '@/lib/workspace-server'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const userId = await requireUserId(req)
  const pdf = await db.pdf.findFirst({ where: { id, userId } })
  if (!pdf) return NextResponse.json({ error: 'Source not found' }, { status: 404 })
  await db.$transaction(async (tx) => {
    await tx.pdf.delete({ where: { id } })
    await appendAuditEvent(tx, { projectId: pdf.projectId, userId, type: 'source_deleted', actor: 'student', payload: { summary: `Deleted source: ${pdf.filename}`, sourceId: pdf.id, filename: pdf.filename } })
  })
  return NextResponse.json({ ok: true })
}
