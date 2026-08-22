import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/auth-supabase'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId(req)
  const { id } = await params
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const reviewRun = await db.reviewRun.findFirst({ where: { id, project: { userId } }, include: { _count: { select: { items: true } } } })
      if (!reviewRun) {
        controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ code: 'not_found' })}\n\n`))
      } else {
        controller.enqueue(encoder.encode(`event: progress\ndata: ${JSON.stringify({
          id: reviewRun.id, status: reviewRun.status, progress: reviewRun.progress,
          stage: reviewRun.currentStage, itemCount: reviewRun._count.items,
        })}\n\n`))
        if (reviewRun.status === 'ready' || reviewRun.status === 'failed' || reviewRun.status === 'cancelled') {
          controller.enqueue(encoder.encode(`event: done\ndata: ${JSON.stringify({ status: reviewRun.status })}\n\n`))
        }
      }
      controller.close()
    },
  })
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform' } })
}

