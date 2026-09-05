import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const schema = readFileSync(path.join(root, 'prisma/schema.prisma'), 'utf8')
const migrations = ['0002_rls_policies.sql', '0003_workspace_rls.sql', '0004_security_hardening.sql', '0005_research_ide_rls.sql']
  .map((name) => readFileSync(path.join(root, 'fastapi/migrations', name), 'utf8'))
  .join('\n')
const hardening = readFileSync(
  path.join(root, 'fastapi/migrations/0004_security_hardening.sql'),
  'utf8',
)

describe('Supabase security migration coverage', () => {
  it('enables RLS for every application model in the Prisma schema', () => {
    const models = [...schema.matchAll(/^model\s+(\w+)\s+\{/gm)].map((match) => match[1])
    const protectedTables = new Set(
      [...migrations.matchAll(/ALTER TABLE\s+"([^"]+)"\s+ENABLE ROW LEVEL SECURITY;/g)]
        .map((match) => match[1]),
    )

    expect(models.length).toBeGreaterThan(20)
    expect(models.filter((model) => !protectedTables.has(model))).toEqual([])
  })

  it('fails direct browser writes to protected service-owned tables', () => {
    expect(hardening).toContain('CREATE POLICY "users_self_select" ON "User" FOR SELECT')
    expect(hardening).not.toMatch(/CREATE POLICY[^;]+ON "PromptTemplate"/s)
    expect(hardening).not.toMatch(/CREATE POLICY[^;]+ON "CertificateRevocationTombstone"/s)
  })

  it('binds identity-bearing rows and linked evidence to the same workspace', () => {
    expect(hardening).toMatch(/"Pdf"\."projectId"[\s\S]+p\."userId" = auth\.uid\(\)::text/)
    expect(hardening).toMatch(/f\."projectId" = "Reference"\."projectId"/)
    expect(hardening).toMatch(/d\."projectId" = "Citation"\."projectId"/)
    expect(hardening).toMatch(/r\."projectId" = "ReviewItem"\."projectId"/)
    expect(hardening).toMatch(/f\."projectId" = c\."projectId"/)
    expect(hardening).toMatch(/s\."projectId" = c\."projectId"/)
    expect(hardening).toMatch(/"createdById" = auth\.uid\(\)::text/)
  })

  it('protects the global library and every project-owned research IDE table', () => {
    for (const table of ['LibrarySource', 'WorkspaceSource', 'ResearchNote', 'SourceAnnotation', 'ResearchAction', 'GroundedSynthesis', 'SynthesisFinding', 'SynthesisFindingPassage', 'AcademicProfile', 'ResearchJob']) {
      expect(migrations).toContain(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`)
    }
    expect(migrations).toContain('"userId" = auth.uid()::text')
  })

  it('provisions a private bucket and blocks browser roles restrictively', () => {
    expect(hardening).toContain("'cogdoc-private'")
    expect(hardening).toMatch(/public\s*=\s*false/)
    expect(hardening).toContain('AS RESTRICTIVE FOR ALL TO anon, authenticated')
    expect(hardening).toContain("USING (bucket_id <> 'cogdoc-private')")
  })
})
