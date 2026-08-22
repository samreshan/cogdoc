import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/auth-supabase'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId(req)
  const { id } = await params
  const reviewRun = await db.reviewRun.findFirst({
    where: { id, project: { userId } },
    include: { items: { orderBy: [{ severity: 'asc' }, { createdAt: 'asc' }] } },
  })
  if (!reviewRun) return NextResponse.json({ error: 'Review run not found' }, { status: 404 })
  return NextResponse.json({ reviewRun })
}
