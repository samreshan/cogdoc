import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  projectFindFirst: vi.fn(),
  projectUpdate: vi.fn(),
  referenceFindMany: vi.fn(),
  referenceUpdate: vi.fn(),
  appendAuditEvent: vi.fn(),
}))

vi.mock('@/lib/auth-supabase', () => ({ requireUserId: vi.fn(async () => 'user-1') }))
vi.mock('@/lib/workspace-server', () => ({ appendAuditEvent: mocks.appendAuditEvent }))
vi.mock('@/lib/db', () => ({
  db: {
    project: { findFirst: mocks.projectFindFirst },
    $transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback({
      project: { update: mocks.projectUpdate },
      reference: { findMany: mocks.referenceFindMany, update: mocks.referenceUpdate },
    })),
  },
}))

import { PATCH } from '@/app/api/workspaces/[id]/route'

function request(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/workspaces/project-1', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const context = { params: Promise.resolve({ id: 'project-1' }) }

describe('PATCH /api/workspaces/:id citation settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.projectFindFirst.mockResolvedValue({ id: 'project-1', citationStyle: 'harvard' })
    mocks.projectUpdate.mockResolvedValue({ id: 'project-1', citationStyle: 'apa' })
    mocks.referenceUpdate.mockResolvedValue({})
    mocks.appendAuditEvent.mockResolvedValue({})
  })

  it('rejects an unsupported citation style instead of silently ignoring it', async () => {
    const response = await PATCH(request({ citationStyle: 'invented-style' }), context)
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'citationStyle must be harvard or apa' })
    expect(mocks.projectUpdate).not.toHaveBeenCalled()
  })

  it('re-renders metadata-backed references and reports manual-review exceptions', async () => {
    mocks.referenceFindMany.mockResolvedValue([
      {
        id: 'reference-1', title: 'Learning through deliberate practice',
        authorsJson: '["Maya Chen"]', year: '2025', doi: '10.1000/example',
        url: 'https://doi.org/10.1000/example',
        metadataJson: '{"venue":"Journal of Learning Research","volume":"18","issue":"2","pages":"41-59"}',
      },
      {
        id: 'reference-2', title: null, authorsJson: '[]', year: null,
        doi: null, url: null, metadataJson: null,
      },
    ])

    const response = await PATCH(request({ citationStyle: 'apa' }), context)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      workspace: { citationStyle: 'apa' },
      referencesReformatted: 1,
      referencesNeedingReview: 1,
    })
    expect(mocks.referenceUpdate).toHaveBeenCalledOnce()
    expect(mocks.referenceUpdate).toHaveBeenCalledWith({
      where: { id: 'reference-1' },
      data: {
        rawText: expect.stringMatching(/Chen, M\. \(2025\)\.[\s\S]*18\(2\)[\s\S]*41–59/),
        style: 'apa',
      },
    })
    expect(mocks.appendAuditEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      type: 'citation_style_changed',
      payload: expect.objectContaining({ referencesReformatted: 1, referencesNeedingReview: 1 }),
    }))
  })
})
