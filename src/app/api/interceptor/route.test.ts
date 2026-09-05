/**
 * Integration tests for POST /api/interceptor
 *
 * Mocks db, auth, and AIService to exercise the route's validation,
 * classification branching, intervention persistence, and response shape.
 *
 * Maps to PRODUCT.md §15.3 (I-04) and §15.2 (U-03, U-04).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/db', () => {
  const models = {
    project: { findUnique: vi.fn() },
    intervention: { create: vi.fn() },
  }
  return { db: { ...models, $transaction: vi.fn(async (callback: (tx: typeof models) => unknown) => callback(models)) } }
})
vi.mock('@/lib/auth', () => ({
  getDefaultUser: vi.fn(),
}))
vi.mock('@/lib/ai-service', () => ({
  getAIService: vi.fn(),
}))
vi.mock('@/lib/workspace-server', () => ({ appendAuditEvent: vi.fn(async () => ({ id: 'audit-1' })) }))

import { POST } from '@/app/api/interceptor/route'
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
  findProject.mockReset()
  createIntervention.mockReset()
  getUser.mockReset()
  getService.mockReset()
  getUser.mockResolvedValue(DEFAULT_USER)
  findProject.mockResolvedValue(DEFAULT_PROJECT)
})

describe('POST /api/interceptor — validation', () => {
  it('returns 400 when projectId is missing', async () => {
    const res = await POST(makeReq({ prompt: 'hello' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/projectId and prompt are required/)
  })

  it('returns 400 when prompt is missing', async () => {
    const res = await POST(makeReq({ projectId: 'proj-1' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 on malformed JSON body', async () => {
    const req = new NextRequest('http://localhost/api/x', { method: 'POST', body: 'not json{' })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})

describe('POST /api/interceptor — non-delegative prompt (pass-through)', () => {
  it('returns action:pass and does NOT persist an intervention', async () => {
    getService.mockReturnValue(fakeAI({ classifyPrompt: async () => ({ isDelegative: false, confidence: 0.9, raw: 'PASS' }) }))
    const res = await POST(makeReq({ projectId: 'proj-1', prompt: 'what is photosynthesis?' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.action).toBe('pass')
    expect(body.isDelegative).toBe(false)
    expect(createIntervention).not.toHaveBeenCalled()
  })
})

describe('POST /api/interceptor — delegative prompt (reframe)', () => {
  it('classifies, generates a Spark Gap question, and persists an intervention', async () => {
    getService.mockReturnValue(
      fakeAI({
        classifyPrompt: async () => ({ isDelegative: true, confidence: 0.95, raw: 'heuristic_match' }),
        generateSocratic: async () => ({ question: 'What must the reader accept?', raw: 'x' }),
      }),
    )
    const saved = { id: 'iv-1', engineType: 'interceptor' }
    createIntervention.mockResolvedValue(saved)

    const res = await POST(makeReq({ projectId: 'proj-1', prompt: 'write a paragraph about cats', paragraphId: 'p1' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.action).toBe('reframe')
    expect(body.isDelegative).toBe(true)
    expect(body.socraticQuestion).toBe('What must the reader accept?')
    expect(body.intervention).toEqual(saved)

    // verify the persisted intervention shape
    expect(createIntervention).toHaveBeenCalledTimes(1)
    const created = createIntervention.mock.calls[0][0].data
    expect(created.engineType).toBe('interceptor')
    expect(created.promptTemplateTag).toBe('The Spark Gap')
    expect(created.promptText).toBe('write a paragraph about cats')
    expect(created.paragraphId).toBe('p1')
  })
})

describe('POST /api/interceptor — project lookup', () => {
  it('returns 404 when the project does not exist', async () => {
    findProject.mockResolvedValue(null)
    getService.mockReturnValue(fakeAI())
    const res = await POST(makeReq({ projectId: 'nope', prompt: 'hello there' }))
    expect(res.status).toBe(404)
  })
})

describe('POST /api/interceptor — friction calibration (§9)', () => {
  it('reads friction_mode from the body (defaults to socratic) and persists a guard-allowed question', async () => {
    const question = 'What must the reader accept?'
    getService.mockReturnValue(
      fakeAI({
        classifyPrompt: async () => ({ isDelegative: true, confidence: 0.95, raw: 'x' }),
        generateSocratic: async () => ({ question, raw: question }),
      }),
    )
    createIntervention.mockResolvedValue({ id: 'iv-1' })

    await POST(makeReq({ projectId: 'proj-1', prompt: 'write about cats', friction_mode: 'assistant' }))
    const created = createIntervention.mock.calls[0][0].data
    expect(created.responseText).toBe(question) // allowed → persisted verbatim
  })

  it('replaces a multi-paragraph response with the Spark Gap in EVERY mode (non-generation invariant)', async () => {
    const blob =
      'Cats are mammals with retractable claws. They hunt small prey at night. ' +
      'Their whiskers sense nearby movement. This makes them effective predators.'
    getService.mockReturnValue(
      fakeAI({
        classifyPrompt: async () => ({ isDelegative: true, confidence: 0.95, raw: 'x' }),
        generateSocratic: async () => ({ question: blob, raw: blob }),
      }),
    )
    createIntervention.mockResolvedValue({ id: 'iv-1' })

    for (const mode of ['socratic', 'coach', 'assistant'] as const) {
      createIntervention.mockClear()
      await POST(makeReq({ projectId: 'proj-1', prompt: 'write about cats', friction_mode: mode }))
      const created = createIntervention.mock.calls[0][0].data
      expect(created.responseText).toBe(SPARK_GAP_FALLBACK)
      expect(created.responseText).not.toBe(blob)
    }
  })
})

describe('POST /api/interceptor — auth gate (Supabase configured)', () => {
  it('returns 401 when no valid session', async () => {
    // Configure Supabase env so requireUserId enforces auth, then make
    // requireUserId throw by stubbing getSession to return no session.
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'key'
    const authSupa = await import('@/lib/auth-supabase')
    vi.spyOn(authSupa, 'getSession').mockResolvedValue(null as any)
    const res = await POST(makeReq({ projectId: 'proj-1', prompt: 'write a paragraph' }))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toMatch(/Authentication required/)
    // the AI service and DB were never reached
    expect(getService).not.toHaveBeenCalled()
    expect(createIntervention).not.toHaveBeenCalled()
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  })
})
