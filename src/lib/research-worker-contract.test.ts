import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const worker = readFileSync(path.join(process.cwd(), 'scripts/research-worker.mjs'), 'utf8')
const verification = readFileSync(path.join(process.cwd(), 'scripts/verify-research-worker-unknown-job.js'), 'utf8')

describe('research worker contract', () => {
  it('only completes implemented or explicit synchronous marker job kinds', () => {
    expect(worker).toContain("const INLINE_MARKER_JOB_KINDS = new Set(['parse', 'deduplicate', 'quality', 'index', 'backlink'])")
    expect(worker).toContain('throw new Error(`Unsupported research job kind: ${job.kind}`)')
  })

  it('ships an executable disposable-database regression for unknown job handling', () => {
    expect(verification).toContain("['scripts/research-worker.mjs', '--once']")
    expect(verification).toContain("updated.status === 'completed'")
    expect(verification).toContain("Unsupported research job kind")
  })
})
