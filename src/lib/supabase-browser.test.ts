import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createBrowserClient } = vi.hoisted(() => ({
  createBrowserClient: vi.fn(() => ({
    auth: { getSession: vi.fn() },
  })),
}))

vi.mock('@supabase/ssr', () => ({ createBrowserClient }))

import { configureSupabaseBrowser, supabase } from '@/lib/supabase-browser'

describe('runtime Supabase browser configuration', () => {
  beforeEach(() => createBrowserClient.mockClear())

  it('constructs the client from runtime values supplied after the bundle loads', () => {
    configureSupabaseBrowser('https://runtime.supabase.co', 'runtime-public-key')
    expect(supabase.auth).toBeDefined()
    expect(createBrowserClient).toHaveBeenCalledWith(
      'https://runtime.supabase.co',
      'runtime-public-key',
    )
  })

  it('rejects incomplete runtime configuration', () => {
    expect(() => configureSupabaseBrowser('', 'key')).toThrow(
      'Supabase browser configuration is incomplete',
    )
  })
})
