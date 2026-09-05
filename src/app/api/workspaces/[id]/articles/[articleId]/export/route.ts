import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/auth-supabase'
import { assertActiveOwnedWorkspace, assertOperationAllowed, CollaboratorDomainError } from '@/lib/research-collaborator'

export const runtime = 'nodejs'

function routeError(error: unknown) {
  if (error instanceof CollaboratorDomainError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.code === 'forbidden_operation' ? 403 : 400 })
  throw error
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; articleId: string }> }) {
  try {
    assertOperationAllowed('article_outline')
    const { id: projectId, articleId } = await params
    const userId = await requireUserId(req)
    const project = await db.project.findFirst({ where: { id: projectId, userId }, select: { id: true, userId: true, archived: true, deletedAt: true } })
    assertActiveOwnedWorkspace(project, userId)
    const article = await db.researchArticle.findFirst({
      where: { id: articleId, projectId },
      include: { inputs: { include: { findingRevision: { include: { evidences: { include: { workspaceSource: { include: { source: true } } } } } } } } },
    })
    if (!article) return NextResponse.json({ error: 'Article not found.' }, { status: 404 })
    const references = article.inputs.flatMap((input) => input.findingRevision.evidences.map((evidence) => {
      const title = evidence.workspaceSource?.source.title ?? 'Unlinked source'
      return '- ' + title + (evidence.locatorValue ? ' — ' + evidence.locatorValue : ' — locator unavailable')
    }))
    const body = '# ' + (article.title || 'Untitled research article') + '\n\nStatus: ' + article.status + '\n\n' + article.content + '\n\n## References used by selected findings\n' + (references.length ? Array.from(new Set(references)).join('\n') : '- No linked source locator available.')
    return new NextResponse(body, { headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'Content-Disposition': 'attachment; filename="cogdoc-article.md"' } })
  } catch (error) {
    return routeError(error)
  }
}
