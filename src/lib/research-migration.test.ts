import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(path.join(process.cwd(), 'prisma/migrations/202608310001_research_ide/migration.sql'), 'utf8')

describe('research IDE migration', () => {
  it('backfills legacy PDFs without deleting project-owned audit data', () => {
    expect(sql).toContain('INSERT INTO "LibrarySource"')
    expect(sql).toContain('INSERT INTO "WorkspaceSource"')
    expect(sql).toContain('FROM "Pdf"')
    expect(sql).toContain('UPDATE "Pdf" SET "librarySourceId"')
    expect(sql).not.toMatch(/DROP TABLE|DELETE FROM "(Pdf|Reference|Claim|EvidenceLink|AuditEvent)"/)
  })

  it('uses leases and idempotency for PostgreSQL research jobs', () => {
    expect(sql).toContain('"leaseExpiresAt" TIMESTAMP(3)')
    expect(sql).toContain('"ResearchJob_projectId_idempotencyKey_key"')
  })
})
