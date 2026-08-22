import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { StyleReviewBlock, StyleReviewScope } from '@/lib/style-review'

const REFERENCE_HEADING = /^\s*(references|bibliography|works cited)\s*$/i

/**
 * Converts editor blocks into analyzer input without losing ProseMirror
 * positions. Standard text characters occupy one document position, so a
 * suggestion's local offset remains directly selectable in the editor.
 */
export function documentStyleReviewBlocks(doc: ProseMirrorNode): StyleReviewBlock[] {
  const blocks: StyleReviewBlock[] = []
  let referencesStarted = false

  doc.descendants((node, position) => {
    if (!node.isTextblock) return true
    const text = node.textContent
    const isReferenceHeading = node.type.name === 'heading' && REFERENCE_HEADING.test(text)
    const isProtected = referencesStarted || isReferenceHeading || ['heading', 'blockquote', 'codeBlock', 'listItem', 'tableCell'].includes(node.type.name)
    blocks.push({
      text,
      from: position + 1,
      to: position + node.nodeSize - 1,
      nodeType: node.type.name,
      isProtected,
    })
    if (isReferenceHeading) referencesStarted = true
    return false
  })

  return blocks
}

export function styleReviewBlocksForScope(
  doc: ProseMirrorNode,
  selection: { from: number; to: number },
  scope: StyleReviewScope,
): StyleReviewBlock[] {
  const blocks = documentStyleReviewBlocks(doc)
  if (scope === 'document') return blocks

  if (scope === 'paragraph') {
    return blocks.filter((block) => selection.from >= block.from && selection.from <= block.to).slice(0, 1)
  }

  if (selection.from === selection.to) return []
  return blocks.flatMap((block) => {
    const from = Math.max(block.from, selection.from)
    const to = Math.min(block.to, selection.to)
    if (to <= from) return []
    const start = from - block.from
    const end = to - block.from
    return [{ ...block, from, to, text: block.text.slice(start, end) }]
  })
}
