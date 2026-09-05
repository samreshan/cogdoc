export function retryResearchJob(attempts: number, maxAttempts: number, now = Date.now()) {
  const failed = attempts >= maxAttempts
  return {
    status: failed ? 'failed' as const : 'queued' as const,
    availableAt: new Date(now + Math.min(60_000, 2 ** Math.max(0, attempts) * 1_000)),
    leaseOwner: null,
    leaseExpiresAt: null,
  }
}

export function leaseExpired(leaseExpiresAt: Date | null, now = new Date()) { return !leaseExpiresAt || leaseExpiresAt < now }
