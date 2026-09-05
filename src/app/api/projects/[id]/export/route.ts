/**
 * GET /api/projects/[id]/export?format=md|txt|html
 * Exports the project's document content in the requested format.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/auth-supabase'
import { documentToHtml, documentToPlainText, parseDocumentContent, type ProseMirrorNode } from '@/lib/document-content'
import { exportAcademicDocx } from '@/lib/docx'
import { generateUsedBibliography } from '@/lib/bibliography'

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
    include: { document: true, references: true, academicProfiles: { orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }], take: 1 } },
  })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const storedContent = project.document?.content ?? ''
  const parsed = parseDocumentContent(storedContent)
  const bibliography = typeof parsed === 'string' ? [] : generateUsedBibliography(parsed, (project.references ?? []).flatMap((reference) => {
    if (!reference.title || !reference.url) return []
    let authors: string[] = []
    let metadata: Record<string, unknown> = {}
    try { authors = JSON.parse(reference.authorsJson) as string[] } catch {}
    try { metadata = JSON.parse(reference.metadataJson ?? '{}') as Record<string, unknown> } catch {}
    return [{ id: reference.id, title: reference.title, authors, year: reference.year, url: reference.url, doi: reference.doi, venue: typeof metadata.venue === 'string' ? metadata.venue : null, volume: typeof metadata.volume === 'string' ? metadata.volume : null, issue: typeof metadata.issue === 'string' ? metadata.issue : null, pages: typeof metadata.pages === 'string' ? metadata.pages : null, publisher: typeof metadata.publisher === 'string' ? metadata.publisher : null }]
  }), project.citationStyle === 'apa' ? 'apa' : 'harvard')
  const bibliographyHtml = bibliography.length ? `<h2>References</h2>${bibliography.map((entry) => `<p>${entry}</p>`).join('')}` : ''
  const html = documentToHtml(storedContent) + bibliographyHtml
  const title = project.title

  let body: string
  let contentType: string
  let fileExt: string

  if (format === 'docx') {
    let docxContent = storedContent
    if (bibliography.length && typeof parsed !== 'string') {
      const withBibliography: ProseMirrorNode = { ...parsed, content: [...(parsed.content ?? []), { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'References' }] }, ...bibliography.map((entry) => ({ type: 'paragraph', content: [{ type: 'text', text: entry }] }))] }
      docxContent = JSON.stringify(withBibliography)
    }
    const profile = project.academicProfiles?.[0]
    let marginsMm: Record<string, number> | undefined
    try { marginsMm = profile ? JSON.parse(profile.marginsJson) as Record<string, number> : undefined } catch {}
    const body = await exportAcademicDocx(title, docxContent, { marginsMm, spacing: profile?.spacing })
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
      body = `${title}\n${'='.repeat(title.length)}\n\n${documentToPlainText(storedContent)}${bibliography.length ? `\n\nReferences\n\n${bibliography.join('\n\n')}` : ''}`
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
