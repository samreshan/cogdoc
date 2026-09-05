import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => {
  const models = {
    project: { findFirst: vi.fn() },
    researchContext: { findUnique: vi.fn(), update: vi.fn() },
    researchQuestion: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    researchFinding: { findMany: vi.fn(), updateMany: vi.fn() },
    researchArticle: { updateMany: vi.fn() },
    findingEvidence: { findMany: vi.fn() },
    auditEvent: { findFirst: vi.fn(), create: vi.fn() },
  }
  return { db: { ...models, $transaction: vi.fn(async (callback: (tx: typeof models) => unknown) => callback(models)) } }
})
vi.mock('@/lib/auth-supabase', () => ({ requireUserId: vi.fn(async () => 'user-1') }))

import { PATCH, POST } from './route'
import { db } from '@/lib/db'
import { makeReq } from '@/app/api/_test-helpers'

const project = db.project.findFirst as ReturnType<typeof vi.fn>
const context = db.researchContext
const questions = db.researchQuestion

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('COGDOC_RESEARCH_COLLABORATOR', 'investigation')
  project.mockResolvedValue({ id: 'workspace-1', userId: 'user-1', archived: false, deletedAt: null })
  context.findUnique.mockResolvedValue({ id: 'context-1', projectId: 'workspace-1', revision: 0 })
  context.update.mockResolvedValue({ id: 'context-1', revision: 1 })
  ;(db.researchFinding.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
  ;(db.researchFinding.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 })
  ;(db.researchArticle.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 })
  ;(db.auditEvent.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null)
  ;(db.auditEvent.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'audit-1' })
})

afterEach(() => vi.unstubAllEnvs())

describe('research collaborator question route', () => {
  it('creates a stable question and selects it without a draft gate', async () => {
    questions.findMany.mockResolvedValue([])
    questions.create.mockResolvedValue({ id: 'q1', projectId: 'workspace-1', wording: 'How does urban heat affect sleep?' })
    const response = await POST(makeReq({ wording: 'How does urban heat affect sleep?', rationale: 'Set the scope.' }), { params: Promise.resolve({ id: 'workspace-1' }) })
    const body = await response.json()
    expect(response.status).toBe(201)
    expect(body.context).toMatchObject({ id: 'context-1', revision: 1 })
    expect(questions.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ projectId: 'workspace-1', contextId: 'context-1', sortOrder: 0 }) }))
    expect(context.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ selectedQuestionId: 'q1' }) }))
  })

  it('rejects a parent from another workspace', async () => {
    questions.findMany.mockResolvedValue([{ id: 'foreign-q', projectId: 'workspace-2', parentId: null, sortOrder: 0 }])
    const response = await POST(makeReq({ wording: 'A valid question?', parentId: 'foreign-q' }), { params: Promise.resolve({ id: 'workspace-1' }) })
    expect(response.status).toBe(400)
    expect(questions.create).not.toHaveBeenCalled()
  })

  it('rejects a cycle when branching an existing question', async () => {
    questions.findFirst.mockResolvedValue({ id: 'q1', projectId: 'workspace-1', contextId: 'context-1', parentId: null, wording: 'Question one', revision: 0 })
    questions.findMany.mockResolvedValue([
      { id: 'q1', projectId: 'workspace-1', parentId: null },
      { id: 'q2', projectId: 'workspace-1', parentId: 'q1' },
    ])
    const response = await PATCH(makeReq({ action: 'update', questionId: 'q1', parentId: 'q2' }), { params: Promise.resolve({ id: 'workspace-1' }) })
    expect(response.status).toBe(400)
    expect(questions.update).not.toHaveBeenCalled()
  })

  it('does not expose plan APIs while the feature remains disabled', async () => {
    vi.stubEnv('COGDOC_RESEARCH_COLLABORATOR', '')
    const response = await POST(makeReq({ wording: 'A question?' }), { params: Promise.resolve({ id: 'workspace-1' }) })
    expect(response.status).toBe(403)
  })

  it('invalidates only reviewed finding dependencies when question wording meaningfully changes', async () => {
    questions.findFirst.mockResolvedValue({ id: 'q1', projectId: 'workspace-1', contextId: 'context-1', parentId: null, wording: 'How does heat affect sleep?', revision: 2 })
    questions.findMany.mockResolvedValue([{ id: 'q1', projectId: 'workspace-1', parentId: null }])
    questions.update.mockResolvedValue({ id: 'q1', revision: 3 })
    ;(db.researchFinding.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: 'finding-1' }])
    ;(db.researchFinding.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 })
    ;(db.researchArticle.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 })
    const response = await PATCH(makeReq({ action: 'update', questionId: 'q1', wording: 'How does severe urban heat affect sleep?', expectedQuestionRevision: 2 }), { params: Promise.resolve({ id: 'workspace-1' }) })
    expect(response.status).toBe(200)
    expect(db.researchFinding.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { reviewState: 'review_needed' } }))
    expect(db.researchArticle.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'review_needed' } }))
  })
})
