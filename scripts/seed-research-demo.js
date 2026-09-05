const { PrismaClient } = require('@prisma/client')
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib')
const { createHash } = require('node:crypto')
const { mkdir, access, writeFile } = require('node:fs/promises')
const path = require('node:path')
const {
  DEMO_TITLE,
  DEMO_MARKER,
  sources,
  claims,
  interventions,
  actions,
  buildDocument,
} = require('./research-demo-fixture')

const db = new PrismaClient()
const DEFAULT_EMAIL = 'writer@cogdoc.local'

const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const json = (value) => JSON.stringify(value)
let auditSequence = 0

async function appendAudit({ projectId, userId, type, actor = 'student', payload = {}, documentHash = null, modelVersion = null, promptVersion = null }) {
  const previous = await db.auditEvent.findFirst({ where: { projectId }, orderBy: { createdAt: 'desc' }, select: { eventHash: true } })
  const createdAt = new Date(Date.now() + auditSequence++)
  const payloadJson = json(payload)
  const previousHash = previous?.eventHash ?? null
  const eventHash = sha256(json({ projectId, userId, type, actor, payloadJson, documentHash, modelVersion, promptVersion, previousHash, createdAt: createdAt.toISOString() }))
  return db.auditEvent.create({ data: { projectId, userId, type, actor, payloadJson, documentHash, modelVersion, promptVersion, previousHash, eventHash, createdAt } })
}

function documentPlainText(node) {
  if (!node || typeof node !== 'object') return ''
  if (typeof node.text === 'string') return node.text
  if (node.type === 'structuredCitation') {
    const author = node.attrs?.author ?? 'Source'
    const year = node.attrs?.year ?? 'n.d.'
    return `(${author}, ${year})`
  }
  const children = Array.isArray(node.content) ? node.content.map(documentPlainText).filter(Boolean) : []
  return children.join(['doc', 'heading', 'paragraph'].includes(node.type) ? '\n' : '')
}

function anchor(quote, section) {
  return json({ quote, section, exact: true, demo: true })
}

function referenceText(source) {
  const authors = source.authors.join(', ')
  return `${authors} (${source.year}) ${source.title}. ${source.venue}.${source.doi ? ` https://doi.org/${source.doi}` : ` ${source.url}`}`
}

async function demoPdfBytes(source) {
  const pdf = await PDFDocument.create()
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const wrap = (text, length = 88) => {
    const words = text.split(/\s+/)
    const lines = []
    let line = ''
    for (const word of words) {
      if (`${line} ${word}`.trim().length > length) {
        lines.push(line)
        line = word
      } else line = `${line} ${word}`.trim()
    }
    if (line) lines.push(line)
    return lines
  }

  for (const chunk of source.chunks) {
    const page = pdf.addPage([612, 792])
    page.drawText('COGDOC RESEARCH DEMO', { x: 54, y: 742, size: 9, font: bold, color: rgb(0.55, 0.32, 0.16) })
    let y = 708
    for (const line of wrap(source.title, 72)) {
      page.drawText(line, { x: 54, y, size: 15, font: bold, color: rgb(0.08, 0.2, 0.17) })
      y -= 20
    }
    y -= 10
    page.drawText(`Demo packet page ${chunk.page} · publication locator p. ${chunk.sourcePage}`, { x: 54, y, size: 10, font: regular, color: rgb(0.35, 0.35, 0.32) })
    y -= 34
    for (const line of wrap(chunk.text)) {
      page.drawText(line, { x: 54, y, size: 11, font: regular, color: rgb(0.12, 0.12, 0.11) })
      y -= 17
    }
    page.drawText('This page contains a clearly labelled demo paraphrase, not a quotation from the publication.', { x: 54, y: 54, size: 8, font: regular, color: rgb(0.45, 0.42, 0.37) })
  }
  return Buffer.from(await pdf.save())
}

async function storeFixturePdf(projectId, source, existingSource) {
  if (existingSource?.storageProvider && existingSource?.storageKey) {
    if (existingSource.storageProvider !== 'filesystem') return null
    const root = process.env.COGDOC_STORAGE_DIR ?? path.join(process.cwd(), '.data', 'assets')
    const full = path.join(root, existingSource.storageKey)
    try {
      await access(full)
      return null
    } catch {
      const bytes = await demoPdfBytes(source)
      await mkdir(path.dirname(full), { recursive: true })
      await writeFile(full, bytes)
      return { provider: 'filesystem', key: existingSource.storageKey, bytes }
    }
  }
  const bytes = await demoPdfBytes(source)
  const key = `${projectId}/research-demo-${source.key}.pdf`
  const root = process.env.COGDOC_STORAGE_DIR ?? path.join(process.cwd(), '.data', 'assets')
  const full = path.join(root, key)
  await mkdir(path.dirname(full), { recursive: true })
  await writeFile(full, bytes)
  return { provider: 'filesystem', key, bytes }
}

async function upsertLibrarySource(userId, projectId, source) {
  const rawText = source.chunks.map((chunk) => chunk.text).join('\n\n')
  const contentHash = sha256(rawText)
  const identifiers = [{ contentHash }, ...(source.doi ? [{ doi: source.doi }] : []), ...(source.url ? [{ canonicalUrl: source.url }] : [])]
  let librarySource = await db.librarySource.findFirst({ where: { userId, OR: identifiers } })
  const stored = await storeFixturePdf(projectId, source, librarySource)
  if (!librarySource) {
    librarySource = await db.librarySource.create({ data: {
      userId,
      title: source.title,
      filename: source.filename,
      doi: source.doi,
      canonicalUrl: source.url,
      contentHash,
      mimeType: 'application/pdf',
      sizeBytes: stored?.bytes.length ?? Buffer.byteLength(rawText),
      parseStatus: 'ready',
      storageProvider: stored?.provider,
      storageKey: stored?.key,
      metadataJson: json({ authors: source.authors, year: source.year, venue: source.venue, fixture: true, passageKind: 'demo_paraphrase' }),
      qualityScore: source.qualityScore,
      qualityExplanation: source.qualityExplanation,
    } })
  } else if (stored) {
    librarySource = await db.librarySource.update({ where: { id: librarySource.id }, data: {
      storageProvider: stored.provider,
      storageKey: stored.key,
      sizeBytes: stored.bytes.length,
      mimeType: 'application/pdf',
      parseStatus: 'ready',
    } })
  }
  return { librarySource, rawText }
}

async function embedSources(projectId, pdfsByKey) {
  const base = (process.env.FASTAPI_URL ?? 'http://localhost:8000').replace(/\/$/, '')
  for (const [key, record] of Object.entries(pdfsByKey)) {
    try {
      const response = await fetch(`${base}/api/rag/ingest`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: json({
          project_id: projectId,
          pdf_id: record.pdf.id,
          chunks: record.chunks.map((chunk) => ({ chunk_id: chunk.id, content: chunk.content, page_approx: chunk.pageApprox })),
        }),
      })
      if (!response.ok) throw new Error(`${response.status} ${await response.text()}`)
      console.log(`Embedded ${record.chunks.length} passages for ${key}`)
    } catch (error) {
      console.warn(`Embedding skipped for ${key}: ${error.message}`)
    }
  }
}

async function main() {
  const user = await db.user.upsert({
    where: { email: DEFAULT_EMAIL },
    update: {},
    create: { email: DEFAULT_EMAIL, displayName: 'Researcher' },
  })

  const previous = await db.project.findMany({
    where: { userId: user.id, title: DEMO_TITLE, description: { contains: DEMO_MARKER } },
    select: { id: true },
  })
  if (previous.length) {
    const projectIds = previous.map((project) => project.id)
    await db.$transaction([
      // Passage grounding is deliberately restrictive. Remove only the join
      // rows owned by marked demo syntheses before cascading the demo project.
      db.synthesisFindingPassage.deleteMany({ where: { finding: { synthesis: { projectId: { in: projectIds } } } } }),
      db.project.deleteMany({ where: { id: { in: projectIds } } }),
    ])
    console.log(`Replaced ${previous.length} marked research demo workspace(s).`)
  }

  const project = await db.project.create({ data: {
    userId: user.id,
    title: DEMO_TITLE,
    description: `${DEMO_MARKER} A reproducible, passage-grounded workspace for demonstrating Cogdoc's research workflow.`,
    workspaceType: 'research',
    reviewPace: 'deep',
    citationStyle: 'harvard',
    lifecycleState: 'reviewing',
    dueAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    briefText: 'Develop and evaluate a provenance-first research IDE. Preserve researcher agency, ground substantive assistance in inspectable passages, and report limitations.',
    requirements: { create: [
      { text: 'Every substantive synthesis finding must link to an indexed passage.', source: 'brief', required: true, confirmed: true },
      { text: 'Explain how researcher agency will be evaluated.', source: 'brief', required: true, confirmed: true },
      { text: 'Use verified metadata for every citation in the final bibliography.', source: 'brief', required: true, confirmed: true },
    ] },
  } })

  const pdfsByKey = {}
  const referencesByKey = {}
  for (const source of sources) {
    const { librarySource, rawText } = await upsertLibrarySource(user.id, project.id, source)
    const workspaceSource = await db.workspaceSource.create({ data: {
      projectId: project.id,
      librarySourceId: librarySource.id,
      relevance: source.key === 'unesco' ? 0.94 : 0.88,
      status: 'saved',
      notes: 'Included in the research demo corpus; passages are labelled paraphrases.',
      citationUsageCount: source.key === 'unesco' ? 1 : source.key === 'kasneci' ? 1 : 1,
      lastOpenedAt: new Date(),
    } })
    const pdf = await db.pdf.create({ data: {
      projectId: project.id,
      userId: user.id,
      filename: source.filename,
      rawText,
      sizeBytes: librarySource.sizeBytes,
      parseStatus: 'ready',
      librarySourceId: librarySource.id,
    } })
    await db.pdfChunk.createMany({ data: source.chunks.map((chunk, index) => ({
      pdfId: pdf.id,
      chunkIndex: index,
      content: chunk.text,
      charCount: chunk.text.length,
      pageApprox: chunk.page,
    })) })
    const chunks = await db.pdfChunk.findMany({ where: { pdfId: pdf.id }, orderBy: { chunkIndex: 'asc' } })
    const reference = await db.reference.create({ data: {
      projectId: project.id,
      sourceId: pdf.id,
      workspaceSourceId: workspaceSource.id,
      rawText: referenceText(source),
      style: 'harvard',
      authorsJson: json(source.authors),
      year: source.year,
      title: source.title,
      doi: source.doi,
      url: source.url,
      metadataStatus: 'confirmed',
      metadataConfidence: 1,
      metadataJson: json({ venue: source.venue, fixture: true, checked: true }),
    } })
    pdfsByKey[source.key] = { source, librarySource, workspaceSource, pdf, chunks }
    referencesByKey[source.key] = { id: reference.id, ...source, reference }
  }

  const documentJson = buildDocument(referencesByKey)
  const canonicalContent = json(documentJson)
  const plainText = documentPlainText(documentJson)
  const contentHash = sha256(canonicalContent)
  await db.document.create({ data: { projectId: project.id, content: canonicalContent, revision: 1, contentHash } })
  const version = await db.documentVersion.create({ data: {
    projectId: project.id,
    sequence: 1,
    content: canonicalContent,
    plainText,
    contentHash,
    reason: 'import',
  } })

  const claimFixtures = [
    { key: 'agency', riskCategory: 'evaluation', central: true, section: 'Agency before automation' },
    { key: 'fluency', riskCategory: 'evidence', central: true, section: 'Agency before automation' },
    { key: 'retrieval', riskCategory: 'method', central: true, section: 'A provenance-first interface' },
    { key: 'conclusion', riskCategory: 'scope', central: false, section: 'Questions for evaluation' },
  ]
  const claimsByKey = {}
  for (const fixture of claimFixtures) {
    claimsByKey[fixture.key] = await db.claim.create({ data: {
      projectId: project.id,
      documentVersionId: version.id,
      text: claims[fixture.key],
      riskCategory: fixture.riskCategory,
      anchorJson: anchor(claims[fixture.key], fixture.section),
      central: fixture.central,
    } })
  }

  const evidenceFixtures = [
    ['agency', 'unesco', 0, 'supported', 0.91],
    ['agency', 'kasneci', 2, 'partially_supported', 0.78],
    ['fluency', 'kasneci', 1, 'supported', 0.93],
    ['fluency', 'bender', 2, 'supported', 0.9],
    ['retrieval', 'unesco', 1, 'partially_supported', 0.64],
  ]
  for (const [claimKey, sourceKey, chunkIndex, status, confidence] of evidenceFixtures) {
    const chunk = pdfsByKey[sourceKey].chunks[chunkIndex]
    await db.evidenceLink.create({ data: {
      claimId: claimsByKey[claimKey].id,
      pdfChunkId: chunk.id,
      kind: 'source_passage',
      excerpt: chunk.content,
      confidence,
      supportStatus: status,
      idempotencyKey: `research-demo:${sourceKey}:${chunkIndex}`,
      confirmedByStudent: status === 'supported',
    } })
  }

  const citationFixtures = [
    ['agency', 'unesco', 'p. 13'],
    ['fluency', 'kasneci', 'p. 5'],
    ['fluency', 'bender', 'p. 618'],
  ]
  for (const [claimKey, sourceKey, locator] of citationFixtures) {
    const source = pdfsByKey[sourceKey].source
    const reference = referencesByKey[sourceKey].reference
    await db.citation.create({ data: {
      projectId: project.id,
      documentVersionId: version.id,
      referenceId: reference.id,
      claimId: claimsByKey[claimKey].id,
      rawText: reference.rawText,
      authorsJson: json(source.authors),
      year: source.year,
      locator,
      anchorJson: anchor(claims[claimKey], claimKey === 'agency' ? 'Agency before automation' : 'Agency before automation'),
      matchConfidence: 1,
    } })
  }

  const seededInterventions = []
  for (const [index, fixture] of interventions.entries()) {
    const intervention = await db.intervention.create({ data: {
      userId: user.id,
      projectId: project.id,
      paragraphId: `research-demo-${fixture.engineType}-${index}`,
      promptTemplateTag: fixture.promptTemplateTag,
      engineType: fixture.engineType,
      promptText: fixture.promptText,
      responseText: fixture.responseText,
      verdict: fixture.verdict,
      status: 'active',
    } })
    seededInterventions.push({ id: intervention.id, ...fixture })
    for (const evidence of fixture.evidence ?? []) {
      const chunk = pdfsByKey[evidence.source].chunks[evidence.chunk]
      await db.interventionEvidence.create({ data: {
        interventionId: intervention.id,
        chunkId: chunk.id,
        similarityScore: evidence.score,
        citedExcerpt: chunk.content,
      } })
    }
  }

  for (const fixture of actions) {
    const claimEntry = Object.entries(claims).find(([, text]) => text === fixture.quote)
    const targetId = fixture.targetKind === 'claim' && claimEntry ? claimsByKey[claimEntry[0]].id : project.id
    await db.researchAction.create({ data: {
      projectId: project.id,
      kind: fixture.kind,
      title: fixture.title,
      detail: fixture.detail,
      state: 'open',
      pinned: fixture.pinned,
      priority: fixture.priority,
      priorityFactorsJson: json(fixture.factors),
      targetKind: fixture.targetKind,
      targetId,
      documentAnchorJson: anchor(fixture.quote, 'Research demo'),
    } })
  }

  const agencyPassage = pdfsByKey.unesco.chunks[0]
  await db.researchNote.create({ data: {
    projectId: project.id,
    workspaceSourceId: pdfsByKey.unesco.workspaceSource.id,
    passageId: agencyPassage.id,
    kind: 'exact_excerpt',
    title: 'Agency must remain observable',
    body: 'Use this passage to define an evaluation criterion; do not collapse agency into a general usability score.',
    exactExcerpt: agencyPassage.content,
    sourceAnchorJson: json({ page: agencyPassage.pageApprox, passageId: agencyPassage.id }),
    documentAnchorJson: anchor(claims.agency, 'Agency before automation'),
  } })
  await db.sourceAnnotation.create({ data: {
    projectId: project.id,
    workspaceSourceId: pdfsByKey.kasneci.workspaceSource.id,
    passageId: pdfsByKey.kasneci.chunks[1].id,
    color: 'amber',
    comment: 'Directly relevant to the fluent-output risk claim; verify the wording against the original before quoting.',
    anchorJson: json({ page: pdfsByKey.kasneci.chunks[1].pageApprox, sourcePage: 5, passageId: pdfsByKey.kasneci.chunks[1].id, exact: true }),
  } })

  await db.groundedSynthesis.create({ data: {
    projectId: project.id,
    kind: 'comparison',
    prompt: 'How do the indexed sources frame the relationship between AI assistance, verification, and researcher agency?',
    status: 'completed',
    findings: { create: [
      {
        text: 'Across the demo passages, assistance is framed as useful only when people retain judgement and verify fluent output.',
        confidence: 0.9,
        sortOrder: 0,
        passages: { create: [
          { passageId: pdfsByKey.unesco.chunks[0].id },
          { passageId: pdfsByKey.kasneci.chunks[1].id },
          { passageId: pdfsByKey.bender.chunks[2].id },
        ] },
      },
      {
        text: 'The corpus motivates provenance-first design, but it does not directly evaluate an inline research IDE.',
        confidence: 0.82,
        sortOrder: 1,
        passages: { create: [
          { passageId: pdfsByKey.unesco.chunks[1].id },
          { passageId: pdfsByKey.kasneci.chunks[2].id },
        ] },
      },
    ] },
  } })

  await db.academicProfile.create({ data: {
    userId: user.id,
    projectId: project.id,
    name: 'Cogdoc research demo — Harvard',
    cslStyle: 'harvard',
    headingJson: json({ h1: { sizePt: 18, spacingBeforePt: 18 }, h2: { sizePt: 14, spacingBeforePt: 12 } }),
    marginsJson: json({ top: 25.4, right: 25.4, bottom: 25.4, left: 25.4 }),
    spacing: 1.5,
    titlePageJson: json({ enabled: true }),
    captionJson: json({ position: 'below', numbering: true }),
    tableJson: json({ repeatHeader: true }),
    bibliographyJson: json({ hangingIndentMm: 12.7, sort: 'author-year', source: 'used_citations' }),
    isDefault: true,
  } })

  const reviewRun = await db.reviewRun.create({ data: {
    projectId: project.id,
    documentVersionId: version.id,
    scope: 'full',
    status: 'ready',
    progress: 100,
    currentStage: 'complete',
    analyzerVersions: json({ fixture: 'research-demo-v1' }),
    idempotencyKey: 'research-demo-review-v1',
    startedAt: new Date(),
    completedAt: new Date(),
  } })
  await db.reviewItem.createMany({ data: [
    {
      projectId: project.id,
      reviewRunId: reviewRun.id,
      claimId: claimsByKey.agency.id,
      type: 'requirement_coverage',
      severity: 'critical',
      title: 'Operational definition missing',
      detail: 'Explain how the study will observe researcher agency before certification.',
      evidenceJson: json({ requirement: 'Explain how researcher agency will be evaluated.' }),
      anchorJson: anchor(claims.agency, 'Agency before automation'),
      state: 'open',
      blocksCertification: true,
    },
    {
      projectId: project.id,
      reviewRunId: reviewRun.id,
      claimId: claimsByKey.retrieval.id,
      type: 'evidence_gap',
      severity: 'advisory',
      title: 'Evaluation evidence needed',
      detail: 'The corpus supports verification concerns, not the effectiveness of this interface pattern.',
      evidenceJson: json({ passageIds: [pdfsByKey.unesco.chunks[1].id] }),
      anchorJson: anchor(claims.retrieval, 'A provenance-first interface'),
      state: 'open',
      blocksCertification: false,
    },
  ] })

  await appendAudit({
    projectId: project.id,
    userId: user.id,
    type: 'research_demo_seeded',
    actor: 'system',
    payload: { summary: 'Created the reproducible Cogdoc research demonstration', marker: DEMO_MARKER, sources: sources.length, interventions: interventions.length },
    documentHash: contentHash,
  })
  for (const intervention of seededInterventions) {
    await appendAudit({
      projectId: project.id, userId: user.id, type: 'intervention_created', actor: 'system',
      modelVersion: 'research-demo-fixture-v1', promptVersion: intervention.promptTemplateTag,
      payload: { summary: `Cogdoc raised a ${intervention.engineType} intervention`, interventionId: intervention.id, engineType: intervention.engineType },
    })
  }
  for (const source of sources) {
    await appendAudit({
      projectId: project.id, userId: user.id, type: 'workspace_source_attached',
      payload: { summary: `Attached source: ${source.title}`, librarySourceId: pdfsByKey[source.key].librarySource.id, demo: true },
    })
  }
  for (const [claimKey, sourceKey, locator] of citationFixtures) {
    await appendAudit({
      projectId: project.id, userId: user.id, type: 'citation_inserted',
      payload: { summary: `Inserted verified citation: ${sources.find((source) => source.key === sourceKey).title}`, claim: claims[claimKey], referenceId: referencesByKey[sourceKey].id, locator },
    })
  }
  await appendAudit({
    projectId: project.id, userId: user.id, type: 'research_action_pinned',
    payload: { summary: 'Pinned the operational definition of researcher agency as the next priority', demo: true },
  })
  await appendAudit({
    projectId: project.id, userId: user.id, type: 'research_structure_accepted',
    payload: { summary: 'Accepted the working research structure after the preliminary conversation', demo: true },
  })

  if (process.argv.includes('--embed')) await embedSources(project.id, pdfsByKey)

  console.log(`Research demo ready: ${project.id}`)
  console.log(`  ${sources.length} private sources · ${Object.values(pdfsByKey).flatMap((entry) => entry.chunks).length} passages · ${interventions.length} inline interventions`)
  console.log('  Suggested mapper question: What risks follow from treating fluent model output as evidence?')
}

main()
  .catch((error) => {
    console.error('Research demo seed failed:', error)
    process.exitCode = 1
  })
  .finally(async () => db.$disconnect())
