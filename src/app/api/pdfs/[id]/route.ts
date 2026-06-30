/**
 * DELETE /api/pdfs/[id] — delete a PDF and all its chunks (cascade).
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  await db.pdf.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
