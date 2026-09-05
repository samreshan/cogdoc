import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/auth-supabase'
import { assertActiveOwnedWorkspace, assertOperationAllowed, CollaboratorDomainError } from '@/lib/research-collaborator'
import { findingArticleEligibility } from '@/lib/finding-review'

export const runtime = 'nodejs'

function routeError(error: unknown) {
  if (error instanceof CollaboratorDomainError) {
    const status = error.code === 'forbidden_operation' ? 403 : error.code === 'archived_workspace' ? 409 : 400
    return NextResponse.json({ error: error.message, code: error.code }, { status })
  }
  throw error
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertOperationAllowed('article_outline')
    const { id: projectId } = await params
    const userId = await requireUserId(req)
    const project = await db.project.findFirst({ where: { id: projectId, userId }, select: { id: true, userId: true, archived: true, deletedAt: true } })
    assertActiveOwnedWorkspace(project, userId)
    const findings = await db.researchFinding.findMany({
      where: { projectId },
      include: {
        question: { select: { wording: true } },
        revisions: {
          orderBy: { revision: 'desc' },
          take: 1,
          include: { reviews: { orderBy: { createdAt: 'desc' }, take: 1, select: { decision: true } } },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })
    const candidates = findings.map((finding) => {
      const revision = finding.revisions[0]
      const eligibility = revision ? findingArticleEligibility({
        reviewState: finding.reviewState as 'draft' | 'review_needed' | 'reviewed' | 'archived',
        findingRevision: revision.revision,
        currentRevision: finding.currentRevision,
        latestDecision: revision.reviews[0]?.decision,
      }) : { eligible: false, reason: 'This finding has no current revision.' }
      return {
        findingId: finding.id,
        findingRevisionId: revision?.id ?? null,
        question: finding.question.wording,
        label: revision?.conclusion || 'Untitled finding',
        uncertainty: revision?.uncertainty ?? null,
        eligible: eligibility.eligible,
        reason: eligibility.reason,
      }
    })
    return NextResponse.json({ candidates })
  } catch (error) {
    return routeError(error)
  }
}
