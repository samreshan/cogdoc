import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ updateMany: vi.fn(), upsert: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: { researchJob: mocks } }))

import { enqueueBackgroundEnginePrompt } from './research-jobs'

describe('background engine job enqueueing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.updateMany.mockResolvedValue({ count: 0 })
    mocks.upsert.mockResolvedValue({ id: 'job-1' })
  })

  it('coalesces older document prompts and schedules the durable revision event', async () => {
    await enqueueBackgroundEnginePrompt({ projectId: 'project-1', trigger: 'document_saved', entityId: 'document-1:revision-4' })
    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ projectId: 'project-1', kind: 'engine_prompt', status: 'queued' }),
      data: expect.objectContaining({ status: 'cancelled' }),
    }))
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { projectId_idempotencyKey: { projectId: 'project-1', idempotencyKey: 'engine_prompt:document_saved:document-1:revision-4' } },
      create: expect.objectContaining({ kind: 'engine_prompt', maxAttempts: 2, availableAt: expect.any(Date) }),
    }))
  })

  it('ties a finding event to its exact revision without cancelling unrelated work', async () => {
    await enqueueBackgroundEnginePrompt({ projectId: 'project-1', trigger: 'finding_saved', entityId: 'revision-2', questionId: 'question-1', findingRevisionId: 'revision-2' })
    expect(mocks.updateMany).not.toHaveBeenCalled()
    const create = mocks.upsert.mock.calls[0][0].create
    expect(JSON.parse(create.payloadJson)).toMatchObject({ trigger: 'finding_saved', findingRevisionId: 'revision-2' })
  })
})
