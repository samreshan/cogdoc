import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/auth-supabase'
import { randomToken, sha256 } from '@/lib/crypto'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId(req)
  const { id } = await params
  const certificate = await db.certificate.findFirst({ where: { id, project: { userId }, status: { not: 'revoked' } } })
  if (!certificate) return NextResponse.json({ error: 'Shareable certificate not found' }, { status: 404 })
  const body = await req.json().catch(() => ({}))
  const days = Math.min(365, Math.max(1, Number(body.expiresInDays ?? 90)))
  const token = randomToken()
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
  await db.shareGrant.create({ data: { certificateId: id, tokenHash: sha256(token), expiresAt } })
  return NextResponse.json({ shareUrl: `${new URL(req.url).origin}/verify/${token}`, expiresAt }, { status: 201 })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId(req)
  const { id } = await params
  const certificate = await db.certificate.findFirst({ where: { id, project: { userId } } })
  if (!certificate) return NextResponse.json({ error: 'Certificate not found' }, { status: 404 })
  await db.shareGrant.updateMany({ where: { certificateId: id, revokedAt: null }, data: { revokedAt: new Date() } })
  return NextResponse.json({ ok: true })
}
