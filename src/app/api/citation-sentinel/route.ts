/**
 * POST /api/citation-sentinel
 * Body: { projectId, paragraphId, claim }
 *
 * RAG flow:
 *  1. Retrieve top-5 chunks from the project's PDF library using keyword overlap.
 *  2. Call AIService.verifyClaim with the retrieved evidence.
 *  3. Persist the Intervention + InterventionEvidence junction rows.
 *  4. Return the verdict + cited evidence for the margin UI.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/auth-supabase'
import { getAIService } from '@/lib/ai-service'
import { retrieveTopK } from '@/lib/retrieval'
import { isVectorRetrievalEnabled, retrieveVectorChunks } from '@/lib/ai-gateway'
import { applyGenerationGuard } from '@/lib/engine-guard'
import { plainResearchQuestion } from '@/lib/intervention-language'
import { appendAuditEvent } from '@/lib/workspace-server'
import type { FrictionMode } from '@/lib/friction'

export const runtime = 'nodejs'
export const maxDuration = 45

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { projectId, paragraphId, claim, friction_mode } = body as {
    projectId: string
    paragraphId?: string
    claim: string
    friction_mode?: FrictionMode
  }

  if (!projectId || !claim) {
    return NextResponse.json({ error: 'projectId and claim are required' }, { status: 400 })
  }

  const mode: FrictionMode = friction_mode ?? 'socratic'
  const userId = await requireUserId(req)
  const project = await db.project.findUnique({ where: { id: projectId, userId } })
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  // Step 1: Retrieve top-k chunks (RAG)
  // Vector retrieval (FastAPI + pgvector) when the flag is set; otherwise the
  // keyword-overlap baseline. Both return the same RetrievedChunk[] shape.
  const retrieved = isVectorRetrievalEnabled()
    ? await retrieveVectorChunks(projectId, claim, 5)
    : await retrieveTopK(projectId, claim, 5, 0.05)

  // Step 2: Verify claim via LLM
  const ai = getAIService()
  const verdict = await ai.verifyClaim(
    claim,
    retrieved.map((r) => ({ chunkId: r.chunkId, content: r.content })),
  )

  // Friction §9: enforce the non-generation invariant on the explanation before
  // persisting. An over-explaining model → Spark Gap fallback (keeps the verdict,
  // trims the prose).
  const guarded = applyGenerationGuard(verdict.explanation, mode)

  // Step 3: Persist intervention + evidence junction
  const intervention = await db.$transaction(async (tx) => {
    const created = await tx.intervention.create({
      data: {
        userId,
        projectId,
        paragraphId: paragraphId ?? null,
        promptTemplateTag: 'Lens',
        engineType: 'citation',
        promptText: claim,
        responseText: plainResearchQuestion(guarded.text, 'citation', claim),
        verdict: verdict.verdict,
        status: 'active',
        evidences: {
          create: retrieved.map((r) => ({
            chunkId: r.chunkId,
            similarityScore: r.similarityScore,
            citedExcerpt: r.content.slice(0, 500),
          })),
        },
      },
      include: { evidences: { include: { chunk: { select: { pageApprox: true, pdf: { select: { filename: true } } } } } } },
    })
    await appendAuditEvent(tx, {
      projectId, userId, type: 'intervention_created', actor: 'system',
      modelVersion: process.env.AI_MODEL ?? process.env.GEMINI_MODEL ?? null, promptVersion: 'Lens',
      payload: { summary: 'Cogdoc raised a citation question', interventionId: created.id, engineType: 'citation', verdict: verdict.verdict, evidenceCount: retrieved.length },
    })
    return created
  })

  // Step 4: Return payload for margin UI
  return NextResponse.json({
    verdict: verdict.verdict,
    explanation: guarded.text,
    supportedClaims: verdict.supported_claims,
    unsupportedClaims: verdict.unsupported_claims,
    evidence: retrieved.map((r, i) => ({
      chunkId: r.chunkId,
      excerpt: r.content.slice(0, 400),
      fullContent: r.content,
      similarityScore: r.similarityScore,
      pageApprox: r.pageApprox,
      pdfFilename: r.pdfFilename,
      evidenceId: intervention.evidences[i]?.id,
    })),
    intervention,
  })
}
