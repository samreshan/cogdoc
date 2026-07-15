/**
 * Supabase browser client (Phase 6, §8.7).
 *
 * Used by the client-side Login UI + any client component that needs the
 * session (sign-in, sign-out, OAuth). Server-side code uses the server client
 * in auth-supabase.ts (cookie-bound to the request).
 */
import { createBrowserClient } from '@supabase/ssr'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const key =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  ''

export const supabase = createBrowserClient(url, key)
