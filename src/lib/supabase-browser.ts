/**
 * Supabase browser client (Phase 6, §8.7).
 *
 * Used by the client-side Login UI + any client component that needs the
 * session (sign-in, sign-out, OAuth). Server-side code uses the server client
 * in auth-supabase.ts (cookie-bound to the request).
 */
import { createBrowserClient } from '@supabase/ssr'

const SUPABASE_URL = () => process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SUPABASE_KEY = () =>
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  ''

type BrowserClient = ReturnType<typeof createBrowserClient>

let client: BrowserClient | null = null

/**
 * Constructed on first use, not at import time: createBrowserClient throws when
 * the URL/key are empty, and this module is evaluated during `next build` when
 * the page is prerendered — where Supabase env vars may not exist yet.
 * Callers gate on NEXT_PUBLIC_SUPABASE_URL before touching the client.
 */
function getClient(): BrowserClient {
  if (!client) client = createBrowserClient(SUPABASE_URL(), SUPABASE_KEY())
  return client
}

export const supabase = new Proxy({} as BrowserClient, {
  get: (_target, prop: string | symbol) =>
    Reflect.get(getClient() as object, prop),
})
