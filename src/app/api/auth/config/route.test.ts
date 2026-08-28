import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { GET } from '@/app/api/auth/config/route'

const originalEnv = { ...process.env }

beforeEach(() => {
  process.env = { ...originalEnv, NODE_ENV: 'production' }
  delete process.env.NEXT_PUBLIC_SUPABASE_URL
  delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  delete process.env.COGDOC_SINGLE_USER_MODE
})

afterEach(() => {
  process.env = { ...originalEnv }
})

describe('GET /api/auth/config', () => {
  it('returns only browser-safe Supabase runtime configuration', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://research.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'public-key'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'must-not-leak'
    process.env.DATABASE_URL = 'postgresql://must-not-leak'

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({
      mode: 'supabase',
      supabase: { url: 'https://research.supabase.co', publishableKey: 'public-key' },
    })
    expect(JSON.stringify(body)).not.toContain('must-not-leak')
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('reports deliberate private single-user mode without credentials', async () => {
    process.env.COGDOC_SINGLE_USER_MODE = '1'
    const response = await GET()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ mode: 'single_user' })
  })

  it('fails closed when production authentication has no selected mode', async () => {
    const response = await GET()
    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({ mode: 'misconfigured' })
  })
})
