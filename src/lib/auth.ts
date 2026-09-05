/**
 * Singleton helper to fetch the default user.
 * The MVP has no auth (single-user prototype); every request uses this user.
 */
import { db } from '@/lib/db'

const DEFAULT_EMAIL = 'writer@cogdoc.local'

export async function getDefaultUser() {
  return db.user.upsert({
    where: { email: DEFAULT_EMAIL },
    update: {},
    create: { email: DEFAULT_EMAIL, displayName: 'Writer' },
  })
}
