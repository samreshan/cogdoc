import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/auth-supabase'
import { createDocumentVersion, appendAuditEvent, mutationIdempotencyKey } from '@/lib/workspace-server'
import { generateReview } from '@/lib/review-engine'
import { lookupReferenceMetadata, metadataConfidence } from '@/lib/reference-metadata'
import type { Claim, Reference } from '@prisma/client'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId(req)
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const scope = body.scope === 'changed_blocks' ? 'changed_blocks' : 'full'
  const idempotencyKey = mutationIdempotencyKey(req)
  if (idempotencyKey) {
    const existing = await db.reviewRun.findFirst({ where: { projectId: id, idempotencyKey }, include: { items: true } })
    if (existing) return NextResponse.json({ reviewRun: existing, replayed: true })
  }

  const workspace = await db.project.findFirst({
    where: { id, userId, archived: false, deletedAt: null },
    include: { document: true, requirements: { where: { confirmed: true } } },
  })
  if (!workspace?.document) return NextResponse.json({ error: 'Workspace or document not found' }, { status: 404 })
  if (!workspace.document.content.trim()) return NextResponse.json({ error: 'Write or import a document before scanning' }, { status: 400 })

  const plainText = (await import('@/lib/document-content')).documentToPlainText(workspace.document.content)
  const analysis = generateReview(plainText, workspace.requirements.map((requirement) => requirement.text))
  const metadata = await Promise.all(analysis.references.map(lookupReferenceMetadata))

  const reviewRun = await db.$transaction(async (tx) => {
    await tx.project.update({ where: { id }, data: { lifecycleState: 'reviewing' } })
    const version = await createDocumentVersion(tx, id, workspace.document!.content, 'scan')
    const run = await tx.reviewRun.create({
      data: {
        projectId: id, documentVersionId: version.id, scope, status: 'scanning', progress: 10,
        currentStage: 'Parsing citations', analyzerVersions: JSON.stringify({ deterministic: '1.0', citationStyle: workspace.citationStyle }),
        idempotencyKey,
      },
    })

    const referenceRecords: Reference[] = []
    for (let index = 0; index < analysis.references.length; index += 1) {
      const parsed = analysis.references[index]
      const resolved = metadata[index]
      const confidence = parsed && resolved ? metadataConfidence(parsed, resolved) : 0
      referenceRecords.push(await tx.reference.create({
        data: {
          projectId: id, rawText: parsed!.rawText, style: workspace.citationStyle,
          authorsJson: JSON.stringify(parsed!.authors), year: parsed!.year, title: parsed!.title, doi: parsed!.doi ?? resolved?.doi ?? null,
          url: resolved?.url ?? null,
          metadataStatus: confidence >= 0.85 ? 'matched' : resolved ? 'mismatch' : 'unverified',
          metadataConfidence: confidence,
          metadataJson: resolved ? JSON.stringify(resolved) : null,
        },
      }))
    }
    const referenceByKey = new Map(analysis.references.map((reference, index) => [reference.key, referenceRecords[index]]))

    const claimRecords: Claim[] = []
    for (const claim of analysis.claims) {
      claimRecords.push(await tx.claim.create({
        data: {
          projectId: id, documentVersionId: version.id, text: claim.text,
          riskCategory: claim.riskCategory, central: claim.central,
          anchorJson: JSON.stringify({ start: claim.start, end: claim.end, quote: claim.text }),
        },
      }))
    }
    for (const citation of analysis.citations) {
      const claimIndex = analysis.claims.findIndex((claim) => citation.start >= claim.start && citation.start <= claim.end)
      await tx.citation.create({
        data: {
          projectId: id, documentVersionId: version.id,
          referenceId: referenceByKey.get(citation.key)?.id ?? null,
          claimId: claimIndex >= 0 ? claimRecords[claimIndex]?.id ?? null : null,
          rawText: citation.rawText, authorsJson: JSON.stringify(citation.authors), year: citation.year,
          locator: citation.locator, anchorJson: JSON.stringify({ start: citation.start, end: citation.end, quote: citation.rawText }),
          matchConfidence: referenceByKey.has(citation.key) ? 1 : 0,
        },
      })
    }

    const items = [...analysis.items]
    for (let index = 0; index < analysis.references.length; index += 1) {
      const parsed = analysis.references[index]!
      const resolved = metadata[index]
      const confidence = parsed && resolved ? metadataConfidence(parsed, resolved) : 0
      if (!resolved) {
        items.push({
          type: 'reference_metadata_unverified', severity: 'critical' as const, blocksCertification: true,
          title: 'Reference metadata needs confirmation', detail: parsed.doi
            ? `Cogdoc could not retrieve metadata for ${parsed.doi}. Confirm the entry manually or correct the DOI.`
            : 'No high-confidence registry match was found. Compare this entry with the original source and confirm its title, author, and year.',
          anchor: null, evidence: { reference: parsed, referenceId: referenceRecords[index]?.id },
        })
      } else if (resolved && confidence < 0.85) {
        items.push({
          type: 'reference_metadata_mismatch', severity: 'critical' as const, blocksCertification: true,
          title: 'Reference metadata may not match its DOI', detail: 'The title, year, or author differs from the DOI registry. Review and confirm the correct work.',
          anchor: null, evidence: { reference: parsed, referenceId: referenceRecords[index]?.id, metadata: resolved, confidence },
        })
      }
    }

    for (const item of items) {
      const evidenceClaim = (item.evidence.claim as { text?: string } | undefined)?.text
      const claimIndex = evidenceClaim ? analysis.claims.findIndex((claim) => claim.text === evidenceClaim) : -1
      await tx.reviewItem.create({
        data: {
          projectId: id, reviewRunId: run.id, claimId: claimIndex >= 0 ? claimRecords[claimIndex]?.id ?? null : null,
          type: item.type, severity: item.severity, title: item.title, detail: item.detail,
          evidenceJson: JSON.stringify(item.evidence), anchorJson: item.anchor ? JSON.stringify(item.anchor) : null,
          blocksCertification: item.blocksCertification,
        },
      })
    }

    const completed = await tx.reviewRun.update({
      where: { id: run.id },
      data: { status: 'ready', progress: 100, currentStage: 'Ready', startedAt: new Date(), completedAt: new Date() },
      include: { items: { orderBy: [{ severity: 'asc' }, { createdAt: 'asc' }] } },
    })
    await tx.project.update({ where: { id }, data: { lifecycleState: items.some((item) => item.blocksCertification) ? 'reviewing' : 'ready' } })
    await appendAuditEvent(tx, {
      projectId: id, userId, type: 'review_completed', actor: 'system', documentHash: version.contentHash,
      payload: { reviewRunId: run.id, itemCount: items.length, criticalCount: items.filter((item) => item.blocksCertification).length, scope },
    })
    return completed
  })
  return NextResponse.json({ reviewRun }, { status: 201 })
}
