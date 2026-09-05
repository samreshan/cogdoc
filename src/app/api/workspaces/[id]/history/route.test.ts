import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeReq } from '@/app/api/_test-helpers'

const mocks = vi.hoisted(() => ({
  projectFind: vi.fn(),
  auditFind: vi.fn(),
  interventionFind: vi.fn(),
  append: vi.fn(),
  verify: vi.fn(),
}))

vi.mock('@/lib/auth-supabase', () => ({ requireUserId: vi.fn(async () => 'user-1') }))
vi.mock('@/lib/db', () => ({ db: {
  project: { findFirst: mocks.projectFind },
  auditEvent: { findMany: mocks.auditFind },
  intervention: { findMany: mocks.interventionFind },
  $transaction: vi.fn(async (callback: (tx: object) => unknown) => callback({})),
} }))
vi.mock('@/lib/workspace-server', () => ({ appendAuditEvent: mocks.append, verifyAuditChain: mocks.verify }))

import { GET, POST } from './route'

const context = { params: Promise.resolve({ id: 'project-1' }) }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.projectFind.mockResolvedValue({ id: 'project-1' })
  mocks.verify.mockReturnValue(true)
  mocks.auditFind.mockResolvedValue([{
    id: 'audit-1', projectId: 'project-1', userId: 'user-1', type: 'citation_inserted', actor: 'student',
    payloadJson: '{"summary":"Inserted citation: A study"}', documentHash: null, modelVersion: null,
    promptVersion: null, previousHash: null, eventHash: 'sealed', createdAt: new Date('2026-09-01T10:00:00Z'),
  }])
  mocks.interventionFind.mockResolvedValue([{
    id: 'intervention-1', engineType: 'citation', promptText: 'A claim.', responseText: 'What source backs this up?',
    verdict: 'insufficient_evidence', status: 'resolved', userAction: 'engaged', _count: { evidences: 2 },
    createdAt: new Date('2026-09-01T09:00:00Z'), resolvedAt: new Date('2026-09-01T10:00:00Z'),
  }])
  mocks.append.mockResolvedValue({ id: 'audit-2', type: 'research_structure_accepted', createdAt: new Date('2026-09-01T11:00:00Z') })
})

describe('project history API', () => {
  it('returns sealed decisions and the complete intervention lifecycle', async () => {
    const response = await GET(makeReq({}), context)
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.integrity).toBe('verified')
    expect(body.events[0]).toMatchObject({ type: 'citation_inserted', category: 'decision', sealed: true, payload: { summary: 'Inserted citation: A study' } })
    expect(body.interventions[0]).toMatchObject({ id: 'intervention-1', status: 'resolved', evidenceCount: 2 })
  })

  it('records an explicit user decision in the project audit chain', async () => {
    const response = await POST(makeReq({ type: 'research_structure_accepted', summary: 'Accepted the research structure', entityType: 'document' }), context)
    expect(response.status).toBe(201)
    expect(mocks.append).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      projectId: 'project-1', userId: 'user-1', type: 'research_structure_accepted', actor: 'student',
      payload: expect.objectContaining({ summary: 'Accepted the research structure', entityType: 'document' }),
    }))
  })

  it('does not expose another user project history', async () => {
    mocks.projectFind.mockResolvedValue(null)
    expect((await GET(makeReq({}), context)).status).toBe(404)
    expect(mocks.auditFind).not.toHaveBeenCalled()
  })
})
