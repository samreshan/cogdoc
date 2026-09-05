import { db } from '@/lib/db'
import { putPrivateAsset } from '@/lib/private-storage'
import { assessSourceQuality, canonicalizeSourceUrl, contentDigest, normalizeDoi } from '@/lib/research-source'
import { enqueueClericalResearchJobs } from '@/lib/research-jobs'

/** Compatibility bridge for legacy Pdf uploads. Failures are safe to retry. */
export async function linkLegacyPdfToLibrary(input: {
  pdfId: string; projectId: string; userId: string; filename: string; rawText: string; bytes?: Buffer | null; mimeType?: string
}) {
  const hash = contentDigest(input.bytes ?? input.rawText)
  let source = await db.librarySource.findFirst({ where: { userId: input.userId, contentHash: hash } })
  if (!source) {
    const storage = input.bytes ? await putPrivateAsset(input.projectId, input.filename, input.bytes, input.mimeType ?? 'application/pdf') : null
    const quality = assessSourceQuality({ fullText: Boolean(input.rawText) })
    source = await db.librarySource.create({ data: {
      userId: input.userId, title: input.filename.replace(/\.pdf$/i, ''), filename: input.filename,
      contentHash: hash, mimeType: input.mimeType ?? (input.bytes ? 'application/pdf' : 'text/plain'),
      sizeBytes: input.bytes?.byteLength ?? Buffer.byteLength(input.rawText), parseStatus: 'ready',
      storageProvider: storage?.provider, storageKey: storage?.key,
      metadataJson: JSON.stringify({ compatibilitySource: 'Pdf' }), qualityScore: quality.score, qualityExplanation: quality.explanation,
    } })
  }
  await db.$transaction([
    db.workspaceSource.upsert({ where: { projectId_librarySourceId: { projectId: input.projectId, librarySourceId: source.id } }, update: { status: 'saved' }, create: { projectId: input.projectId, librarySourceId: source.id } }),
    db.pdf.update({ where: { id: input.pdfId }, data: { librarySourceId: source.id } }),
  ])
  await enqueueClericalResearchJobs(input.projectId, 'source_import', source.id)
  return source
}

/** Compatibility bridge for metadata-only Reference saves. */
export async function linkReferenceToLibrary(input: {
  referenceId: string; projectId: string; userId: string; title: string; doi?: string | null; url?: string | null; metadata?: Record<string, unknown>
}) {
  const doi = normalizeDoi(input.doi)
  const canonicalUrl = canonicalizeSourceUrl(input.url)
  if (!doi && !canonicalUrl) return null
  let source = await db.librarySource.findFirst({ where: { userId: input.userId, OR: [...(doi ? [{ doi }] : []), ...(canonicalUrl ? [{ canonicalUrl }] : [])] } })
  if (!source) {
    const quality = assessSourceQuality({ doi, canonicalUrl, metadata: input.metadata })
    source = await db.librarySource.create({ data: { userId: input.userId, title: input.title, doi, canonicalUrl, parseStatus: 'metadata_only', metadataJson: JSON.stringify(input.metadata ?? {}), qualityScore: quality.score, qualityExplanation: quality.explanation } })
  }
  const link = await db.workspaceSource.upsert({ where: { projectId_librarySourceId: { projectId: input.projectId, librarySourceId: source.id } }, update: { status: 'saved' }, create: { projectId: input.projectId, librarySourceId: source.id } })
  await db.reference.update({ where: { id: input.referenceId }, data: { workspaceSourceId: link.id } })
  return link
}
