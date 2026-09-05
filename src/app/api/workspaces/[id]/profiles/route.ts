import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/auth-supabase'
import { appendAuditEvent } from '@/lib/workspace-server'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId(req)
  const { id } = await params
  if (!await db.project.findFirst({ where: { id, userId } })) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  const profiles = await db.academicProfile.findMany({ where: { userId, OR: [{ projectId: id }, { projectId: null }] }, orderBy: [{ projectId: 'desc' }, { isDefault: 'desc' }, { name: 'asc' }] })
  return NextResponse.json({ profiles })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId(req)
  const { id } = await params
  if (!await db.project.findFirst({ where: { id, userId } })) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 200) : ''
  if (!name) return NextResponse.json({ error: 'A profile name is required' }, { status: 400 })
  const profile = await db.$transaction(async (tx) => {
    const created = await tx.academicProfile.create({ data: {
      userId, projectId: body.global === true ? null : id, name,
      cslStyle: typeof body.cslStyle === 'string' ? body.cslStyle.slice(0, 100) : 'harvard',
      headingJson: JSON.stringify(body.headings ?? {}), marginsJson: JSON.stringify(body.margins ?? { top: 25.4, right: 25.4, bottom: 25.4, left: 25.4 }),
      spacing: typeof body.spacing === 'number' ? Math.min(3, Math.max(1, body.spacing)) : 2,
      titlePageJson: JSON.stringify(body.titlePage ?? {}), captionJson: JSON.stringify(body.captions ?? {}),
      tableJson: JSON.stringify(body.tables ?? {}), bibliographyJson: JSON.stringify(body.bibliography ?? {}), isDefault: body.isDefault === true,
    } })
    await appendAuditEvent(tx, { projectId: id, userId, type: 'academic_profile_created', actor: 'student', payload: { summary: `Created academic profile: ${name}`, profileId: created.id, cslStyle: created.cslStyle, global: created.projectId === null } })
    return created
  })
  return NextResponse.json({ profile }, { status: 201 })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId(req)
  const { id } = await params
  if (!await db.project.findFirst({ where: { id, userId } })) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const current = await db.academicProfile.findFirst({ where: { id: String(body.profileId ?? ''), userId, OR: [{ projectId: id }, { projectId: null }] } })
  if (!current) return NextResponse.json({ error: 'Academic profile not found' }, { status: 404 })
  const profile = await db.$transaction(async (tx) => {
    const updated = await tx.academicProfile.update({ where: { id: current.id }, data: {
      name: typeof body.name === 'string' ? body.name.trim().slice(0, 200) : undefined,
      cslStyle: typeof body.cslStyle === 'string' ? body.cslStyle.slice(0, 100) : undefined,
      headingJson: body.headings ? JSON.stringify(body.headings) : undefined,
      marginsJson: body.margins ? JSON.stringify(body.margins) : undefined,
      spacing: typeof body.spacing === 'number' ? Math.min(3, Math.max(1, body.spacing)) : undefined,
      titlePageJson: body.titlePage ? JSON.stringify(body.titlePage) : undefined,
      captionJson: body.captions ? JSON.stringify(body.captions) : undefined,
      tableJson: body.tables ? JSON.stringify(body.tables) : undefined,
      bibliographyJson: body.bibliography ? JSON.stringify(body.bibliography) : undefined,
      isDefault: typeof body.isDefault === 'boolean' ? body.isDefault : undefined,
    } })
    await appendAuditEvent(tx, { projectId: id, userId, type: 'academic_profile_updated', actor: 'student', payload: { summary: `Updated academic profile: ${updated.name}`, profileId: updated.id, cslStyle: updated.cslStyle, spacing: updated.spacing } })
    return updated
  })
  return NextResponse.json({ profile })
}
