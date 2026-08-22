/* One-time, idempotent migration of pre-workspace Cogdoc projects. */
const { createHash } = require('node:crypto')
const { PrismaClient } = require('@prisma/client')

const db = new PrismaClient()
const paceByFriction = { assistant: 'rapid', coach: 'guided', socratic: 'deep' }

function hash(value) {
  return createHash('sha256').update(value).digest('hex')
}

function canonicalContent(content) {
  const value = typeof content === 'string' ? content.trim() : ''
  if (value.startsWith('{')) {
    try { return JSON.stringify(JSON.parse(value)) } catch { /* legacy HTML */ }
  }
  if (!value) return JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] })
  return value
}

async function append(projectId, userId, type, payload, documentHash) {
  const previous = await db.auditEvent.findFirst({ where: { projectId }, orderBy: { createdAt: 'desc' } })
  const createdAt = new Date()
  const payloadJson = JSON.stringify(payload)
  const eventHash = hash(JSON.stringify({
    projectId, userId, type, actor: 'system', payloadJson, documentHash: documentHash || null,
    modelVersion: null, promptVersion: null, previousHash: previous?.eventHash || null,
    createdAt: createdAt.toISOString(),
  }))
  await db.auditEvent.create({ data: {
    projectId, userId, type, actor: 'system', payloadJson, documentHash: documentHash || null,
    previousHash: previous?.eventHash || null, eventHash, createdAt,
  } })
}

async function main() {
  const projects = await db.project.findMany({
    where: { auditEvents: { none: { type: { in: ['workspace_created', 'legacy_workspace_migrated'] } } } },
    include: { user: true, document: true, interventions: { orderBy: { createdAt: 'asc' } } },
  })
  for (const project of projects) {
    const content = canonicalContent(project.document?.content || '')
    const contentHash = hash(content)
    await db.$transaction(async (tx) => {
      await tx.project.update({ where: { id: project.id }, data: {
        workspaceType: 'research', reviewPace: paceByFriction[project.user.frictionMode] || 'deep', lifecycleState: 'draft',
      } })
      if (project.document) {
        await tx.document.update({ where: { id: project.document.id }, data: { content, contentHash } })
      }
    })
    for (const intervention of project.interventions) {
      await append(project.id, project.userId, 'legacy_intervention', {
        interventionId: intervention.id, engineType: intervention.engineType,
        status: intervention.status, userAction: intervention.userAction,
      }, contentHash)
    }
    await append(project.id, project.userId, 'legacy_workspace_migrated', {
      from: 'project', workspaceType: 'research', reviewPace: paceByFriction[project.user.frictionMode] || 'deep',
      requiresFreshReviewForCertification: true,
    }, contentHash)
  }
  console.log(`Migrated ${projects.length} legacy workspace(s).`)
}

main().finally(() => db.$disconnect())
