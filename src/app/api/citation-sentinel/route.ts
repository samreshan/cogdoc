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
import { getDefaultUser } from '@/lib/auth'
import { getAIService } from '@/lib/ai-service'
import { retrieveTopK } from '@/lib/retrieval'

export const runtime = 'nodejs'
export const maxDuration = 45

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { projectId, paragraphId, claim } = body as {
    projectId: string
    paragraphId?: string
    claim: string
  }

  if (!projectId || !claim) {
    return NextResponse.json({ error: 'projectId and claim are required' }, { status: 400 })
  }

  const user = await getDefaultUser()
  const project = await db.project.findUnique({ where: { id: projectId } })
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  // Step 1: Retrieve top-k chunks (RAG)
  const retrieved = await retrieveTopK(projectId, claim, 5, 0.05)

  // Step 2: Verify claim via LLM
  const ai = getAIService()
  const verdict = await ai.verifyClaim(
    claim,
    retrieved.map((r) => ({ chunkId: r.chunkId, content: r.content })),
  )

  // Step 3: Persist intervention + evidence junction
  const intervention = await db.intervention.create({
    data: {
      userId: user.id,
      projectId,
      paragraphId: paragraphId ?? null,
      promptTemplateTag: 'Lens',
      engineType: 'citation',
      promptText: claim,
      responseText: verdict.explanation,
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

  // Step 4: Return payload for margin UI
  return NextResponse.json({
    verdict: verdict.verdict,
    explanation: verdict.explanation,
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
