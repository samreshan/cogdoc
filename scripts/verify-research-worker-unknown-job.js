#!/usr/bin/env node
/* Verify that an unsupported queued job enters retry/fail handling, never completed. */
const { spawnSync } = require('node:child_process')
const { PrismaClient } = require('@prisma/client')

const db = new PrismaClient()

async function main() {
  const project = await db.project.findFirst({ where: { deletedAt: null }, select: { id: true } })
  if (!project) throw new Error('A disposable workspace is required to verify the worker.')
  const key = `verify-unknown-job:${crypto.randomUUID()}`
  const job = await db.researchJob.create({ data: { projectId: project.id, kind: 'unknown_sprint_verification', maxAttempts: 1, idempotencyKey: key } })
  try {
    const result = spawnSync(process.execPath, ['scripts/research-worker.mjs', '--once'], { env: process.env, encoding: 'utf8' })
    if (result.error) throw result.error
    const updated = await db.researchJob.findUniqueOrThrow({ where: { id: job.id }, select: { status: true, error: true } })
    if (updated.status === 'completed') throw new Error('Unsupported job was incorrectly marked completed.')
    if (!['queued', 'failed'].includes(updated.status) || !updated.error?.includes('Unsupported research job kind')) {
      throw new Error(`Unsupported job did not enter retry/fail handling: ${JSON.stringify(updated)}`)
    }
    console.log(JSON.stringify({ status: updated.status, error: updated.error, workerExitCode: result.status }, null, 2))
  } finally {
    await db.researchJob.deleteMany({ where: { id: job.id } })
  }
}

main()
  .catch((error) => { console.error('Worker unknown-job verification failed:', error.message); process.exitCode = 1 })
  .finally(() => db.$disconnect())
