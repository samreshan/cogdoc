import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth-supabase', () => ({ requireUserId: vi.fn(async () => 'user-1') }))
vi.mock('@/lib/db', () => {
  const models = {
    certificate: { findFirst: vi.fn() },
    shareGrant: { create: vi.fn(), updateMany: vi.fn() },
    auditEvent: { findFirst: vi.fn(), create: vi.fn() },
  }
  return { db: { ...models, $transaction: vi.fn(async (callback: (tx: typeof models) => unknown) => callback(models)) } }
})

import { DELETE, POST } from '@/app/api/certificates/[id]/share/route'
import { db } from '@/lib/db'

const certificate = db.certificate.findFirst as ReturnType<typeof vi.fn>
const shareCreate = db.shareGrant.create as ReturnType<typeof vi.fn>
const shareUpdate = db.shareGrant.updateMany as ReturnType<typeof vi.fn>
const auditCreate = db.auditEvent.create as ReturnType<typeof vi.fn>
const context = { params: Promise.resolve({ id: 'certificate-1' }) }

beforeEach(() => {
  vi.clearAllMocks()
  certificate.mockResolvedValue({ id: 'certificate-1', projectId: 'project-1' })
  shareCreate.mockResolvedValue({ id: 'share-1' })
  shareUpdate.mockResolvedValue({ count: 2 })
  ;(db.auditEvent.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null)
  auditCreate.mockResolvedValue({ id: 'audit-1' })
})

describe('certificate sharing decisions', () => {
  it('creates the share and sealed project audit together', async () => {
    const response = await POST(new NextRequest('http://localhost/api/certificates/certificate-1/share', {
      method: 'POST', body: JSON.stringify({ expiresInDays: 14 }),
    }), context)

    expect(response.status).toBe(201)
    expect(shareCreate).toHaveBeenCalledOnce()
    expect(auditCreate.mock.calls[0][0].data.type).toBe('certificate_share_created')
    expect(auditCreate.mock.calls[0][0].data.eventHash).toBeTruthy()
  })

  it('records revocation and the number of links affected', async () => {
    const response = await DELETE(new NextRequest('http://localhost/api/certificates/certificate-1/share', { method: 'DELETE' }), context)

    expect(response.status).toBe(200)
    expect(auditCreate.mock.calls[0][0].data.type).toBe('certificate_shares_revoked')
    expect(JSON.parse(auditCreate.mock.calls[0][0].data.payloadJson).revokedCount).toBe(2)
  })
})
