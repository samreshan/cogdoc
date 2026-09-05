import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'node:crypto'

const db = new PrismaClient()
const workerId = `${process.pid}:${randomUUID()}`
const once = process.argv.includes('--once')
const LEASE_MS = 60_000
// These operations are completed synchronously during upload/save. They remain
// queue records for auditability, but no worker implementation is required.
const INLINE_MARKER_JOB_KINDS = new Set(['parse', 'deduplicate', 'quality', 'index', 'backlink'])

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

function documentText(content) {
  try {
    const root = JSON.parse(content)
    const visit = (node) => typeof node?.text === 'string' ? node.text : Array.isArray(node?.content) ? node.content.map(visit).join(' ') : ''
    return visit(root).replace(/\s+/g, ' ').trim()
  } catch { return String(content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() }
}

async function backgroundEnginePrompt(job) {
  const payload = JSON.parse(job.payloadJson || '{}')
  if (payload.findingRevisionId) {
    await db.researchExchange.updateMany({
      where: {
        projectId: job.projectId,
        findingRevisionId: { not: payload.findingRevisionId },
        operation: { startsWith: 'background_engine:pending:' },
        referencedIdsJson: { contains: String(payload.entityId).split(':')[0] },
      },
      data: { operation: 'background_engine:superseded:revision' },
    })
  }
  const pending = await db.researchExchange.findFirst({ where: { projectId: job.projectId, operation: { startsWith: 'background_engine:pending:' } } })
  if (pending) return { outcome: 'skipped', reason: 'A collaborator engine question is already pending.', pendingExchangeId: pending.id }

  let engine = 'socratic'
  let question = ''
  let reason = ''
  let questionId = payload.questionId || null
  let findingRevisionId = payload.findingRevisionId || null

  if (payload.trigger === 'finding_saved') {
    const revision = await db.findingRevision.findFirst({
      where: { id: findingRevisionId, projectId: job.projectId },
      include: { finding: { include: { question: true } }, evidences: true },
    })
    if (!revision || revision.finding.currentRevision !== revision.revision) return { outcome: 'superseded', reason: 'Finding revision is no longer current.' }
    questionId = revision.finding.questionId
    if (!revision.researcherExplanation?.trim()) {
      engine = 'socratic'; question = 'How would you explain this finding in your own words before reviewing it?'; reason = 'The current finding revision has no researcher explanation.'
    } else if (!revision.evidenceUnavailable && revision.evidences.length === 0) {
      engine = 'citation'; question = 'Which inspected source passage supports, qualifies, or contradicts this finding?'; reason = 'The finding claims evidence is available but has no linked passage.'
    } else if (!revision.uncertainty?.trim()) {
      engine = 'interceptor'; question = 'What uncertainty should remain visible if a reader relies on this finding?'; reason = 'The current finding revision does not state uncertainty.'
    } else if (!revision.limitations?.trim()) {
      engine = 'scaffold'; question = 'Complete this review scaffold: Claim — Evidence — Limitation — Implication. What belongs in the limitation?'; reason = 'The current finding revision does not state a limitation.'
    } else return { outcome: 'no_useful_gap', reason: 'The current finding already records explanation, evidence state, uncertainty, and limitations.' }
  } else if (payload.trigger === 'source_added') {
    const linked = await db.workspaceSource.findFirst({ where: { id: payload.entityId, projectId: job.projectId }, include: { source: true } })
    if (!linked) return { outcome: 'superseded', reason: 'The source is no longer attached.' }
    const context = await db.researchContext.findUnique({ where: { projectId: job.projectId } })
    questionId = context?.selectedQuestionId || null
    engine = 'citation'; question = `Before using “${linked.source.title}” as evidence, what content and locator will you inspect?`; reason = 'A source record was added, but a saved record is not yet inspected evidence.'
  } else if (payload.trigger === 'document_saved') {
    const project = await db.project.findUnique({ where: { id: job.projectId }, include: { document: true, researchContext: true } })
    const expectedRevision = Number(String(payload.entityId).split(':').at(-1))
    if (!project?.document || project.document.revision !== expectedRevision) return { outcome: 'superseded', reason: 'A newer document revision exists.' }
    const text = documentText(project.document.content)
    if (text.length < 80) return { outcome: 'no_useful_gap', reason: 'The saved document does not yet contain a meaningful passage.' }
    questionId = project.researchContext?.selectedQuestionId || null
    engine = 'socratic'; question = 'What is the most important claim in the passage you just saved, and what would change your mind about it?'; reason = 'A stable document revision introduced enough text for a bounded reasoning check.'
  } else return { outcome: 'unsupported_trigger' }

  const context = { questionId: questionId || undefined, sourceIds: [] }
  const envelope = {
    content: question, intent: 'challenge', providerStatus: 'deterministic_fallback', nextStep: 'Answer below, or say “I’m not sure—help me investigate.”',
    hypothetical: false, context,
  }
  const exchange = await db.researchExchange.create({ data: {
    projectId: job.projectId, questionId, findingRevisionId, speaker: 'assistant', origin: 'assistant', body: JSON.stringify(envelope),
    referencedIdsJson: JSON.stringify([String(payload.entityId)]), operation: `background_engine:pending:${engine}`,
    modelVersion: 'deterministic-background-v1', promptVersion: `background-${engine}-v1`, commandKey: `background-engine:${job.id}`,
  } })
  return { outcome: 'question_created', exchangeId: exchange.id, engine, reason }
}

async function perform(job) {
  if (job.kind === 'reprioritize') { await reprioritize(job.projectId); return { outcome: 'completed' } }
  else if (job.kind === 'synthesis') { await synthesize(job); return { outcome: 'completed' } }
  else if (job.kind === 'engine_prompt') return backgroundEnginePrompt(job)
  else if (INLINE_MARKER_JOB_KINDS.has(job.kind)) {
    // Parsing, dedupe, quality, indexing, and backlink jobs are idempotent
    // markers here: uploads already do the low-latency work synchronously.
  } else {
    // A new collaborator job must add an explicit handler. Falling through
    // would incorrectly report unperformed work as completed.
    throw new Error(`Unsupported research job kind: ${job.kind}`)
    return { outcome: 'inline_marker' }
  }
}

async function runOne() {
  const job = await lease()
  if (!job) return false
  try {
    const result = await perform(job)
    await db.researchJob.updateMany({ where: { id: job.id, status: 'running', leaseOwner: workerId }, data: { status: 'completed', resultJson: JSON.stringify(result ?? {}), progress: 100, completedAt: new Date(), leaseOwner: null, leaseExpiresAt: null, error: null } })
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
