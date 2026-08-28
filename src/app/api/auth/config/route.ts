import { NextResponse } from 'next/server'
import { isExplicitSingleUserMode, isSupabaseAuthConfigured } from '@/lib/auth-supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Public runtime configuration for the browser auth gate. Supabase publishable
 * keys are designed to be public; service-role credentials are never returned.
 */
export async function GET() {
  if (isSupabaseAuthConfigured()) {
    return NextResponse.json({
      mode: 'supabase',
      supabase: {
        url: process.env.NEXT_PUBLIC_SUPABASE_URL,
        publishableKey:
          process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
          ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      },
    }, { headers: { 'Cache-Control': 'no-store' } })
  }

  if (process.env.NODE_ENV !== 'production' || isExplicitSingleUserMode()) {
    return NextResponse.json({
      mode: process.env.NODE_ENV === 'production' ? 'single_user' : 'local_development',
    }, { headers: { 'Cache-Control': 'no-store' } })
  }

  return NextResponse.json({
    mode: 'misconfigured',
    message: 'Configure Supabase authentication or explicitly enable private single-user mode.',
  }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
}
