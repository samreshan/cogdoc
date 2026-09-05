#!/usr/bin/env node
/*
 * Optional, idempotent bridge for existing research workspaces.
 *
 * It creates only the empty ResearchContext shell keyed by Project.id. It does
 * not infer questions, explanations, findings, review decisions, or article
 * input from legacy notes/syntheses/documents. Those conversions require a
 * later explicit user preview.
 *
 * Run without --apply to inspect the impact. Use only with an identified
 * development or reviewed deployment database; never use db reset for this.
 */
const { PrismaClient } = require('@prisma/client')

const db = new PrismaClient()
const apply = process.argv.includes('--apply')

async function main() {
  const projects = await db.project.findMany({
    where: { workspaceType: 'research', deletedAt: null },
    select: { id: true, archived: true },
  })
  const existing = await db.researchContext.findMany({ select: { projectId: true } })
  const existingIds = new Set(existing.map((context) => context.projectId))
  const missing = projects.filter((project) => !existingIds.has(project.id))

  if (!apply) {
    console.log(JSON.stringify({ mode: 'dry-run', existing: existing.length, wouldCreate: missing.length, archived: missing.filter((project) => project.archived).length }, null, 2))
    return
  }

  for (const project of missing) {
    await db.researchContext.upsert({
      where: { projectId: project.id },
      update: {},
      create: {
        projectId: project.id,
        // A legacy title is not silently treated as a research topic. The UI
        // asks the researcher to supply/review it when they opt into the flow.
        topic: '',
        lifecycleState: project.archived ? 'archived' : 'exploring',
      },
    })
  }
  console.log(JSON.stringify({ mode: 'apply', created: missing.length, existing: existing.length }, null, 2))
}

main()
  .catch((error) => {
    console.error('Research collaborator backfill failed:', error.message)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
