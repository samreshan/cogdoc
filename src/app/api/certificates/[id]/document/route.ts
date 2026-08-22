import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/auth-supabase'
import { readPrivateAsset } from '@/lib/private-storage'

export const runtime = 'nodejs'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId(req)
  const { id } = await params
  const certificate = await db.certificate.findFirst({
    where: { id, project: { userId } },
    include: { project: { select: { title: true } } },
  })
  if (!certificate?.docxStorageProvider || !certificate.docxStorageKey) {
    return NextResponse.json({ error: 'Certified document not found' }, { status: 404 })
  }
  const docx = await readPrivateAsset(certificate.docxStorageProvider, certificate.docxStorageKey)
  const safeTitle = certificate.project.title.replace(/[^a-z0-9._-]+/gi, '-').replace(/^-|-$/g, '') || 'assignment'
  return new NextResponse(new Uint8Array(docx), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${safeTitle}-certified.docx"`,
      'X-Cogdoc-SHA256': certificate.docxHash ?? '',
    },
  })
}
