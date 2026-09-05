import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/auth-supabase'
import {
  assertActiveOwnedWorkspace,
  assertExpectedRevision,
  assertNestedWorkspace,
  assertOperationAllowed,
  assertQuestionTree,
  CollaboratorDomainError,
} from '@/lib/research-collaborator'
import { appendAuditEvent } from '@/lib/workspace-server'
import { currentFindingIdsForQuestion, invalidateFindingReviews } from '@/lib/finding-review-invalidation'

export const runtime = 'nodejs'

function text(value: unknown, max = 1_000) { return typeof value === 'string' ? value.trim().slice(0, max) : '' }

function domainError(error: unknown) {
  if (error instanceof CollaboratorDomainError) {
    const status = error.code === 'stale_revision' ? 409 : error.code === 'forbidden_operation' ? 403 : error.code === 'archived_workspace' ? 409 : 400
    return NextResponse.json({ error: error.message, code: error.code }, { status })
  }
  throw error
}

async function owned(req: NextRequest, id: string) {
  const userId = await requireUserId(req)
  const workspace = await db.project.findFirst({ where: { id, userId }, select: { id: true, userId: true, archived: true, deletedAt: true } })
  assertActiveOwnedWorkspace(workspace, userId)
  const context = await db.researchContext.findUnique({ where: { projectId: id } })
  if (!context) throw new CollaboratorDomainError('Start an investigation before adding questions.', 'invalid_state')
  return { userId, workspace, context }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertOperationAllowed('investigation_plan')
    const { id } = await params
    const { context } = await owned(req, id)
    const questions = await db.researchQuestion.findMany({ where: { contextId: context.id }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] })
    return NextResponse.json({ context, questions })
  } catch (error) {
    return domainError(error)
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertOperationAllowed('investigation_plan')
    const { id } = await params
    const { userId, context } = await owned(req, id)
    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const wording = text(body.wording)
    const rationale = text(body.rationale, 2_000)
    const parentId = typeof body.parentId === 'string' && body.parentId ? body.parentId : null
    if (!wording) return NextResponse.json({ error: 'Write a question before saving it.' }, { status: 400 })
    const allQuestions = await db.researchQuestion.findMany({ where: { contextId: context.id }, select: { id: true, parentId: true, projectId: true, sortOrder: true } })
    if (parentId) {
      const parent = allQuestions.find((question) => question.id === parentId)
      assertNestedWorkspace(id, parent?.projectId)
    }
    const sortOrder = allQuestions.reduce((maximum, question) => Math.max(maximum, question.sortOrder), -1) + 1
    const result = await db.$transaction(async (tx) => {
      const created = await tx.researchQuestion.create({ data: { projectId: id, contextId: context.id, parentId, wording, rationale: rationale || null, sortOrder } })
      const updatedContext = await tx.researchContext.update({ where: { id: context.id }, data: { selectedQuestionId: created.id, revision: { increment: 1 } } })
      await appendAuditEvent(tx, { projectId: id, userId, type: 'research_question_created', actor: 'student', payload: { questionId: created.id, parentId, contextRevision: updatedContext.revision } })
      return { question: created, context: updatedContext }
    })
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return domainError(error)
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertOperationAllowed('investigation_plan')
    const { id } = await params
    const { userId, context } = await owned(req, id)
    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const action = text(body.action, 40)
    const expectedRevision = typeof body.expectedRevision === 'number' ? body.expectedRevision : undefined
    if (expectedRevision !== undefined) assertExpectedRevision(expectedRevision, context.revision)

    if (action === 'select') {
      const questionId = typeof body.questionId === 'string' ? body.questionId : null
      if (questionId) {
        const question = await db.researchQuestion.findFirst({ where: { id: questionId, projectId: id, contextId: context.id } })
        assertNestedWorkspace(id, question?.projectId)
      }
      const updated = await db.researchContext.update({ where: { id: context.id }, data: { selectedQuestionId: questionId, revision: { increment: 1 } } })
      return NextResponse.json({ context: updated })
    }

    if (action === 'reorder') {
      const orderedIds = Array.isArray(body.questionIds) ? body.questionIds.filter((value): value is string => typeof value === 'string') : []
      const current = await db.researchQuestion.findMany({ where: { contextId: context.id }, select: { id: true } })
      if (orderedIds.length !== current.length || new Set(orderedIds).size !== current.length || current.some((question) => !orderedIds.includes(question.id))) {
        return NextResponse.json({ error: 'Reorder every question in this plan exactly once.' }, { status: 400 })
      }
      await db.$transaction(async (tx) => {
        await Promise.all(orderedIds.map((questionId, sortOrder) => tx.researchQuestion.update({ where: { id: questionId }, data: { sortOrder, revision: { increment: 1 } } })))
        const updatedContext = await tx.researchContext.update({ where: { id: context.id }, data: { revision: { increment: 1 } } })
        await appendAuditEvent(tx, { projectId: id, userId, type: 'research_questions_reordered', actor: 'student', payload: { questionIds: orderedIds, contextRevision: updatedContext.revision } })
      })
      return NextResponse.json({ ok: true })
    }

    const questionId = typeof body.questionId === 'string' ? body.questionId : ''
    const question = await db.researchQuestion.findFirst({ where: { id: questionId, projectId: id, contextId: context.id } })
    assertNestedWorkspace(id, question?.projectId)
    if (!question) return NextResponse.json({ error: 'Question not found.' }, { status: 404 })
    if (typeof body.expectedQuestionRevision === 'number') assertExpectedRevision(body.expectedQuestionRevision, question.revision)

    if (action === 'update') {
      const wording = text(body.wording)
      const rationale = text(body.rationale, 2_000)
      const parentId = typeof body.parentId === 'string' && body.parentId ? body.parentId : null
      const allQuestions = await db.researchQuestion.findMany({ where: { contextId: context.id }, select: { id: true, parentId: true, projectId: true } })
      if (parentId) {
        const parent = allQuestions.find((candidate) => candidate.id === parentId)
        assertNestedWorkspace(id, parent?.projectId)
      }
      assertQuestionTree(new Map(allQuestions.map((candidate) => [candidate.id, candidate.parentId])), question.id, parentId)
      const wordingChanged = Boolean(wording) && wording.trim() !== question.wording.trim()
      const updated = await db.$transaction(async (tx) => {
        const saved = await tx.researchQuestion.update({ where: { id: question.id }, data: { wording: wording || question.wording, rationale: rationale || null, parentId, revision: { increment: 1 } } })
        await tx.researchContext.update({ where: { id: context.id }, data: { revision: { increment: 1 } } })
        if (wordingChanged) {
          const findingIds = await currentFindingIdsForQuestion(tx as never, id, question.id)
          await invalidateFindingReviews(tx as never, { projectId: id, userId, findingIds, reason: 'The meaning of this research question changed.', changed: { kind: 'question', id: question.id } })
        }
        await appendAuditEvent(tx, { projectId: id, userId, type: 'research_question_updated', actor: 'student', payload: { questionId: saved.id, revision: saved.revision } })
        return saved
      })
      return NextResponse.json({ question: updated })
    }

    if (action === 'archive' || action === 'restore' || action === 'park') {
      const state = action === 'archive' ? 'archived' : action === 'park' ? 'parked' : 'open'
      const result = await db.$transaction(async (tx) => {
        const updated = await tx.researchQuestion.update({ where: { id: question.id }, data: { state, revision: { increment: 1 } } })
        const updatedContext = await tx.researchContext.update({ where: { id: context.id }, data: { revision: { increment: 1 } } })
        if (action === 'archive') {
          const findingIds = await currentFindingIdsForQuestion(tx as never, id, question.id)
          await invalidateFindingReviews(tx as never, { projectId: id, userId, findingIds, reason: 'The dependent question was archived and needs reconsideration before reuse.', changed: { kind: 'question', id: question.id } })
        }
        await appendAuditEvent(tx, { projectId: id, userId, type: 'research_question_state_updated', actor: 'student', payload: { questionId: updated.id, state, contextRevision: updatedContext.revision } })
        return { question: updated, context: updatedContext }
      })
      return NextResponse.json(result)
    }
    return NextResponse.json({ error: 'Unsupported question action.' }, { status: 400 })
  } catch (error) {
    return domainError(error)
  }
}
