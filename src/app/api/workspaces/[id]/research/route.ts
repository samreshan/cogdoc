import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/auth-supabase'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId(req)
  const { id } = await params
  const workspace = await db.project.findFirst({ where: { id, userId, deletedAt: null }, select: { id: true } })
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  const now = new Date()
  const [sources, notes, annotations, actions, claims, references, requirements, jobs, profile, decisions, interventions] = await Promise.all([
    db.workspaceSource.findMany({ where: { projectId: id }, include: { source: true }, orderBy: [{ lastOpenedAt: 'desc' }, { updatedAt: 'desc' }] }),
    db.researchNote.findMany({ where: { projectId: id }, orderBy: { updatedAt: 'desc' } }),
    db.sourceAnnotation.findMany({ where: { projectId: id }, orderBy: { updatedAt: 'desc' } }),
    db.researchAction.findMany({ where: { projectId: id, state: 'open', OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: now } }] }, orderBy: [{ pinned: 'desc' }, { priority: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }] }),
    db.claim.findMany({ where: { projectId: id }, include: { evidenceLinks: { select: { id: true, supportStatus: true, excerpt: true, pdfChunkId: true } } }, orderBy: [{ central: 'desc' }, { createdAt: 'asc' }] }),
    db.reference.findMany({ where: { projectId: id }, include: { source: { select: { id: true, filename: true } } }, orderBy: { createdAt: 'asc' } }),
    db.requirement.findMany({ where: { projectId: id }, orderBy: [{ required: 'desc' }, { createdAt: 'asc' }] }),
    db.researchJob.findMany({ where: { projectId: id, status: { in: ['queued', 'running', 'failed'] } }, orderBy: { createdAt: 'desc' }, take: 20 }),
    db.academicProfile.findFirst({ where: { userId, OR: [{ projectId: id }, { projectId: null, isDefault: true }] }, orderBy: { projectId: 'desc' } }),
    db.auditEvent.count({ where: { projectId: id, actor: 'student' } }),
    db.intervention.count({ where: { projectId: id } }),
  ])
  return NextResponse.json({ sources, notes, annotations, actions, claims, references, requirements, jobs, profile, historyCounts: { decisions, interventions } })
}
