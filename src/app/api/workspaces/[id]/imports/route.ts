import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/auth-supabase'
import { importDocx } from '@/lib/docx'
import { inspectCodeArchive, CODE_ARCHIVE_LIMITS } from '@/lib/code-archive'
import { putPrivateAsset } from '@/lib/private-storage'
import { sha256 } from '@/lib/crypto'
import { appendAuditEvent, createDocumentVersion } from '@/lib/workspace-server'
import { canonicalDocumentString, stripHtml } from '@/lib/document-content'
import { chunkText } from '@/lib/retrieval'
import { ingestToVectorStore } from '@/lib/ai-gateway'

export const runtime = 'nodejs'
export const maxDuration = 60

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId(req)
  const { id } = await params
  const workspace = await db.project.findFirst({ where: { id, userId, archived: false, deletedAt: null }, select: { id: true } })
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  const form = await req.formData()
  const file = form.get('file')
  const kind = String(form.get('kind') ?? 'docx')
  if (!(file instanceof File)) return NextResponse.json({ error: 'file is required' }, { status: 400 })
  const buffer = Buffer.from(await file.arrayBuffer())
  if (kind === 'source') {
    if (buffer.length > 25 * 1024 * 1024) return NextResponse.json({ error: 'Source PDF exceeds the 25 MB limit' }, { status: 413 })
    if (buffer.subarray(0, 5).toString('ascii') !== '%PDF-') return NextResponse.json({ error: 'Source upload is not a valid PDF' }, { status: 415 })
    try {
      const { PDFParse } = await import('pdf-parse')
      const parser = new PDFParse({ data: buffer })
      const extracted = await parser.getText()
      await parser.destroy()
      const rawText = extracted.text.trim()
      if (!rawText) return NextResponse.json({ error: 'No text could be extracted. Scanned-image OCR is not supported in v1.' }, { status: 422 })
      const chunks = chunkText(rawText)
      if (!chunks.length) return NextResponse.json({ error: 'No source passages could be indexed' }, { status: 422 })
      const stored = await putPrivateAsset(id, file.name, buffer, 'application/pdf')
      const result = await db.$transaction(async (tx) => {
        const source = await tx.pdf.create({ data: { projectId: id, userId, filename: file.name, rawText, sizeBytes: buffer.length, parseStatus: 'ready' } })
        await tx.pdfChunk.createMany({ data: chunks.map((chunk) => ({
          pdfId: source.id, chunkIndex: chunk.chunkIndex, content: chunk.content,
          charCount: chunk.charCount, pageApprox: chunk.pageApprox,
        })) })
        const asset = await tx.workspaceAsset.create({ data: {
          projectId: id, kind: 'source', filename: file.name, mimeType: 'application/pdf',
          sizeBytes: buffer.length, contentHash: sha256(buffer), storageProvider: stored.provider, storageKey: stored.key,
        } })
        await appendAuditEvent(tx, { projectId: id, userId, type: 'source_imported', payload: { sourceId: source.id, assetId: asset.id, chunkCount: chunks.length } })
        return { source, asset }
      })
      let vectorIngest: 'ok' | 'failed' | 'skipped' = 'skipped'
      try {
        const inserted = await db.pdfChunk.findMany({ where: { pdfId: result.source.id }, orderBy: { chunkIndex: 'asc' } })
        if (inserted.length) {
          await ingestToVectorStore(id, result.source.id, inserted.map((chunk) => ({ content: chunk.content, chunk_id: chunk.id, page_approx: chunk.pageApprox })))
          vectorIngest = 'ok'
        }
      } catch { vectorIngest = 'failed' }
      return NextResponse.json({ kind: 'source', source: result.source, asset: result.asset, chunkCount: chunks.length, vectorIngest }, { status: 201 })
    } catch (error) {
      return NextResponse.json({ error: `Source import failed: ${(error as Error).message}` }, { status: 422 })
    }
  }
  if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
    return NextResponse.json({ error: 'Only valid DOCX or ZIP files are accepted' }, { status: 415 })
  }

  if (kind === 'code') {
    if (buffer.length > CODE_ARCHIVE_LIMITS.compressedBytes) {
      return NextResponse.json({ error: 'Code archive exceeds the 50 MB compressed limit' }, { status: 413 })
    }
    try {
      const inspected = await inspectCodeArchive(buffer)
      const stored = await putPrivateAsset(id, file.name, buffer, 'application/zip')
      const result = await db.$transaction(async (tx) => {
        const asset = await tx.workspaceAsset.create({
          data: {
            projectId: id, kind: 'code_archive', filename: file.name, mimeType: 'application/zip',
            sizeBytes: buffer.length, contentHash: sha256(buffer), storageProvider: stored.provider,
            storageKey: stored.key, warningsJson: JSON.stringify(inspected.warnings),
          },
        })
        const snapshot = await tx.codeSnapshot.create({
          data: {
            projectId: id, filename: file.name, sizeBytes: buffer.length,
            extractedBytes: inspected.extractedBytes, fileCount: inspected.totalFileCount,
            snapshotHash: inspected.snapshotHash, warningsJson: JSON.stringify(inspected.warnings),
          },
        })
        if (inspected.files.length) {
          await tx.codeFile.createMany({
            data: inspected.files.map((indexed) => ({
              codeSnapshotId: snapshot.id,
              path: indexed.path,
              language: indexed.language,
              content: indexed.content,
              contentHash: indexed.contentHash,
              lineCount: indexed.lineCount,
              sizeBytes: indexed.sizeBytes,
            })),
          })
        }
        await appendAuditEvent(tx, {
          projectId: id, userId, type: 'code_snapshot_imported',
          payload: { assetId: asset.id, snapshotId: snapshot.id, fileCount: inspected.files.length, snapshotHash: inspected.snapshotHash },
        })
        return { asset, snapshot }
      })
      return NextResponse.json({
        kind: 'code', snapshot: result.snapshot, indexedFileCount: inspected.files.length,
        warnings: inspected.warnings, disclaimer: 'Cogdoc indexed this snapshot without executing it. Correctness and authorship were not verified.',
      }, { status: 201 })
    } catch (error) {
      return NextResponse.json({ error: (error as Error).message }, { status: 422 })
    }
  }

  if (buffer.length > 25 * 1024 * 1024) {
    return NextResponse.json({ error: 'DOCX exceeds the 25 MB import limit' }, { status: 413 })
  }
  if (!file.name.toLowerCase().endsWith('.docx')) {
    return NextResponse.json({ error: 'This import expects a .docx file' }, { status: 415 })
  }

  try {
    const imported = await importDocx(buffer)
    if (Buffer.byteLength(imported.html, 'utf8') > 50 * 1024 * 1024) {
      return NextResponse.json({ error: 'Expanded DOCX content exceeds the 50 MB semantic import limit' }, { status: 413 })
    }
    if (kind === 'brief') {
      const briefText = stripHtml(imported.html)
      const stored = await putPrivateAsset(id, file.name, buffer, DOCX_MIME)
      const asset = await db.$transaction(async (tx) => {
        const created = await tx.workspaceAsset.create({
          data: {
            projectId: id, kind: 'brief', filename: file.name, mimeType: DOCX_MIME,
            sizeBytes: buffer.length, contentHash: sha256(buffer), storageProvider: stored.provider,
            storageKey: stored.key, warningsJson: JSON.stringify(imported.report),
          },
        })
        await tx.project.update({ where: { id }, data: { briefText } })
        await appendAuditEvent(tx, { projectId: id, userId, type: 'brief_imported', payload: { assetId: created.id } })
        return created
      })
      return NextResponse.json({ kind: 'brief', asset, briefText, compatibility: imported.report }, { status: 201 })
    }

    const stored = await putPrivateAsset(id, file.name, buffer, DOCX_MIME)
    const canonicalContent = canonicalDocumentString(imported.html)
    const contentHash = sha256(canonicalContent)
    const result = await db.$transaction(async (tx) => {
      const document = await tx.document.upsert({
        where: { projectId: id },
        update: { content: canonicalContent, contentHash, revision: { increment: 1 }, lastSaved: new Date() },
        create: { projectId: id, content: canonicalContent, contentHash, revision: 1 },
      })
      const version = await createDocumentVersion(tx, id, canonicalContent, 'import')
      const asset = await tx.workspaceAsset.create({
        data: {
          projectId: id, kind: 'original_docx', filename: file.name, mimeType: DOCX_MIME,
          sizeBytes: buffer.length, contentHash: sha256(buffer), storageProvider: stored.provider,
          storageKey: stored.key, warningsJson: JSON.stringify(imported.report),
        },
      })
      await tx.certificate.updateMany({ where: { projectId: id, status: 'valid' }, data: { status: 'superseded', supersededAt: new Date() } })
      await tx.project.update({ where: { id }, data: { lifecycleState: 'draft', updatedAt: new Date() } })
      await appendAuditEvent(tx, {
        projectId: id, userId, type: 'document_imported', documentHash: version.contentHash,
        payload: { assetId: asset.id, versionId: version.id, filename: file.name, warnings: imported.report.warnings.length },
      })
      return { document, version, asset }
    })
    return NextResponse.json({
      kind: 'docx', document: result.document, version: result.version,
      compatibility: imported.report,
    }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: `DOCX import failed: ${(error as Error).message}` }, { status: 422 })
  }
}
