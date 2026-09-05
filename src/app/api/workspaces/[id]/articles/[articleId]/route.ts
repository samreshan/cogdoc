import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/auth-supabase'
import { assertActiveOwnedWorkspace, assertOperationAllowed, CollaboratorDomainError } from '@/lib/research-collaborator'
import { appendAuditEvent } from '@/lib/workspace-server'

export const runtime = 'nodejs'

function text(value: unknown, max = 50_000) { return typeof value === 'string' ? value.trim().slice(0, max) : '' }
function routeError(error: unknown) {
  if (error instanceof CollaboratorDomainError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.code === 'forbidden_operation' ? 403 : 400 })
  throw error
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; articleId: string }> }) {
  try {
    assertOperationAllowed('article_outline')
    const { id: projectId, articleId } = await params
    const userId = await requireUserId(req)
    const project = await db.project.findFirst({ where: { id: projectId, userId }, select: { id: true, userId: true, archived: true, deletedAt: true } })
    assertActiveOwnedWorkspace(project, userId)
    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const content = text(body.content)
    if (!content) return NextResponse.json({ error: 'Write article content before saving it.' }, { status: 400 })
    const existing = await db.researchArticle.findFirst({ where: { id: articleId, projectId } })
    if (!existing) return NextResponse.json({ error: 'Article not found.' }, { status: 404 })
    const article = await db.$transaction(async (tx) => {
      const updated = await tx.researchArticle.update({ where: { id: articleId }, data: { content, revision: { increment: 1 }, status: 'review_needed' } })
      await appendAuditEvent(tx, { projectId, userId, type: 'research_article_edited', actor: 'student', payload: { articleId, revision: updated.revision, reason: 'Human editing requires claim-to-finding mapping review.' } })
      return updated
    })
    return NextResponse.json({ article, warning: 'Review source mappings and uncertainty before treating this edited article as ready to export.' })
  } catch (error) {
    return routeError(error)
  }
}
