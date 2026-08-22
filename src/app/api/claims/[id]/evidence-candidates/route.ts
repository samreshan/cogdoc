import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/auth-supabase'
import { retrieveTopK } from '@/lib/retrieval'

function tokens(value: string): Set<string> {
  return new Set(value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((word) => word.length > 3))
}

function overlap(query: Set<string>, value: string): number {
  const candidate = tokens(value)
  if (!query.size || !candidate.size) return 0
  let shared = 0
  for (const word of query) if (candidate.has(word)) shared += 1
  return shared / new Set([...query, ...candidate]).size
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId(req)
  const { id } = await params
  const claim = await db.claim.findFirst({ where: { id, project: { userId } } })
  if (!claim) return NextResponse.json({ error: 'Claim not found' }, { status: 404 })

  const [passages, codeFiles] = await Promise.all([
    retrieveTopK(claim.projectId, claim.text, 5, 0.02),
    db.codeFile.findMany({
      where: { snapshot: { projectId: claim.projectId } },
      select: { id: true, path: true, language: true, content: true, lineCount: true, snapshot: { select: { id: true, snapshotHash: true } } },
      take: 250,
    }),
  ])
  const query = tokens(claim.text)
  const code = codeFiles.map((file) => {
    const content = file.content ?? ''
    const lines = content.split('\n')
    let best = { score: 0, startLine: 1, excerpt: lines.slice(0, 8).join('\n') }
    for (let index = 0; index < lines.length; index += 8) {
      const excerpt = lines.slice(index, index + 12).join('\n')
      const score = overlap(query, `${file.path} ${excerpt}`)
      if (score > best.score) best = { score, startLine: index + 1, excerpt }
    }
    return {
      codeFileId: file.id, path: file.path, language: file.language,
      startLine: best.startLine, endLine: Math.min(file.lineCount, best.startLine + Math.max(0, best.excerpt.split('\n').length - 1)),
      excerpt: best.excerpt, score: best.score, snapshotId: file.snapshot.id, snapshotHash: file.snapshot.snapshotHash,
    }
  }).filter((file) => file.score > 0).sort((a, b) => b.score - a.score).slice(0, 5)

  return NextResponse.json({ claim: { id: claim.id, text: claim.text }, passages, code })
}
