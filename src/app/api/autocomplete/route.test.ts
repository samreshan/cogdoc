import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: { project: { findUnique: vi.fn() }, intervention: { create: vi.fn() } },
}))
vi.mock('@/lib/auth', () => ({ getDefaultUser: vi.fn() }))
vi.mock('@/lib/ai-service', () => ({ getAIService: vi.fn() }))

import { POST } from '@/app/api/autocomplete/route'
import { db } from '@/lib/db'
import { getDefaultUser } from '@/lib/auth'
import { getAIService } from '@/lib/ai-service'
import { makeReq, fakeAI, DEFAULT_USER, DEFAULT_PROJECT } from '@/app/api/_test-helpers'

const findProject = db.project.findUnique as ReturnType<typeof vi.fn>
const createIntervention = db.intervention.create as ReturnType<typeof vi.fn>
const getUser = getDefaultUser as ReturnType<typeof vi.fn>
const getService = getAIService as ReturnType<typeof vi.fn>

beforeEach(() => {
  findProject.mockReset(); createIntervention.mockReset(); getUser.mockReset(); getService.mockReset()
  getUser.mockResolvedValue(DEFAULT_USER)
  findProject.mockResolvedValue(DEFAULT_PROJECT)
})

describe('POST /api/autocomplete — non-insertable cue compatibility', () => {
  it('validates the workspace and draft', async () => {
    expect((await POST(makeReq({ draft: 'the study' }))).status).toBe(400)
    expect((await POST(makeReq({ projectId: 'p1' }))).status).toBe(400)
  })

  it('does not expose another user workspace', async () => {
    findProject.mockResolvedValue(null)
    expect((await POST(makeReq({ projectId: 'nope', draft: 'the study' }))).status).toBe(404)
  })

  it('returns a question cue while keeping insertable suggestion empty', async () => {
    getService.mockReturnValue(fakeAI({ generateSuggestion: async () => ({ suggestion: 'the study found significant', raw: 'x' }) }))
    createIntervention.mockResolvedValue({ id: 'iv-1', engineType: 'socratic' })
    const res = await POST(makeReq({ projectId: 'proj-1', draft: 'according to', paragraphId: 'p1' }))
    const body = await res.json()
    expect(body).toMatchObject({ suggestion: '', insertable: false })
    expect(body.cue).toMatch(/\?$/)
    const created = createIntervention.mock.calls[0][0].data
    expect(created.engineType).toBe('socratic')
    expect(created.responseText).toMatch(/\?$/)
  })

  it('never turns pathological model output into completion prose', async () => {
    const blob = Array.from({ length: 70 }, (_, index) => `word${index}`).join(' ')
    getService.mockReturnValue(fakeAI({ generateSuggestion: async () => ({ suggestion: blob, raw: blob }) }))
    createIntervention.mockResolvedValue({ id: 'iv-1' })
    const body = await (await POST(makeReq({ projectId: 'proj-1', draft: 'x' }))).json()
    expect(body.suggestion).toBe('')
    expect(body.insertable).toBe(false)
    expect(body.cue).toMatch(/\?$/)
  })
})
