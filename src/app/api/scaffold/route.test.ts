/**
 * Integration tests for POST /api/scaffold
 *
 * Maps to PRODUCT.md §15.3 (I-08 friction-mode contract for scaffold).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => {
  const models = {
    project: { findUnique: vi.fn() },
    intervention: { create: vi.fn() },
  }
  return { db: { ...models, $transaction: vi.fn(async (callback: (tx: typeof models) => unknown) => callback(models)) } }
})
vi.mock('@/lib/auth', () => ({ getDefaultUser: vi.fn() }))
vi.mock('@/lib/ai-service', () => ({ getAIService: vi.fn() }))
vi.mock('@/lib/workspace-server', () => ({ appendAuditEvent: vi.fn(async () => ({ id: 'audit-1' })) }))

import { POST } from '@/app/api/scaffold/route'
import { db } from '@/lib/db'
import { getDefaultUser } from '@/lib/auth'
import { getAIService } from '@/lib/ai-service'
import { makeReq, fakeAI, DEFAULT_USER, DEFAULT_PROJECT } from '@/app/api/_test-helpers'
import { SPARK_GAP_FALLBACK } from '@/lib/engine-guard'

const findProject = db.project.findUnique as ReturnType<typeof vi.fn>
const createIntervention = db.intervention.create as ReturnType<typeof vi.fn>
const getUser = getDefaultUser as ReturnType<typeof vi.fn>
const getService = getAIService as ReturnType<typeof vi.fn>

beforeEach(() => {
  findProject.mockReset(); createIntervention.mockReset(); getUser.mockReset(); getService.mockReset()
  getUser.mockResolvedValue(DEFAULT_USER)
  findProject.mockResolvedValue(DEFAULT_PROJECT)
})

describe('POST /api/scaffold', () => {
  it('returns 400 when projectId or prompt is missing', async () => {
    expect((await POST(makeReq({ prompt: 'x' }))).status).toBe(400)
    expect((await POST(makeReq({ projectId: 'p1' }))).status).toBe(400)
  })

  it('returns 404 when the project does not exist', async () => {
    findProject.mockResolvedValue(null)
    getService.mockReturnValue(fakeAI())
    expect((await POST(makeReq({ projectId: 'nope', prompt: 'build' }))).status).toBe(404)
  })

  it('generates a structural scaffold and persists a scaffold intervention', async () => {
    getService.mockReturnValue(
      fakeAI({ generateScaffold: async () => ({ scaffold: 'Claim: __ Evidence: __', raw: 'x' }) }),
    )
    const saved = { id: 'iv-1', engineType: 'scaffold' }
    createIntervention.mockResolvedValue(saved)

    const res = await POST(makeReq({ projectId: 'proj-1', prompt: 'build an argument', context: 'ctx' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.scaffold).toBe('Claim: __ Evidence: __')

    const created = createIntervention.mock.calls[0][0].data
    expect(created.engineType).toBe('scaffold')
    expect(created.promptTemplateTag).toBe('Structural Scaffold')
    expect(created.responseText).toMatch(/\?$/)
  })
})

describe('POST /api/scaffold — friction calibration (§9)', () => {
  it('passes a placeholder scaffold through in every mode', async () => {
    const scaffold = 'Claim: __ Evidence: __ Limitation: __'
    getService.mockReturnValue(
      fakeAI({ generateScaffold: async () => ({ scaffold, raw: scaffold }) }),
    )
    createIntervention.mockResolvedValue({ id: 'iv-1' })
    for (const mode of ['socratic', 'coach', 'assistant'] as const) {
      createIntervention.mockClear()
      const res = await POST(makeReq({ projectId: 'proj-1', prompt: 'build', friction_mode: mode }))
      expect((await res.json()).scaffold).toBe(scaffold)
      expect(createIntervention.mock.calls[0][0].data.responseText).toMatch(/\?$/)
    }
  })

  it('replaces a multi-paragraph scaffold response with the Spark Gap in every mode', async () => {
    const blob =
      'The argument begins with a clear claim. Evidence supports the claim from sources. ' +
      'A limitation is acknowledged. An implication follows for future work.'
    getService.mockReturnValue(
      fakeAI({ generateScaffold: async () => ({ scaffold: blob, raw: blob }) }),
    )
    createIntervention.mockResolvedValue({ id: 'iv-1' })
    for (const mode of ['socratic', 'coach', 'assistant'] as const) {
      createIntervention.mockClear()
      await POST(makeReq({ projectId: 'proj-1', prompt: 'build', friction_mode: mode }))
      expect(createIntervention.mock.calls[0][0].data.responseText).toBe(SPARK_GAP_FALLBACK)
    }
  })
})
