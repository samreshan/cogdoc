/**
 * Integration tests for /api/projects (list + create).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/db', () => {
  const models = {
    project: { findMany: vi.fn(), create: vi.fn() },
    auditEvent: { findFirst: vi.fn(), create: vi.fn() },
  }
  return { db: { ...models, $transaction: vi.fn(async (callback: (tx: typeof models) => unknown) => callback(models)) } }
})
vi.mock('@/lib/auth', () => ({ getDefaultUser: vi.fn() }))

import { GET, POST } from '@/app/api/projects/route'
import { db } from '@/lib/db'
import { getDefaultUser } from '@/lib/auth'

const findMany = db.project.findMany as ReturnType<typeof vi.fn>
const create = db.project.create as ReturnType<typeof vi.fn>
const getUser = getDefaultUser as ReturnType<typeof vi.fn>
const auditCreate = db.auditEvent.create as ReturnType<typeof vi.fn>

beforeEach(() => {
  findMany.mockReset(); create.mockReset(); getUser.mockReset(); auditCreate.mockReset()
  ;(db.auditEvent.findFirst as ReturnType<typeof vi.fn>).mockReset()
  ;(db.auditEvent.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null)
  auditCreate.mockResolvedValue({ id: 'audit-1' })
  getUser.mockResolvedValue({ id: 'u1', email: 'writer@cogdoc.local' })
})

describe('GET /api/projects', () => {
  it('lists non-archived projects for the user, newest first', async () => {
    findMany.mockResolvedValue([{ id: 'p1', title: 'A' }])
    const res = await GET()
    expect(res.status).toBe(200)
    expect((await res.json()).projects).toHaveLength(1)
    expect(findMany.mock.calls[0][0].where).toEqual({ userId: 'u1', archived: false })
    expect(findMany.mock.calls[0][0].orderBy).toEqual({ updatedAt: 'desc' })
  })
})

describe('POST /api/projects', () => {
  it('creates a project with default title when none provided', async () => {
    create.mockResolvedValue({ id: 'p1', title: 'Untitled Project' })
    const req = new NextRequest('http://localhost/api/projects', { method: 'POST', body: '{}' })
    const res = await POST(req)
    expect(res.status).toBe(201)
    const created = create.mock.calls[0][0].data
    expect(created.title).toBe('Untitled Project')
    expect(created.document).toEqual({ create: { content: '' } })
    expect(auditCreate.mock.calls[0][0].data.type).toBe('workspace_created')
    expect(auditCreate.mock.calls[0][0].data.eventHash).toBeTruthy()
  })

  it('uses provided title and description', async () => {
    create.mockResolvedValue({ id: 'p1' })
    const req = new NextRequest('http://localhost/api/projects', {
      method: 'POST', body: JSON.stringify({ title: ' My Thesis ', description: ' desc ' }),
    })
    await POST(req)
    const created = create.mock.calls[0][0].data
    expect(created.title).toBe('My Thesis')
    expect(created.description).toBe('desc')
  })

  it('defaults description to null when blank', async () => {
    create.mockResolvedValue({ id: 'p1' })
    const req = new NextRequest('http://localhost/api/projects', {
      method: 'POST', body: JSON.stringify({ title: 'X', description: '   ' }),
    })
    await POST(req)
    expect(create.mock.calls[0][0].data.description).toBeNull()
  })
})
