import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const script = readFileSync(path.join(process.cwd(), 'scripts/backfill-research-collaborator-foundation.js'), 'utf8')

describe('research collaborator backfill', () => {
  it('is opt-in and creates only an empty context shell', () => {
    expect(script).toContain("process.argv.includes('--apply')")
    expect(script).toContain('researchContext.upsert')
    expect(script).toContain("topic: ''")
    expect(script).not.toContain('researchFinding.create')
    expect(script).not.toContain('findingReview.create')
  })
})
