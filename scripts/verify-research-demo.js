const { PrismaClient } = require('@prisma/client')
const { PDFDocument } = require('pdf-lib')
const { readFile } = require('node:fs/promises')
const { createHash } = require('node:crypto')
const path = require('node:path')
const { DEMO_TITLE, DEMO_MARKER, interventions, claims } = require('./research-demo-fixture')

const db = new PrismaClient()

function assert(condition, message, failures) {
  if (!condition) failures.push(message)
}

function verifyAuditChain(events) {
  let previousHash = null
  for (const event of events) {
    const digest = createHash('sha256').update(JSON.stringify({
      projectId: event.projectId, userId: event.userId, type: event.type, actor: event.actor,
      payloadJson: event.payloadJson, documentHash: event.documentHash, modelVersion: event.modelVersion,
      promptVersion: event.promptVersion, previousHash: event.previousHash, createdAt: event.createdAt.toISOString(),
    })).digest('hex')
    if (!event.eventHash || event.previousHash !== previousHash || event.eventHash !== digest) return false
    previousHash = event.eventHash
  }
  return true
}

async function main() {
  const demoCount = await db.project.count({ where: { title: DEMO_TITLE, description: { contains: DEMO_MARKER } } })
  const workspace = await db.project.findFirst({
    where: { title: DEMO_TITLE, description: { contains: DEMO_MARKER } },
    orderBy: { createdAt: 'desc' },
    include: {
      document: true,
      pdfs: { include: { chunks: true, librarySource: true } },
      interventions: { include: { evidences: true } },
      references: true,
      citations: true,
      claims: { include: { evidenceLinks: true } },
      requirements: true,
      researchActions: true,
      researchNotes: true,
      sourceAnnotations: true,
      groundedSyntheses: { include: { findings: { include: { passages: true } } } },
      academicProfiles: true,
      reviewRuns: { include: { items: true } },
      auditEvents: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
    },
  })
  if (!workspace) throw new Error('Research demo workspace not found. Run `npm run demo:research` first.')

  const failures = []
  assert(demoCount === 1, `expected one marked demo workspace, found ${demoCount}`, failures)
  const documentContent = workspace.document?.content ?? ''
  const engineTypes = new Set(workspace.interventions.filter((item) => item.status === 'active').map((item) => item.engineType))
  const passages = workspace.pdfs.flatMap((pdf) => pdf.chunks)
  const findingPassages = workspace.groundedSyntheses.flatMap((synthesis) => synthesis.findings.flatMap((finding) => finding.passages))
  const interventionAuditIds = new Set(workspace.auditEvents
    .filter((event) => event.type === 'intervention_created')
    .map((event) => {
      try {
        return JSON.parse(event.payloadJson).interventionId
      } catch {
        return null
      }
    })
    .filter(Boolean))

  for (const pdf of workspace.pdfs) {
    if (pdf.librarySource?.storageProvider !== 'filesystem' || !pdf.librarySource.storageKey) continue
    try {
      const root = process.env.COGDOC_STORAGE_DIR ?? path.join(process.cwd(), '.data', 'assets')
      const bytes = await readFile(path.join(root, pdf.librarySource.storageKey))
      const privatePdf = await PDFDocument.load(bytes)
      assert(privatePdf.getPageCount() === pdf.chunks.length, `${pdf.filename} private page count does not match its indexed passages`, failures)
    } catch (error) {
      failures.push(`${pdf.filename} private PDF is unreadable: ${error.message}`)
    }
  }

  assert(workspace.document?.contentHash, 'document snapshot is missing', failures)
  assert(Object.values(claims).every((claim) => documentContent.includes(claim)), 'one or more anchored claims are absent from the document', failures)
  assert(interventions.every((item) => documentContent.includes(item.promptText)), 'an intervention is not anchored to exact document text', failures)
  assert(['citation', 'interceptor', 'scaffold', 'socratic'].every((engine) => engineTypes.has(engine)), 'all four intervention engines must be active', failures)
  assert(workspace.pdfs.length >= 3, 'at least three project PDFs are required', failures)
  assert(passages.length >= 9, 'at least nine indexed passages are required', failures)
  assert(workspace.pdfs.every((pdf) => pdf.parseStatus === 'ready' && pdf.librarySource?.storageKey), 'every source must be parsed and backed by private storage', failures)
  assert(workspace.references.length >= 3 && workspace.references.every((reference) => reference.metadataStatus === 'confirmed'), 'verified references are incomplete', failures)
  assert(workspace.citations.length >= 3, 'structured citation records are incomplete', failures)
  assert(workspace.claims.length >= 4 && workspace.claims.some((claim) => claim.evidenceLinks.length >= 2), 'claim/evidence graph is incomplete', failures)
  assert(workspace.researchActions.length >= 3 && workspace.researchActions.some((action) => action.pinned), 'prioritized action queue is incomplete', failures)
  assert(workspace.researchNotes.length >= 1 && workspace.sourceAnnotations.length >= 1, 'linked notebook or source annotations are missing', failures)
  assert(workspace.groundedSyntheses.some((synthesis) => synthesis.status === 'completed') && findingPassages.length >= 3, 'passage-grounded synthesis is incomplete', failures)
  assert(workspace.academicProfiles.length >= 1, 'academic profile is missing', failures)
  assert(workspace.reviewRuns.some((run) => run.status === 'ready' && run.items.length >= 2), 'review snapshot is incomplete', failures)
  assert(workspace.auditEvents.filter((event) => event.actor === 'student').length >= 8, 'decision history is incomplete', failures)
  assert(workspace.interventions.every((intervention) => interventionAuditIds.has(intervention.id)), 'intervention creation history is incomplete', failures)
  assert(verifyAuditChain(workspace.auditEvents), 'demo audit chain is incomplete or invalid', failures)

  const counts = {
    workspaceId: workspace.id,
    sources: workspace.pdfs.length,
    passages: passages.length,
    interventions: workspace.interventions.length,
    interventionEngines: [...engineTypes].sort(),
    claims: workspace.claims.length,
    evidenceLinks: workspace.claims.reduce((sum, claim) => sum + claim.evidenceLinks.length, 0),
    references: workspace.references.length,
    citations: workspace.citations.length,
    actions: workspace.researchActions.length,
    notes: workspace.researchNotes.length,
    synthesisPassages: findingPassages.length,
    decisions: workspace.auditEvents.filter((event) => event.actor === 'student').length,
    auditEvents: workspace.auditEvents.length,
    auditIntegrity: verifyAuditChain(workspace.auditEvents) ? 'verified' : 'broken',
  }

  if (failures.length) {
    console.error('Research demo verification failed:')
    for (const failure of failures) console.error(`  - ${failure}`)
    console.error(JSON.stringify(counts, null, 2))
    process.exitCode = 1
    return
  }
  console.log('Research demo verification passed.')
  console.log(JSON.stringify(counts, null, 2))
}

main()
  .catch((error) => {
    console.error('Research demo verification failed:', error)
    process.exitCode = 1
  })
  .finally(async () => db.$disconnect())
