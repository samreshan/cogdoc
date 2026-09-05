import { NextRequest, NextResponse } from 'next/server'
import { requireUserId } from '@/lib/auth-supabase'
import { db } from '@/lib/db'
import { getAIService } from '@/lib/ai-service'
import { isVectorRetrievalEnabled, retrieveVectorChunks } from '@/lib/ai-gateway'
import { retrieveTopK } from '@/lib/retrieval'
import { mergeMappedChunks } from '@/lib/source-mapper'
import type { GroundedResearchAnswer } from '@/lib/ai-service'

export const runtime = 'nodejs'
export const maxDuration = 45

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId(req)
  const { id } = await params
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const question = typeof body.question === 'string' ? body.question.trim().slice(0, 2_000) : ''
  if (question.length < 5) return NextResponse.json({ error: 'Ask a question with at least five characters' }, { status: 400 })

  const workspace = await db.project.findFirst({ where: { id, userId, deletedAt: null }, select: { id: true } })
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  const exactPromise = retrieveTopK(id, question, 10, 0.01)
  const semanticEnabled = isVectorRetrievalEnabled()
  const semanticPromise = semanticEnabled
    ? retrieveVectorChunks(id, question, 10).catch(() => [])
    : Promise.resolve([])
  const [exact, semantic] = await Promise.all([exactPromise, semanticPromise])
  const ranked = mergeMappedChunks(exact, semantic, 8)

  const chunkRows = ranked.length ? await db.pdfChunk.findMany({
    where: { id: { in: ranked.map((item) => item.chunkId) }, pdf: { projectId: id, userId } },
    select: {
      id: true,
      pdfId: true,
      pdf: {
        select: {
          filename: true,
          librarySourceId: true,
          references: { where: { projectId: id }, select: { id: true }, orderBy: { createdAt: 'asc' }, take: 1 },
        },
      },
    },
  }) : []
  const libraryIds = chunkRows.map((row) => row.pdf.librarySourceId).filter((value): value is string => Boolean(value))
  const workspaceSources = libraryIds.length ? await db.workspaceSource.findMany({
    where: { projectId: id, librarySourceId: { in: libraryIds } },
    select: { id: true, librarySourceId: true },
  }) : []
  const chunkById = new Map(chunkRows.map((row) => [row.id, row]))
  const workspaceSourceByLibrary = new Map(workspaceSources.map((source) => [source.librarySourceId, source.id]))

  const passages = ranked.flatMap((item) => {
    const row = chunkById.get(item.chunkId)
    if (!row) return []
    return [{
      chunkId: item.chunkId,
      pdfId: row.pdfId,
      workspaceSourceId: row.pdf.librarySourceId ? workspaceSourceByLibrary.get(row.pdf.librarySourceId) ?? null : null,
      referenceId: row.pdf.references[0]?.id ?? null,
      content: item.content,
      similarityScore: item.similarityScore,
      pageApprox: item.pageApprox,
      sourceTitle: row.pdf.filename,
      matchType: item.matchType,
    }]
  })

  let answer: GroundedResearchAnswer | null = null
  let answerError: string | undefined
  if (passages.length) {
    try {
      answer = await getAIService().answerFromEvidence(question, passages.map((item) => ({ chunkId: item.chunkId, content: item.content })))
      if (!answer) answerError = 'The assistant could not produce an answer with valid passage links.'
    } catch {
      answerError = 'Grounded answer generation is unavailable. The matching passages are still shown below.'
    }
  }
  const strongest = passages[0]?.similarityScore ?? 0
  return NextResponse.json({
    question,
    answer,
    passages,
    needsWebSearch: passages.length === 0 || strongest < 0.025,
    retrieval: [...(exact.length ? ['exact' as const] : []), ...(semantic.length ? ['semantic' as const] : [])],
    ...(answerError ? { answerError } : {}),
  })
}
