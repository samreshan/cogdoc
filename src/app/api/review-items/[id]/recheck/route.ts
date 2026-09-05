import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/auth-supabase'
import { appendAuditEvent } from '@/lib/workspace-server'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId(req)
  const { id } = await params
  const item = await db.reviewItem.findFirst({ where: { id, project: { userId } } })
  if (!item) return NextResponse.json({ error: 'Review item not found' }, { status: 404 })
  const reviewItem = await db.$transaction(async (tx) => {
    const updated = await tx.reviewItem.update({ where: { id }, data: { state: 'rechecking' } })
    await appendAuditEvent(tx, {
      projectId: item.projectId,
      userId,
      type: 'review_item_recheck_requested',
      actor: 'student',
      payload: { summary: 'Requested a fresh check after revising the research', reviewItemId: id, itemType: item.type },
    })
    return updated
  })
  return NextResponse.json({ reviewItem, needsReviewRun: true, scope: 'changed_blocks' })
}
