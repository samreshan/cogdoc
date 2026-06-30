/**
 * Singleton helper to fetch the default user.
 * The MVP has no auth (single-user prototype); every request uses this user.
 */
import { db } from '@/lib/db'

const DEFAULT_EMAIL = 'writer@cogdoc.local'

export async function getDefaultUser() {
  let user = await db.user.findUnique({ where: { email: DEFAULT_EMAIL } })
  if (!user) {
    user = await db.user.create({
      data: {
        email: DEFAULT_EMAIL,
        displayName: 'Writer',
      },
    })
  }
  return user
}
