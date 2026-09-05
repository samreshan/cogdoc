/**
 * Characterization tests for auth.ts (single-user MVP helper).
 *
 * Locks the find-or-create contract so the Supabase Auth migration (Sprint 2,
 * Stream E) has a known baseline. After migration these tests are replaced by
 * real auth tests; the contract (returns a user with id+email) stays.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: { user: { upsert: vi.fn() } },
}))

import { getDefaultUser } from '@/lib/auth'
import { db } from '@/lib/db'

const upsert = db.user.upsert as ReturnType<typeof vi.fn>

beforeEach(() => {
  upsert.mockReset()
})

describe('getDefaultUser', () => {
  it('uses an idempotent upsert when the default user already exists', async () => {
    const existing = { id: 'u1', email: 'writer@cogdoc.local', displayName: 'Writer' }
    upsert.mockResolvedValue(existing)
    const user = await getDefaultUser()
    expect(user).toEqual(existing)
    expect(upsert).toHaveBeenCalledWith({ where: { email: 'writer@cogdoc.local' }, update: {}, create: { email: 'writer@cogdoc.local', displayName: 'Writer' } })
  })

  it('returns the newly created default user through the same atomic operation', async () => {
    const created = { id: 'u2', email: 'writer@cogdoc.local', displayName: 'Writer' }
    upsert.mockResolvedValue(created)
    const user = await getDefaultUser()
    expect(user).toEqual(created)
    expect(upsert).toHaveBeenCalledOnce()
  })
})
