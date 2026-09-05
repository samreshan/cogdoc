import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'node:crypto'

const db = new PrismaClient()
const workerId = `${process.pid}:${randomUUID()}`
const once = process.argv.includes('--once')
const LEASE_MS = 60_000

async function lease() {
  return db.$transaction(async (tx) => {
    const now = new Date()
    const job = await tx.researchJob.findFirst({
      where: { OR: [
        { status: 'queued', availableAt: { lte: now }, OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lt: now } }] },
        { status: 'running', leaseExpiresAt: { lt: now } },
      ] },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    })
    if (!job) return null
    const claimed = await tx.researchJob.updateMany({
      where: { id: job.id, OR: [
        { status: 'queued', availableAt: { lte: now }, OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lt: now } }] },
        { status: 'running', leaseExpiresAt: { lt: now } },
      ] },
      data: { status: 'running', leaseOwner: workerId, leaseExpiresAt: new Date(now.getTime() + LEASE_MS), attempts: { increment: 1 }, progress: 5 },
    })
    return claimed.count === 1 ? { ...job, attempts: job.attempts + 1 } : null
  })
}

async function reprioritize(projectId) {
  const project = await db.project.findUnique({ where: { id: projectId }, select: { dueAt: true } })
  const reviewItems = await db.reviewItem.findMany({ where: { projectId, state: { notIn: ['resolved', 'dismissed'] } } })
  for (const item of reviewItems) {
    const existing = await db.researchAction.findFirst({ where: { projectId, targetKind: 'action', targetId: item.id } })
    if (!existing) {
      const factors = {
        pinned: 0,
        blocker: item.blocksCertification ? 30 : 0,
        deadline: 0,
        evidence: ['claim_needs_evidence', 'evidence_passage_required'].includes(item.type) ? 18 : 0,
        requirement: item.type === 'rubric_gap' ? 14 : 0,
        citation: ['citation_missing_reference', 'reference_metadata_unverified', 'bibliography_missing'].includes(item.type) ? 12 : 0,
        quality: 0,
        centrality: item.claimId ? 6 : 0,
        aiAdjustment: 0,
      }
      await db.researchAction.create({ data: {
        projectId, kind: item.type, title: item.title, detail: item.detail,
        priority: Object.values(factors).reduce((sum, value) => sum + value, 0),
        priorityFactorsJson: JSON.stringify(factors), targetKind: 'action', targetId: item.id,
        documentAnchorJson: item.anchorJson,
      } })
    }
  }
  const actions = await db.researchAction.findMany({ where: { projectId, state: 'open' } })
  const now = Date.now()
  const deadline = project?.dueAt ? Math.max(0, Math.min(18, Math.ceil(18 - (project.dueAt.getTime() - now) / 86_400_000))) : 0
  await Promise.all(actions.map((action) => {
    let factors = {}
    try { factors = JSON.parse(action.priorityFactorsJson) } catch {}
    const next = { ...factors, pinned: action.pinned ? 100 : 0, deadline, aiAdjustment: Math.max(-5, Math.min(5, Number(factors.aiAdjustment ?? 0))) }
    return db.researchAction.update({ where: { id: action.id }, data: { priority: Object.values(next).reduce((sum, value) => sum + Number(value || 0), 0), priorityFactorsJson: JSON.stringify(next) } })
  }))
}

async function synthesize(job) {
  const payload = JSON.parse(job.payloadJson)
  const synthesis = await db.groundedSynthesis.findFirst({ where: { id: payload.synthesisId, projectId: job.projectId } })
  if (!synthesis) throw new Error('Synthesis no longer exists')
  const chunks = await db.pdfChunk.findMany({ where: { id: { in: payload.passageIds }, pdf: { projectId: job.projectId } }, orderBy: [{ pdfId: 'asc' }, { chunkIndex: 'asc' }] })
  if (!chunks.length) throw new Error('No owned indexed passages are available')
  await db.$transaction(async (tx) => {
    await tx.synthesisFinding.deleteMany({ where: { synthesisId: synthesis.id } })
    for (const [index, chunk] of chunks.entries()) {
      const text = chunk.content.split(/(?<=[.!?])\s+/).slice(0, 2).join(' ').slice(0, 700)
      await tx.synthesisFinding.create({ data: { synthesisId: synthesis.id, text, confidence: 1, sortOrder: index, passages: { create: [{ passageId: chunk.id }] } } })
    }
    await tx.groundedSynthesis.update({ where: { id: synthesis.id }, data: { status: 'ready' } })
  })
}

async function perform(job) {
  if (job.kind === 'reprioritize') await reprioritize(job.projectId)
  else if (job.kind === 'synthesis') await synthesize(job)
  // Parsing, dedupe, quality, indexing, and backlink jobs are idempotent
  // markers here: uploads already do the low-latency work synchronously.
}

async function runOne() {
  const job = await lease()
  if (!job) return false
  try {
    await perform(job)
    await db.researchJob.updateMany({ where: { id: job.id, status: 'running', leaseOwner: workerId }, data: { status: 'completed', progress: 100, completedAt: new Date(), leaseOwner: null, leaseExpiresAt: null, error: null } })
  } catch (error) {
    const failed = job.attempts >= job.maxAttempts
    await db.researchJob.updateMany({ where: { id: job.id, status: 'running', leaseOwner: workerId }, data: { status: failed ? 'failed' : 'queued', availableAt: new Date(Date.now() + Math.min(60_000, 2 ** job.attempts * 1_000)), leaseOwner: null, leaseExpiresAt: null, error: String(error?.message ?? error) } })
  }
  return true
}

try {
  do {
    const worked = await runOne()
    if (once) break
    if (!worked) await new Promise((resolve) => setTimeout(resolve, 1_500))
  } while (true)
} finally {
  await db.$disconnect()
}
