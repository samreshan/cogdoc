/**
 * DELETE /api/pdfs/[id] — delete a PDF and all its chunks (cascade).
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/auth-supabase'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const userId = await requireUserId(req)
  const pdf = await db.pdf.findFirst({ where: { id, userId } })
  if (!pdf) return NextResponse.json({ error: 'Source not found' }, { status: 404 })
  await db.pdf.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
