/**
 * Characterization tests for auth.ts (single-user MVP helper).
 *
 * Locks the find-or-create contract so the Supabase Auth migration (Sprint 2,
 * Stream E) has a known baseline. After migration these tests are replaced by
 * real auth tests; the contract (returns a user with id+email) stays.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: { user: { findUnique: vi.fn(), create: vi.fn() } },
}))

import { getDefaultUser } from '@/lib/auth'
import { db } from '@/lib/db'

const findUnique = db.user.findUnique as ReturnType<typeof vi.fn>
const create = db.user.create as ReturnType<typeof vi.fn>

beforeEach(() => {
  findUnique.mockReset(); create.mockReset()
})

describe('getDefaultUser', () => {
  it('returns the existing user when found', async () => {
    const existing = { id: 'u1', email: 'writer@cogdoc.local', displayName: 'Writer' }
    findUnique.mockResolvedValue(existing)
    const user = await getDefaultUser()
    expect(user).toEqual(existing)
    expect(create).not.toHaveBeenCalled()
  })

  it('creates the default user when not found', async () => {
    findUnique.mockResolvedValue(null)
    const created = { id: 'u2', email: 'writer@cogdoc.local', displayName: 'Writer' }
    create.mockResolvedValue(created)
    const user = await getDefaultUser()
    expect(user).toEqual(created)
    expect(create).toHaveBeenCalledWith({
      data: { email: 'writer@cogdoc.local', displayName: 'Writer' },
    })
  })
})
