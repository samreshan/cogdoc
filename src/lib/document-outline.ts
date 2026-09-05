import type { Node as PMNode } from '@tiptap/pm/model'

export interface DocumentOutlineItem {
  id: string
  label: string
  level: number
  pos?: number
}

function headingSlug(label: string): string {
  const slug = label
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'section'
}

function uniqueHeadingId(label: string, seen: Map<string, number>): string {
  const slug = headingSlug(label)
  const occurrence = (seen.get(slug) ?? 0) + 1
  seen.set(slug, occurrence)
  return `outline-${slug}${occurrence > 1 ? `-${occurrence}` : ''}`
}

function jsonNodeText(node: Record<string, unknown>): string {
  if (typeof node.text === 'string') return node.text
  if (!Array.isArray(node.content)) return ''
  return (node.content as Array<Record<string, unknown>>).map(jsonNodeText).join('')
}

export function documentOutlineFromStoredContent(content: string | null | undefined): DocumentOutlineItem[] {
  if (!content) return []
  const rows: DocumentOutlineItem[] = []
  const seen = new Map<string, number>()
  try {
    const parsed = JSON.parse(content) as { content?: Array<Record<string, unknown>> }
    const walk = (nodes: Array<Record<string, unknown>> = []) => nodes.forEach((node) => {
      if (node.type === 'heading') {
        const label = jsonNodeText(node).trim()
        if (label) rows.push({
          id: uniqueHeadingId(label, seen),
          label,
          level: Number((node.attrs as { level?: number } | undefined)?.level ?? 1),
        })
      }
      if (Array.isArray(node.content)) walk(node.content as Array<Record<string, unknown>>)
    })
    walk(parsed.content)
  } catch {
    return []
  }
  return rows
}

export function documentOutlineFromProseMirror(doc: PMNode): DocumentOutlineItem[] {
  const rows: DocumentOutlineItem[] = []
  const seen = new Map<string, number>()
  doc.descendants((node, pos) => {
    if (node.type.name !== 'heading') return
    const label = node.textContent.trim()
    if (!label) return
    rows.push({
      id: uniqueHeadingId(label, seen),
      label,
      level: Number(node.attrs.level ?? 1),
      pos,
    })
  })
  return rows
}
