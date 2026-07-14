/**
 * Integration tests for POST /api/autocomplete — Devil's Autocomplete (§7.1).
 *
 * The route calls the LLM for a raw continuation, sanitizes it (≤12 words,
 * single sentence), runs the non-generation guard, and persists an Intervention
 * with engineType='autocomplete'. The commit mechanic (typed vs Tab-accept) is
 * resolved client-side via resolveCommitAction and logged as userAction on a
 * PATCH — this test covers the generation + persistence path.
 *
 * NOTE: the FastAPI service is the intended owner of this engine per §12.1
 * (POST /api/ai/autocomplete). It lives in the Next.js BFF for now to match the
 * other engines' current location; the port is tracked as a TODO.
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

import { POST } from '@/app/api/autocomplete/route'
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

describe('POST /api/autocomplete — validation', () => {
  it('returns 400 when projectId or draft is missing', async () => {
    expect((await POST(makeReq({ draft: 'the study' }))).status).toBe(400)
    expect((await POST(makeReq({ projectId: 'p1' }))).status).toBe(400)
  })

  it('returns 404 when the project does not exist', async () => {
    findProject.mockResolvedValue(null)
    getService.mockReturnValue(fakeAI())
    expect((await POST(makeReq({ projectId: 'nope', draft: 'the study' }))).status).toBe(404)
  })
})

describe('POST /api/autocomplete — suggestion generation', () => {
  it('sanitizes a raw LLM suggestion and persists an autocomplete intervention', async () => {
    getService.mockReturnValue(
      fakeAI({ generateSuggestion: async () => ({ suggestion: 'the study found significant', raw: 'x' }) }),
    )
    createIntervention.mockResolvedValue({ id: 'iv-1', engineType: 'autocomplete' })

    const res = await POST(makeReq({ projectId: 'proj-1', draft: 'according to', paragraphId: 'p1' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.suggestion).toBe('the study found significant')

    const created = createIntervention.mock.calls[0][0].data
    expect(created.engineType).toBe('autocomplete')
    expect(created.responseText).toBe('the study found significant')
    expect(created.userAction).toBe('ignored') // default until the user interacts
  })

  it('truncates an over-long raw suggestion to the word cap', async () => {
    const long = 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen'
    getService.mockReturnValue(fakeAI({ generateSuggestion: async () => ({ suggestion: long, raw: long }) }))
    createIntervention.mockResolvedValue({ id: 'iv-1' })

    const res = await POST(makeReq({ projectId: 'proj-1', draft: 'x' }))
    const body = await res.json()
    expect(body.suggestion.split(/\s+/).length).toBeLessThanOrEqual(12)
  })

  it('returns an empty suggestion + no intervention when the LLM gives nothing usable', async () => {
    getService.mockReturnValue(fakeAI({ generateSuggestion: async () => ({ suggestion: '', raw: '' }) }))
    const res = await POST(makeReq({ projectId: 'proj-1', draft: 'x' }))
    expect(res.status).toBe(200)
    expect((await res.json()).suggestion).toBe('')
    expect(createIntervention).not.toHaveBeenCalled()
  })
})

describe('POST /api/autocomplete — non-generation protection (§7.1 + §9)', () => {
  it('sanitize caps any raw output to ≤12 words, so a suggestion is never prose', async () => {
    // A pathological 70-word raw blob is truncated to the word cap BEFORE the
    // guard even sees it. sanitizeSuggestion is the primary protection; the
    // guard is belt-and-suspenders defense-in-depth.
    const blob = Array.from({ length: 70 }, (_, i) => `word${i}`).join(' ')
    getService.mockReturnValue(fakeAI({ generateSuggestion: async () => ({ suggestion: blob, raw: blob }) }))
    createIntervention.mockResolvedValue({ id: 'iv-1' })

    const res = await POST(makeReq({ projectId: 'proj-1', draft: 'x' }))
    const suggestion = (await res.json()).suggestion
    expect(suggestion.split(/\s+/).length).toBeLessThanOrEqual(12)
    // the persisted responseText matches the capped suggestion
    expect(createIntervention.mock.calls[0][0].data.responseText).toBe(suggestion)
    expect(suggestion).not.toBe(SPARK_GAP_FALLBACK) // guard not needed; sanitize handled it
  })
})
