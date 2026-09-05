import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  project: { findFirst: vi.fn() },
  researchFinding: { findMany: vi.fn() },
}))
vi.mock('@/lib/auth-supabase', () => ({ requireUserId: vi.fn(async () => 'user-1') }))
vi.mock('@/lib/db', () => ({ db: mocks }))

import { GET } from './route'

const context = { params: Promise.resolve({ id: 'workspace-1' }) }
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('COGDOC_RESEARCH_COLLABORATOR', 'article')
  mocks.project.findFirst.mockResolvedValue({ id: 'workspace-1', userId: 'user-1', archived: false, deletedAt: null })
})

describe('article candidates route', () => {
  it('returns current reviewed findings from every question and marks ineligible records with their reason', async () => {
    mocks.researchFinding.findMany.mockResolvedValue([
      {
        id: 'finding-1', currentRevision: 2, reviewState: 'reviewed', question: { wording: 'First question?' },
        revisions: [{ id: 'revision-2', revision: 2, conclusion: 'A bounded conclusion.', uncertainty: 'One source only.', reviews: [{ decision: 'retain_uncertainty' }] }],
      },
      {
        id: 'finding-2', currentRevision: 1, reviewState: 'review_needed', question: { wording: 'Second question?' },
        revisions: [{ id: 'revision-1', revision: 1, conclusion: 'An unreviewed claim.', uncertainty: null, reviews: [{ decision: 'accept' }] }],
      },
    ])
    const response = await GET(new NextRequest('http://localhost/api/x'), context)
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({ findingRevisionId: 'revision-2', question: 'First question?', eligible: true }),
      expect.objectContaining({ findingRevisionId: 'revision-1', question: 'Second question?', eligible: false, reason: expect.stringContaining('explicit current-revision review') }),
    ]))
  })
})
