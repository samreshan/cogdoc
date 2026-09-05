import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as PMNode } from '@tiptap/pm/model'
import { documentOutlineFromProseMirror } from '@/lib/document-outline'

export const documentOutlineAnchorKey = new PluginKey<DecorationSet>('cogdoc-document-outline-anchors')

export function buildDocumentOutlineDecorations(doc: PMNode): DecorationSet {
  const decorations = documentOutlineFromProseMirror(doc).flatMap((item) => {
    if (item.pos === undefined) return []
    const node = doc.nodeAt(item.pos)
    if (!node) return []
    return [Decoration.node(item.pos, item.pos + node.nodeSize, {
      id: item.id,
      class: 'cogdoc-outline-heading',
      'data-outline-id': item.id,
      // Programmatic focus only after navigator activation; this is not a
      // document tab stop and has no hover/click behavior.
      tabindex: '-1',
    })]
  })
  return DecorationSet.create(doc, decorations)
}

export const DocumentOutlineAnchors = Extension.create({
  name: 'documentOutlineAnchors',
  addProseMirrorPlugins() {
    return [new Plugin<DecorationSet>({
      key: documentOutlineAnchorKey,
      state: {
        init: (_, state) => buildDocumentOutlineDecorations(state.doc),
        apply: (transaction, value, _oldState, newState) => transaction.docChanged
          ? buildDocumentOutlineDecorations(newState.doc)
          : value,
      },
      props: {
        decorations: (state) => documentOutlineAnchorKey.getState(state) ?? DecorationSet.empty,
      },
    })]
  },
})
