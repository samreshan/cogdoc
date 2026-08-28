import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  projectFindFirst: vi.fn(),
  referenceFindFirst: vi.fn(),
  referenceFindMany: vi.fn(),
  referenceCreate: vi.fn(),
  referenceUpdate: vi.fn(),
  auditFindFirst: vi.fn(),
  auditCreate: vi.fn(),
  lookupReferenceMetadata: vi.fn(),
}))

vi.mock('@/lib/auth-supabase', () => ({ requireUserId: vi.fn(async () => 'user-1') }))
vi.mock('@/lib/db', () => ({
  db: {
    project: { findFirst: mocks.projectFindFirst },
    reference: { findFirst: mocks.referenceFindFirst, findMany: mocks.referenceFindMany },
    $transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback({
      reference: { create: mocks.referenceCreate, update: mocks.referenceUpdate },
      auditEvent: { findFirst: mocks.auditFindFirst, create: mocks.auditCreate },
    })),
  },
}))
vi.mock('@/lib/reference-metadata', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/reference-metadata')>()
  return { ...actual, lookupReferenceMetadata: mocks.lookupReferenceMetadata }
})

import { PATCH, POST } from '@/app/api/workspaces/[id]/references/route'

function request(body: Record<string, unknown>, method = 'POST') {
  return new NextRequest('http://localhost/api/workspaces/project-1/references', {
    method, body: JSON.stringify(body), headers: { 'content-type': 'application/json' },
  })
}

describe('POST /api/workspaces/:id/references', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.projectFindFirst.mockResolvedValue({ id: 'project-1', citationStyle: 'harvard' })
    mocks.referenceFindFirst.mockResolvedValue(null)
    mocks.auditFindFirst.mockResolvedValue(null)
    mocks.auditCreate.mockResolvedValue({ id: 'audit-1' })
    mocks.lookupReferenceMetadata.mockResolvedValue(null)
  })

  it('rejects non-HTTP source URLs', async () => {
    const response = await POST(request({ title: 'Paper', url: 'file:///private/paper.pdf' }), { params: Promise.resolve({ id: 'project-1' }) })
    expect(response.status).toBe(400)
    expect(mocks.projectFindFirst).not.toHaveBeenCalled()
  })

  it('returns an existing DOI record without duplicating it', async () => {
    mocks.referenceFindFirst.mockResolvedValue({ id: 'ref-1', title: 'Paper', source: null })
    const response = await POST(request({ title: 'Paper', url: 'https://doi.org/10.1000/test', doi: 'https://doi.org/10.1000/test' }), { params: Promise.resolve({ id: 'project-1' }) })
    const body = await response.json()
    expect(body.alreadySaved).toBe(true)
    expect(mocks.referenceCreate).not.toHaveBeenCalled()
  })

  it('saves normalized metadata and an audit event', async () => {
    mocks.referenceCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'ref-2', ...data, source: null }))
    const response = await POST(request({
      title: 'Learning through practice', url: 'https://doi.org/10.1000/Test',
      doi: 'https://doi.org/10.1000/Test', authors: ['Maya Chen'], year: '2025', provider: 'openalex',
    }), { params: Promise.resolve({ id: 'project-1' }) })

    expect(response.status).toBe(201)
    expect(mocks.referenceCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ doi: '10.1000/test', authorsJson: '["Maya Chen"]', metadataStatus: 'unverified' }),
    }))
    expect(mocks.auditCreate).toHaveBeenCalledOnce()
  })
})

describe('PATCH /api/workspaces/:id/references', () => {
  const savedReference = {
    id: 'ref-1', projectId: 'project-1', rawText: 'Chen (2025). Learning through deliberate practice.',
    style: 'apa', authorsJson: '["Maya Chen"]', year: '2025', title: 'Learning through deliberate practice',
    doi: '10.1000/example', url: 'https://doi.org/10.1000/example', metadataStatus: 'unverified',
    metadataConfidence: 0, metadataJson: null,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.referenceFindFirst.mockResolvedValue(savedReference)
    mocks.auditFindFirst.mockResolvedValue(null)
    mocks.auditCreate.mockResolvedValue({ id: 'audit-1' })
    mocks.referenceUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...savedReference, ...data, source: null }))
  })

  it('checks discovered metadata against a DOI registry', async () => {
    mocks.lookupReferenceMetadata.mockResolvedValue({
      provider: 'crossref', doi: '10.1000/example', title: 'Learning through deliberate practice',
      year: '2025', authors: ['Chen'], url: 'https://doi.org/10.1000/example', raw: {},
    })

    const response = await PATCH(request({ referenceId: 'ref-1', verifyMetadata: true }, 'PATCH'), { params: Promise.resolve({ id: 'project-1' }) })
    const body = await response.json()

    expect(body.verified).toBe(true)
    expect(body.confidence).toBe(1)
    expect(mocks.referenceUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ metadataStatus: 'matched', metadataConfidence: 1 }),
    }))
    expect(mocks.auditCreate).toHaveBeenCalledOnce()
  })

  it('records explicit author confirmation separately from a registry match', async () => {
    const response = await PATCH(request({ referenceId: 'ref-1', confirmMetadata: true }, 'PATCH'), { params: Promise.resolve({ id: 'project-1' }) })
    const body = await response.json()
    expect(body.reference.metadataStatus).toBe('confirmed')
    expect(mocks.referenceUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ metadataStatus: 'confirmed' }),
    }))
    expect(mocks.auditCreate).toHaveBeenCalledOnce()
  })
})
