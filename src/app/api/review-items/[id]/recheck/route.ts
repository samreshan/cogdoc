import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/auth-supabase'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId(req)
  const { id } = await params
  const item = await db.reviewItem.findFirst({ where: { id, project: { userId } } })
  if (!item) return NextResponse.json({ error: 'Review item not found' }, { status: 404 })
  const reviewItem = await db.reviewItem.update({ where: { id }, data: { state: 'rechecking' } })
  return NextResponse.json({ reviewItem, needsReviewRun: true, scope: 'changed_blocks' })
}

