import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const sql = readFileSync(path.join(root, 'prisma/migrations/202609050001_research_collaborator_foundation/migration.sql'), 'utf8')
const schema = readFileSync(path.join(root, 'prisma/schema.prisma'), 'utf8')

describe('research collaborator foundation migration', () => {
  it('adds independent research records without replacing legacy document or evidence tables', () => {
    for (const table of ['ResearchContext', 'ResearchQuestion', 'ResearchExchange', 'ResearchFinding', 'FindingRevision', 'FindingEvidence', 'FindingReview', 'ResearchArticle', 'ArticleInput']) {
      expect(sql).toContain(`CREATE TABLE "${table}"`)
    }
    expect(sql).not.toMatch(/DROP TABLE|DELETE FROM "(Project|Document|Claim|SynthesisFinding|AuditEvent|Certificate|Pdf)"/)
    expect(sql).not.toContain('ALTER TABLE "Document"')
  })

  it('keeps article content outside the unique legacy project document', () => {
    expect(schema).toMatch(/model ResearchArticle[\s\S]*?content\s+String/)
    expect(sql).toContain('CREATE TABLE "ResearchArticle"')
    expect(sql).not.toContain('ALTER TABLE "Document" ADD COLUMN "article')
  })

  it('stores revision snapshots and explicit reviews without promoting legacy synthesis', () => {
    expect(sql).toContain('"currentRevision" INTEGER NOT NULL DEFAULT 0')
    expect(sql).toContain('"FindingRevision_findingId_revision_key"')
    expect(sql).toContain('"reviewerId" TEXT NOT NULL')
    expect(sql).toContain('"dependencyHash" TEXT NOT NULL')
    expect(sql).not.toMatch(/INSERT INTO "FindingReview"|INSERT INTO "ResearchFinding"/)
  })

  it('has stable command keys and foreign-keyed source/finding/article relations', () => {
    expect(sql).toContain('"ResearchExchange_projectId_commandKey_key"')
    expect(sql).toContain('"FindingReview_projectId_commandKey_key"')
    expect(sql).toContain('"ResearchArticle_projectId_commandKey_key"')
    expect(sql).toContain('"QuestionResource_workspaceSourceId_fkey"')
    expect(sql).toContain('"ArticleInput_findingRevisionId_fkey"')
  })
})
