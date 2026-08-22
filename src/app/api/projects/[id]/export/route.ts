/**
 * GET /api/projects/[id]/export?format=md|txt|html
 * Exports the project's document content in the requested format.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/auth-supabase'
import { documentToHtml, documentToPlainText } from '@/lib/document-content'
import { exportAcademicDocx } from '@/lib/docx'

function htmlToText(html: string): string {
  return html
    .replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function htmlToMarkdown(html: string): string {
  return html
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
    .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
    .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, '> $1\n\n')
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
    .replace(/<\/(p|div|ul|ol)>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const userId = await requireUserId(req)
  const { searchParams } = new URL(req.url)
  const format = (searchParams.get('format') ?? 'md').toLowerCase()

  const project = await db.project.findUnique({
    where: { id, userId },
    include: { document: true },
  })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const storedContent = project.document?.content ?? ''
  const html = documentToHtml(storedContent)
  const title = project.title

  let body: string
  let contentType: string
  let fileExt: string

  if (format === 'docx') {
    const body = await exportAcademicDocx(title, storedContent)
    const safeTitle = title.replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 60)
    return new NextResponse(new Uint8Array(body), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${safeTitle || 'cogdoc-export'}.docx"`,
      },
    })
  }

  switch (format) {
    case 'txt':
      body = `${title}\n${'='.repeat(title.length)}\n\n${documentToPlainText(storedContent)}`
      contentType = 'text/plain; charset=utf-8'
      fileExt = 'txt'
      break
    case 'html':
      body = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${title}</title>
<style>
body { font-family: Georgia, serif; max-width: 680px; margin: 2rem auto; padding: 0 1rem; line-height: 1.8; color: #2a2520; }
h1, h2, h3 { color: #1a1612; }
blockquote { border-left: 4px solid #ccc; padding-left: 1rem; font-style: italic; color: #555; }
</style>
</head>
<body>
<h1>${title}</h1>
${html}
</body>
</html>`
      contentType = 'text/html; charset=utf-8'
      fileExt = 'html'
      break
    case 'md':
    default:
      body = `# ${title}\n\n${htmlToMarkdown(html)}`
      contentType = 'text/markdown; charset=utf-8'
      fileExt = 'md'
      break
  }

  const safeTitle = title.replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 60)
  const filename = `${safeTitle || 'cogdoc-export'}.${fileExt}`

  return new NextResponse(body, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
