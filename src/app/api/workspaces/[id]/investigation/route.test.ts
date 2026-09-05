import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => {
  const models = {
    project: { findFirst: vi.fn() },
    researchContext: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    researchQuestion: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    auditEvent: { findFirst: vi.fn(), create: vi.fn() },
  }
  return { db: { ...models, $transaction: vi.fn(async (callback: (tx: typeof models) => unknown) => callback(models)) } }
})
vi.mock('@/lib/auth-supabase', () => ({ requireUserId: vi.fn(async () => 'user-1') }))

import { GET, POST } from './route'
import { db } from '@/lib/db'
import { makeReq } from '@/app/api/_test-helpers'

const project = db.project.findFirst as ReturnType<typeof vi.fn>
const context = db.researchContext

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('COGDOC_RESEARCH_COLLABORATOR', 'investigation')
  project.mockResolvedValue({ id: 'workspace-1', userId: 'user-1', archived: false, deletedAt: null })
  ;(db.auditEvent.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null)
  ;(db.auditEvent.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'audit-1' })
})

afterEach(() => vi.unstubAllEnvs())

describe('research collaborator investigation route', () => {
  it('creates a saved investigation from a concise topic and explicit uncertainty', async () => {
    context.findUnique.mockResolvedValue(null)
    context.create.mockResolvedValue({ id: 'context-1', projectId: 'workspace-1', topic: 'Urban heat', existingUnderstanding: 'Not sure yet', revision: 0 })
    const response = await POST(makeReq({ topic: 'Urban heat', existingUnderstanding: 'Not sure yet' }), { params: Promise.resolve({ id: 'workspace-1' }) })
    expect(response.status).toBe(201)
    expect(context.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ topic: 'Urban heat', existingUnderstanding: 'Not sure yet' }) }))
  })

  it('offers a no-provider editable plan proposal without creating prose', async () => {
    context.findUnique.mockResolvedValue(null)
    const response = await POST(makeReq({ action: 'propose', topic: 'Urban heat', purpose: 'Understand local effects' }), { params: Promise.resolve({ id: 'workspace-1' }) })
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.source).toBe('manual_template')
    expect(body.proposal).toHaveLength(3)
    expect(JSON.stringify(body.proposal)).not.toContain('draft')
  })

  it('rejects an old context revision without overwriting the newer plan', async () => {
    context.findUnique.mockResolvedValue({ id: 'context-1', projectId: 'workspace-1', topic: 'Urban heat', revision: 3 })
    const response = await POST(makeReq({ topic: 'Urban heat', expectedRevision: 2 }), { params: Promise.resolve({ id: 'workspace-1' }) })
    expect(response.status).toBe(409)
    expect(context.update).not.toHaveBeenCalled()
  })

  it('returns the saved context and ordered questions after reload', async () => {
    context.findUnique.mockResolvedValue({ id: 'context-1', topic: 'Urban heat', questions: [{ id: 'q1', sortOrder: 0 }, { id: 'q2', sortOrder: 1 }] })
    const response = await GET(makeReq({}), { params: Promise.resolve({ id: 'workspace-1' }) })
    expect(response.status).toBe(200)
    expect((await response.json()).questions.map((question: { id: string }) => question.id)).toEqual(['q1', 'q2'])
  })
})
