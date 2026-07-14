/**
 * Integration tests for POST /api/socratic-spacer
 *
 * Maps to PRODUCT.md §15.3 (I-05, I-06).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    project: { findUnique: vi.fn() },
    intervention: { create: vi.fn() },
  },
}))
vi.mock('@/lib/auth', () => ({ getDefaultUser: vi.fn() }))
vi.mock('@/lib/ai-service', () => ({ getAIService: vi.fn() }))

import { POST } from '@/app/api/socratic-spacer/route'
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

describe('POST /api/socratic-spacer', () => {
  it('returns 400 when projectId is missing', async () => {
    const res = await POST(makeReq({ context: 'some text' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/projectId is required/)
  })

  it('returns 404 when the project does not exist', async () => {
    findProject.mockResolvedValue(null)
    getService.mockReturnValue(fakeAI())
    const res = await POST(makeReq({ projectId: 'nope', context: 'ctx' }))
    expect(res.status).toBe(404)
  })

  it('generates a Provocation ghost question and persists a socratic intervention', async () => {
    getService.mockReturnValue(
      fakeAI({ generateSocratic: async () => ({ question: 'What evidence?', raw: 'x' }) }),
    )
    const saved = { id: 'iv-1', engineType: 'socratic' }
    createIntervention.mockResolvedValue(saved)

    const res = await POST(makeReq({ projectId: 'proj-1', context: 'writer text', stub: 'stub' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ghostQuestion).toBe('What evidence?')
    expect(body.intervention).toEqual(saved)

    const created = createIntervention.mock.calls[0][0].data
    expect(created.engineType).toBe('socratic')
    expect(created.promptTemplateTag).toBe('Provocation')
    expect(created.promptText).toBe('stub')
  })

  it('defaults stub to empty string when not provided', async () => {
    getService.mockReturnValue(fakeAI())
    createIntervention.mockResolvedValue({ id: 'iv-1' })
    await POST(makeReq({ projectId: 'proj-1', context: 'ctx' }))
    expect(createIntervention.mock.calls[0][0].data.promptText).toBe('')
  })
})

describe('POST /api/socratic-spacer — friction calibration (§9)', () => {
  it('persists a guard-allowed question verbatim', async () => {
    const question = 'What evidence would change this?'
    getService.mockReturnValue(
      fakeAI({ generateSocratic: async () => ({ question, raw: question }) }),
    )
    createIntervention.mockResolvedValue({ id: 'iv-1' })
    await POST(makeReq({ projectId: 'proj-1', context: 'ctx', friction_mode: 'coach' }))
    expect(createIntervention.mock.calls[0][0].data.responseText).toBe(question)
  })

  it('replaces multi-paragraph prose with the Spark Gap in every mode', async () => {
    const blob =
      'Memory is limited in capacity. Extraneous load reduces retention. ' +
      'Designers must minimise it. Worked examples help.'
    getService.mockReturnValue(
      fakeAI({ generateSocratic: async () => ({ question: blob, raw: blob }) }),
    )
    createIntervention.mockResolvedValue({ id: 'iv-1' })
    for (const mode of ['socratic', 'coach', 'assistant'] as const) {
      createIntervention.mockClear()
      await POST(makeReq({ projectId: 'proj-1', context: 'ctx', friction_mode: mode }))
      expect(createIntervention.mock.calls[0][0].data.responseText).toBe(SPARK_GAP_FALLBACK)
    }
  })
})
