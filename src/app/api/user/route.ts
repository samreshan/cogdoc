/**
 * GET /api/user — return the default user profile.
 */
import { NextResponse } from 'next/server'
import { getDefaultUser } from '@/lib/auth'

export async function GET() {
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
