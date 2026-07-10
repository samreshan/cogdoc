/**
 * GET /api/user — return the acting user profile.
 *
 * When Supabase auth is configured, resolves the session user. Otherwise falls
 * back to the default user (local dev / tests).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getSession, isSupabaseAuthConfigured } from '@/lib/auth-supabase'
import { getDefaultUser } from '@/lib/auth'

export async function GET(req: NextRequest) {
  if (isSupabaseAuthConfigured()) {
    const session = await getSession(req)
    if (session?.user) {
      return NextResponse.json({
        user: {
          id: session.user.id,
          email: session.user.email ?? null,
          displayName: null,
          dailyTokenBudget: null,
        },
      })
    }
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  }
  const user = await getDefaultUser()
  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      dailyTokenBudget: user.dailyTokenBudget,
    },
  })
}
