import { describe, expect, it } from 'vitest'
import { leaseExpired, retryResearchJob } from './research-job-policy'

describe('research job leases and retries', () => {
  it('requeues with bounded backoff and eventually fails', () => {
    expect(retryResearchJob(1, 3, 0)).toMatchObject({ status: 'queued', leaseOwner: null })
    expect(retryResearchJob(3, 3, 0).status).toBe('failed')
    expect(retryResearchJob(20, 30, 0).availableAt.getTime()).toBe(60_000)
  })
  it('permits abandoned leases to recover', () => {
    expect(leaseExpired(new Date(0), new Date(1))).toBe(true)
    expect(leaseExpired(new Date(2), new Date(1))).toBe(false)
  })
})
