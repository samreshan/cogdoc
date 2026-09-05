import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const routes = [
  'src/app/api/interceptor/route.ts',
  'src/app/api/autocomplete/route.ts',
  'src/app/api/blindspot/route.ts',
  'src/app/api/citation-sentinel/route.ts',
  'src/app/api/scaffold/route.ts',
  'src/app/api/socratic-spacer/route.ts',
]

describe('intervention audit coverage', () => {
  it.each(routes)('%s seals every newly persisted intervention', (route) => {
    const source = readFileSync(route, 'utf8')
    expect(source).toContain("type: 'intervention_created'")
    expect(source).toContain("actor: 'system'")
    expect(source).toContain('appendAuditEvent')
    expect(source).not.toContain('appendAuditEvent(db')
  })
})
