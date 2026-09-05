import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/auth-supabase'
import {
  assertActiveOwnedWorkspace,
  assertExpectedRevision,
  assertNestedWorkspace,
  assertOperationAllowed,
  CollaboratorDomainError,
  manualQuestionPlan,
} from '@/lib/research-collaborator'
import { appendAuditEvent } from '@/lib/workspace-server'

export const runtime = 'nodejs'

function text(value: unknown, max = 2_000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function domainError(error: unknown) {
  if (error instanceof CollaboratorDomainError) {
    const status = error.code === 'stale_revision' ? 409 : error.code === 'forbidden_operation' ? 403 : error.code === 'archived_workspace' ? 409 : 400
    return NextResponse.json({ error: error.message, code: error.code }, { status })
  }
  throw error
}

async function ownedWorkspace(req: NextRequest, id: string) {
  const userId = await requireUserId(req)
  const workspace = await db.project.findFirst({
    where: { id, userId },
    select: { id: true, userId: true, archived: true, deletedAt: true },
  })
  assertActiveOwnedWorkspace(workspace, userId)
  return { userId, workspace }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertOperationAllowed('investigation_plan')
    const { id } = await params
    await ownedWorkspace(req, id)
    const context = await db.researchContext.findUnique({
      where: { projectId: id },
      include: { questions: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] } },
    })
    return NextResponse.json({ context, questions: context?.questions ?? [] })
  } catch (error) {
    return domainError(error)
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertOperationAllowed('investigation_plan')
    const { id } = await params
    const { userId, workspace } = await ownedWorkspace(req, id)
    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const action = text(body.action, 40) || 'save'
    const existing = await db.researchContext.findUnique({ where: { projectId: id } })

    if (action === 'propose') {
      const topic = text(body.topic, 500) || existing?.topic || ''
      if (!topic) return NextResponse.json({ error: 'Add a topic before asking for a question plan.' }, { status: 400 })
      return NextResponse.json({ proposal: manualQuestionPlan(topic, text(body.purpose, 2_000) || existing?.purpose), source: 'manual_template' })
    }
    if (action !== 'save') return NextResponse.json({ error: 'action must be save or propose' }, { status: 400 })

    const topic = text(body.topic, 500)
    const purpose = text(body.purpose)
    const existingUnderstanding = text(body.existingUnderstanding)
    const scope = text(body.scope)
    const selectedQuestionId = typeof body.selectedQuestionId === 'string' ? body.selectedQuestionId : null
    const expectedRevision = typeof body.expectedRevision === 'number' ? body.expectedRevision : undefined

    if (!existing && !topic) return NextResponse.json({ error: 'Add a topic to start an investigation.' }, { status: 400 })
    if (selectedQuestionId) {
      const selected = await db.researchQuestion.findFirst({ where: { id: selectedQuestionId, projectId: id } })
      assertNestedWorkspace(id, selected?.projectId)
    }

    const context = await db.$transaction(async (tx) => {
      if (existing) {
        if (expectedRevision !== undefined) assertExpectedRevision(expectedRevision, existing.revision)
        const updated = await tx.researchContext.update({
          where: { id: existing.id },
          data: {
            topic: topic || existing.topic,
            purpose: purpose || null,
            existingUnderstanding: existingUnderstanding || null,
            scope: scope || null,
            selectedQuestionId,
            revision: { increment: 1 },
          },
        })
        await appendAuditEvent(tx, { projectId: id, userId, type: 'research_context_updated', actor: 'student', payload: { contextId: updated.id, revision: updated.revision } })
        return updated
      }
      const created = await tx.researchContext.create({
        data: { projectId: workspace.id, topic, purpose: purpose || null, existingUnderstanding: existingUnderstanding || null, scope: scope || null },
      })
      await appendAuditEvent(tx, { projectId: id, userId, type: 'research_context_created', actor: 'student', payload: { contextId: created.id } })
      return created
    })
    return NextResponse.json({ context }, { status: existing ? 200 : 201 })
  } catch (error) {
    return domainError(error)
  }
}
