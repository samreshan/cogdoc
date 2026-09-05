import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const routes = [
  'src/app/api/certificates/[id]/share/route.ts',
  'src/app/api/interventions/[id]/responses/route.ts',
  'src/app/api/interventions/[id]/route.ts',
  'src/app/api/projects/[id]/document/route.ts',
  'src/app/api/projects/[id]/route.ts',
  'src/app/api/projects/route.ts',
  'src/app/api/research-dialogue/route.ts',
  'src/app/api/research-kickoff/route.ts',
  'src/app/api/review-items/[id]/recheck/route.ts',
  'src/app/api/review-items/[id]/responses/route.ts',
  'src/app/api/workspaces/[id]/actions/route.ts',
  'src/app/api/workspaces/[id]/annotations/route.ts',
  'src/app/api/workspaces/[id]/jobs/route.ts',
  'src/app/api/workspaces/[id]/notebook/route.ts',
  'src/app/api/workspaces/[id]/profiles/route.ts',
  'src/app/api/workspaces/[id]/references/route.ts',
  'src/app/api/workspaces/[id]/sources/route.ts',
  'src/app/api/workspaces/[id]/syntheses/route.ts',
  'src/app/api/workspaces/[id]/route.ts',
  'src/app/api/workspaces/route.ts',
]

describe('research decision audit coverage', () => {
  it.each(routes)('%s records committed user choices', (route) => {
    const source = readFileSync(resolve(process.cwd(), route), 'utf8')
    expect(source).toContain('appendAuditEvent')
    expect(source).not.toContain('appendAuditEvent(db')
  })
})
