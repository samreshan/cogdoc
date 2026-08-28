import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/auth-supabase'
import { readPrivateAsset } from '@/lib/private-storage'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId(req)
  const { id } = await params
  const certificate = await db.certificate.findFirst({ where: { id, project: { userId } } })
  if (!certificate?.pdfStorageProvider || !certificate.pdfStorageKey) {
    return NextResponse.json({ error: 'Certificate PDF not found' }, { status: 404 })
  }
  const pdf = await readPrivateAsset(certificate.pdfStorageProvider, certificate.pdfStorageKey, certificate.projectId)
  return new NextResponse(new Uint8Array(pdf), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="cogdoc-certificate-${id}.pdf"` },
  })
}
