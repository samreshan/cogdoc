import { describe, expect, it } from 'vitest'
import { auditEventDigest, verifyAuditChain } from '@/lib/workspace-server'

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
