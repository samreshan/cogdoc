/**
 * GET /api/user — return the acting user profile.
 *
 * When Supabase auth is configured, resolves the session user. Otherwise falls
 * back to the default user (local dev / tests).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getSession, isSupabaseAuthConfigured, requireUserId } from '@/lib/auth-supabase'
import { getDefaultUser } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  if (isSupabaseAuthConfigured()) {
    const session = await getSession(req)
    if (session?.user) {
      const profile = await db.user.upsert({
        where: { id: session.user.id },
        update: { lastLogin: new Date() },
        create: {
          id: session.user.id,
          email: session.user.email ?? `${session.user.id}@cogdoc.local`,
          displayName: session.user.user_metadata?.display_name ?? null,
          lastLogin: new Date(),
        },
        select: { id: true, email: true, displayName: true, dailyTokenBudget: true, onboardingCompletedAt: true },
      })
      return NextResponse.json({
        user: profile,
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
      onboardingCompletedAt: user.onboardingCompletedAt,
    },
  })
}

export async function PATCH(req: NextRequest) {
  const userId = await requireUserId(req)
  const body = await req.json().catch(() => ({})) as { onboardingCompleted?: unknown }
  if (typeof body.onboardingCompleted !== 'boolean') {
    return NextResponse.json({ error: 'onboardingCompleted must be a boolean' }, { status: 400 })
  }
  const user = await db.user.update({
    where: { id: userId },
    data: { onboardingCompletedAt: body.onboardingCompleted ? new Date() : null },
    select: { onboardingCompletedAt: true },
  })
  return NextResponse.json({ onboardingCompletedAt: user.onboardingCompletedAt })
}
