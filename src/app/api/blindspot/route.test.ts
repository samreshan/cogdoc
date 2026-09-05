/**
 * Integration tests for POST /api/blindspot — Blindspot Monitor (§7.2).
 *
 * The route fetches the project's PdfChunks (the library) + the set of
 * chunk_ids already cited by Citation Sentinel interventions, runs findBlindspot
 * over them, and — if a high-relevance uncited passage is found — persists an
 * Intervention with engineType='blindspot' and promptTemplateTag='Lens'.
 * One-per-session is enforced client-side; this route surfaces the result.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => {
  const models = {
    project: { findUnique: vi.fn() },
    pdfChunk: { findMany: vi.fn() },
    intervention: { findMany: vi.fn(), create: vi.fn() },
    interventionEvidence: { findMany: vi.fn() },
  }
  return { db: { ...models, $transaction: vi.fn(async (callback: (tx: typeof models) => unknown) => callback(models)) } }
})
vi.mock('@/lib/auth', () => ({ getDefaultUser: vi.fn() }))
vi.mock('@/lib/workspace-server', () => ({ appendAuditEvent: vi.fn(async () => ({ id: 'audit-1' })) }))

import { POST } from '@/app/api/blindspot/route'
import { db } from '@/lib/db'
import { getDefaultUser } from '@/lib/auth'
import { makeReq, DEFAULT_USER, DEFAULT_PROJECT } from '@/app/api/_test-helpers'

const findProject = db.project.findUnique as ReturnType<typeof vi.fn>
const findChunks = db.pdfChunk.findMany as ReturnType<typeof vi.fn>
const findInterventions = db.intervention.findMany as ReturnType<typeof vi.fn>
const findEvidence = db.interventionEvidence.findMany as ReturnType<typeof vi.fn>
const createIntervention = db.intervention.create as ReturnType<typeof vi.fn>
const getUser = getDefaultUser as ReturnType<typeof vi.fn>

beforeEach(() => {
  findProject.mockReset(); findChunks.mockReset(); findInterventions.mockReset()
  findEvidence.mockReset(); createIntervention.mockReset(); getUser.mockReset()
  getUser.mockResolvedValue(DEFAULT_USER)
  findProject.mockResolvedValue(DEFAULT_PROJECT)
  findInterventions.mockResolvedValue([]) // no citation interventions by default
})

describe('POST /api/blindspot — validation', () => {
  it('returns 400 when projectId or draft is missing', async () => {
    expect((await POST(makeReq({ draft: 'the study' }))).status).toBe(400)
    expect((await POST(makeReq({ projectId: 'p1' }))).status).toBe(400)
  })

  it('returns 404 when the project does not exist', async () => {
    findProject.mockResolvedValue(null)
    expect((await POST(makeReq({ projectId: 'nope', draft: 'x' }))).status).toBe(404)
  })
})

describe('POST /api/blindspot — no blindspot found', () => {
  it('returns null + persists nothing when the library is empty', async () => {
    findChunks.mockResolvedValue([])
    const res = await POST(makeReq({ projectId: 'proj-1', draft: 'a draft about cats' }))
    expect(res.status).toBe(200)
    expect((await res.json()).blindspot).toBeNull()
    expect(createIntervention).not.toHaveBeenCalled()
  })

  it('returns null when the draft has no content tokens', async () => {
    findChunks.mockResolvedValue([{ id: 'c1', content: 'some passage about neural networks' }])
    const res = await POST(makeReq({ projectId: 'proj-1', draft: '   ' }))
    expect((await res.json()).blindspot).toBeNull()
  })
})

describe('POST /api/blindspot — surfaces an overlooked passage', () => {
  it('finds the most-relevant uncited passage and persists a blindspot intervention', async () => {
    findChunks.mockResolvedValue([
      { id: 'c1', content: 'Neural networks learn via backpropagation.' },
      { id: 'c2', content: 'Pasta is made from durum wheat flour.' },
    ])
    createIntervention.mockResolvedValue({ id: 'iv-1', engineType: 'blindspot' })

    const res = await POST(makeReq({ projectId: 'proj-1', draft: 'neural networks learn patterns' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.blindspot).not.toBeNull()
    expect(body.blindspot.chunkId).toBe('c1')

    const created = createIntervention.mock.calls[0][0].data
    expect(created.engineType).toBe('blindspot')
    expect(created.promptTemplateTag).toBe('Lens')
  })

  it('excludes already-cited chunks from the blindspot search', async () => {
    // c1 is the relevant passage but already cited → blindspot returns null.
    findChunks.mockResolvedValue([
      { id: 'c1', content: 'Neural networks learn via backpropagation.' },
      { id: 'c2', content: 'Pasta is made from durum wheat flour.' },
    ])
    findInterventions.mockResolvedValue([{ id: 'iv-old' }])
    findEvidence.mockResolvedValue([{ chunkId: 'c1' }])

    const res = await POST(makeReq({ projectId: 'proj-1', draft: 'neural networks learn patterns' }))
    expect((await res.json()).blindspot).toBeNull()
    expect(createIntervention).not.toHaveBeenCalled()
  })
})
