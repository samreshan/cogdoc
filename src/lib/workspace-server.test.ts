import { describe, expect, it, vi } from 'vitest'
import { appendAuditEvent, auditEventDigest, verifyAuditChain } from '@/lib/workspace-server'

function event(previousHash: string | null, createdAt: Date, payloadJson = '{}') {
  const value = {
    projectId: 'workspace-1',
    userId: 'student-1',
    type: 'review_completed',
    actor: 'system',
    payloadJson,
    documentHash: 'document-hash',
    modelVersion: 'review-engine-v1',
    promptVersion: null,
    previousHash,
    createdAt,
  }
  return { ...value, eventHash: auditEventDigest(value) }
}

describe('audit event integrity', () => {
  it('takes a project-scoped transaction lock before extending the chain', async () => {
    const executeRaw = vi.fn(async () => 1)
    const findFirst = vi.fn(async () => ({ eventHash: 'previous-hash' }))
    const create = vi.fn(async ({ data }) => ({ id: 'audit-1', ...data }))

    await appendAuditEvent({ $executeRaw: executeRaw, auditEvent: { findFirst, create } } as never, {
      projectId: 'workspace-1', userId: 'student-1', type: 'citation_inserted',
      payload: { summary: 'Inserted a citation' },
    })

    expect(executeRaw).toHaveBeenCalledOnce()
    expect(executeRaw.mock.invocationCallOrder[0]).toBeLessThan(findFirst.mock.invocationCallOrder[0])
    expect(create.mock.calls[0][0].data.previousHash).toBe('previous-hash')
  })

  it('accepts a complete hash chain and rejects tampered payloads', () => {
    const first = event(null, new Date('2026-08-22T00:00:00.000Z'))
    const second = event(first.eventHash, new Date('2026-08-22T00:00:01.000Z'), '{"resolved":true}')

    expect(verifyAuditChain([first, second])).toBe(true)
    expect(verifyAuditChain([first, { ...second, payloadJson: '{"resolved":false}' }])).toBe(false)
  })

  it('allows unchained legacy rows only before the first hashed event', () => {
    const legacy = {
      projectId: 'workspace-1', userId: 'student-1', type: 'legacy_intervention', actor: 'system',
      payloadJson: '{}', documentHash: null, modelVersion: null, promptVersion: null,
      previousHash: null, eventHash: null, createdAt: new Date('2026-08-21T00:00:00.000Z'),
    }
    const first = event(null, new Date('2026-08-22T00:00:00.000Z'))

    expect(verifyAuditChain([legacy, first])).toBe(true)
    expect(verifyAuditChain([first, legacy])).toBe(false)
  })
})
