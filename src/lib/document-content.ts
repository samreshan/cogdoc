/**
 * Canonical document conversion helpers shared by imports, scans, exports and
 * certification. Cogdoc stores ProseMirror JSON as a string, but still accepts
 * legacy HTML documents during the lazy migration.
 */

export interface ProseMirrorNode {
  type?: string
  attrs?: Record<string, unknown>
  text?: string
  marks?: Array<{ type?: string; attrs?: Record<string, unknown> }>
  content?: ProseMirrorNode[]
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([a-f0-9]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
}

function attributes(raw: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const match of raw.matchAll(/([:\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
    result[(match[1] ?? '').toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? '')
  }
  return result
}

/** Semantic, dependency-free HTML migration for legacy and Mammoth content. */
export function htmlToProseMirror(html: string): ProseMirrorNode {
  const root: ProseMirrorNode = { type: 'doc', content: [] }
  const stack: Array<{ tag: string; node: ProseMirrorNode }> = [{ tag: 'doc', node: root }]
  const marks: Array<{ tag: string; mark: { type: string; attrs?: Record<string, unknown> } }> = []
  const blockTypes: Record<string, { type: string; attrs?: Record<string, unknown> }> = {
    p: { type: 'paragraph' }, div: { type: 'paragraph' },
    ul: { type: 'bulletList' }, ol: { type: 'orderedList' }, li: { type: 'listItem' },
    blockquote: { type: 'blockquote' }, pre: { type: 'codeBlock' },
    table: { type: 'table' }, tr: { type: 'tableRow' }, th: { type: 'tableHeader' }, td: { type: 'tableCell' },
  }
  const current = () => stack.at(-1)!.node
  const add = (node: ProseMirrorNode) => {
    current().content ??= []
    current().content!.push(node)
  }
  const ensureTextParent = () => {
    if (['doc', 'listItem', 'tableCell', 'tableHeader'].includes(current().type ?? '')) {
      const paragraph: ProseMirrorNode = { type: 'paragraph', content: [] }
      add(paragraph)
      stack.push({ tag: '__auto_paragraph__', node: paragraph })
    }
  }
  const cleaned = html.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '')
  for (const token of cleaned.match(/<!--[\s\S]*?-->|<[^>]+>|[^<]+/g) ?? []) {
    if (token.startsWith('<!--')) continue
    if (!token.startsWith('<')) {
      let text = decodeEntities(token)
      if (current().type !== 'codeBlock') text = text.replace(/\s+/g, ' ')
      if (!text || (!text.trim() && ['doc', 'bulletList', 'orderedList', 'table', 'tableRow'].includes(current().type ?? ''))) continue
      ensureTextParent()
      add({ type: 'text', text, marks: marks.length ? marks.map((entry) => entry.mark) : undefined })
      continue
    }
    const closing = token.match(/^<\s*\/\s*([\w-]+)/)
    if (closing) {
      const tag = closing[1]!.toLowerCase()
      const markIndex = marks.map((entry) => entry.tag).lastIndexOf(tag)
      if (markIndex >= 0) marks.splice(markIndex, 1)
      const stackIndex = stack.map((entry) => entry.tag).lastIndexOf(tag)
      if (stackIndex > 0) stack.splice(stackIndex)
      continue
    }
    const opening = token.match(/^<\s*([\w-]+)([\s\S]*?)\/?\s*>$/)
    if (!opening) continue
    const tag = opening[1]!.toLowerCase()
    const attrs = attributes(opening[2] ?? '')
    if (/^h[1-6]$/.test(tag)) blockTypes[tag] = { type: 'heading', attrs: { level: Number(tag[1]) } }
    if (tag === 'br') { ensureTextParent(); add({ type: 'hardBreak' }); continue }
    if (tag === 'hr') { add({ type: 'horizontalRule' }); continue }
    if (tag === 'img') {
      const src = attrs.src && !/^javascript:/i.test(attrs.src) ? attrs.src : ''
      if (src) { ensureTextParent(); add({ type: 'image', attrs: { src, alt: attrs.alt ?? '', title: attrs.title ?? null } }) }
      continue
    }
    const markType = tag === 'strong' || tag === 'b' ? 'bold'
      : tag === 'em' || tag === 'i' ? 'italic'
        : tag === 's' || tag === 'del' ? 'strike'
          : tag === 'code' && current().type !== 'codeBlock' ? 'code'
            : tag === 'a' ? 'link' : null
    if (markType) {
      const href = attrs.href && !/^javascript:/i.test(attrs.href) ? attrs.href : '#'
      marks.push({ tag, mark: markType === 'link' ? { type: 'link', attrs: { href } } : { type: markType } })
      continue
    }
    const definition = blockTypes[tag]
    if (definition) {
      if (stack.at(-1)?.tag === '__auto_paragraph__') stack.pop()
      const node: ProseMirrorNode = { ...definition, content: [] }
      add(node)
      stack.push({ tag, node })
    }
  }
  if (!root.content?.length) root.content = [{ type: 'paragraph' }]
  return root
}

export function parseDocumentContent(value: string | null | undefined): ProseMirrorNode | string {
  if (!value) return { type: 'doc', content: [{ type: 'paragraph' }] }
  const trimmed = value.trim()
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as ProseMirrorNode
      if (parsed?.type === 'doc') return parsed
    } catch {
      // Legacy/plain content intentionally falls through.
    }
  }
  return htmlToProseMirror(value)
}

export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|blockquote|tr)>/gi, '\n')
    .replace(/<\/t[dh]>/gi, '\t')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function nodeText(node: ProseMirrorNode): string {
  if (node.type === 'text') return node.text ?? ''
  if (node.type === 'structuredCitation') {
    const locator = String(node.attrs?.locator ?? '').trim()
    return `(${String(node.attrs?.author ?? 'Unknown')}, ${String(node.attrs?.year ?? 'n.d.')}${locator ? `, ${locator}` : ''})`
  }
  const children = (node.content ?? []).map(nodeText)
  if (node.type === 'hardBreak') return '\n'
  if (node.type === 'listItem') return `${children.join('')}\n`
  if (['paragraph', 'heading', 'blockquote', 'codeBlock', 'tableRow'].includes(node.type ?? '')) {
    return `${children.join('')}\n`
  }
  if (['bulletList', 'orderedList', 'table'].includes(node.type ?? '')) {
    return `${children.join('')}\n`
  }
  return children.join('')
}

export function documentToPlainText(value: string | ProseMirrorNode | null | undefined): string {
  const parsed = typeof value === 'string' ? parseDocumentContent(value) : value
  if (typeof parsed === 'string') return stripHtml(parsed)
  return nodeText(parsed ?? { type: 'doc' })
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderMarks(text: string, marks: ProseMirrorNode['marks']): string {
  return (marks ?? []).reduce((result, mark) => {
    if (mark.type === 'bold') return `<strong>${result}</strong>`
    if (mark.type === 'italic') return `<em>${result}</em>`
    if (mark.type === 'strike') return `<s>${result}</s>`
    if (mark.type === 'code') return `<code>${result}</code>`
    if (mark.type === 'link') {
      const href = escapeHtml(String(mark.attrs?.href ?? '#'))
      return `<a href="${href}" rel="noreferrer">${result}</a>`
    }
    // Intervention marks are deliberately omitted from exports.
    return result
  }, escapeHtml(text))
}

function nodeHtml(node: ProseMirrorNode): string {
  if (node.type === 'text') return renderMarks(node.text ?? '', node.marks)
  if (node.type === 'structuredCitation') {
    const locator = String(node.attrs?.locator ?? '').trim()
    return `<span data-cogdoc-citation data-reference-id="${escapeHtml(String(node.attrs?.referenceId ?? ''))}">(${escapeHtml(String(node.attrs?.author ?? 'Unknown'))}, ${escapeHtml(String(node.attrs?.year ?? 'n.d.'))}${locator ? `, ${escapeHtml(locator)}` : ''})</span>`
  }
  const children = (node.content ?? []).map(nodeHtml).join('')
  switch (node.type) {
    case 'doc': return children
    case 'paragraph': return `<p>${children || '<br>'}</p>`
    case 'heading': {
      const level = Math.min(6, Math.max(1, Number(node.attrs?.level ?? 1)))
      return `<h${level}>${children}</h${level}>`
    }
    case 'bulletList': return `<ul>${children}</ul>`
    case 'orderedList': return `<ol>${children}</ol>`
    case 'listItem': return `<li>${children}</li>`
    case 'blockquote': return `<blockquote>${children}</blockquote>`
    case 'codeBlock': return `<pre><code>${children}</code></pre>`
    case 'hardBreak': return '<br>'
    case 'horizontalRule': return '<hr>'
    case 'table': return `<table>${children}</table>`
    case 'tableRow': return `<tr>${children}</tr>`
    case 'tableHeader': return `<th>${children}</th>`
    case 'tableCell': return `<td>${children}</td>`
    case 'image': {
      const src = escapeHtml(String(node.attrs?.src ?? ''))
      const alt = escapeHtml(String(node.attrs?.alt ?? 'Imported image'))
      return src ? `<img src="${src}" alt="${alt}">` : ''
    }
    default: return children
  }
}

export function documentToHtml(value: string | ProseMirrorNode | null | undefined): string {
  const parsed = typeof value === 'string' ? parseDocumentContent(value) : value
  if (typeof parsed === 'string') return parsed
  return nodeHtml(parsed ?? { type: 'doc' })
}

export function canonicalDocumentString(value: string | ProseMirrorNode | null | undefined): string {
  const parsed = typeof value === 'string' ? parseDocumentContent(value) : value
  return typeof parsed === 'string' ? JSON.stringify(htmlToProseMirror(parsed)) : JSON.stringify(parsed ?? { type: 'doc' })
}

export function documentWordCount(value: string | ProseMirrorNode | null | undefined): number {
  return documentToPlainText(value).split(/\s+/).filter(Boolean).length
}
