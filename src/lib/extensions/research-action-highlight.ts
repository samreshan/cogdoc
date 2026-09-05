import { Extension } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { ResearchAction } from '@/lib/types'
import { findEditorTextRange } from '@/lib/editor-focus'
import { quoteForResearchAction } from '@/lib/research-document-anchors'

interface PluginState {
  actions: ResearchAction[]
  decorations: DecorationSet
}

export const researchActionHighlightKey = new PluginKey<PluginState>('cogdoc-research-action-highlight')

export function buildResearchActionDecorations(doc: PMNode, actions: ResearchAction[]): DecorationSet {
  const decorations = actions.flatMap((action) => {
    if (action.state !== 'open') return []
    const quote = quoteForResearchAction(action)
    if (!quote) return []
    const range = findEditorTextRange(doc, quote)
    if (!range) return []
    return [Decoration.inline(range.from, range.to, {
      id: `action-${action.id}`,
      class: 'cogdoc-action-mark',
      role: 'button',
      tabindex: '0',
      'data-action-id': action.id,
      'aria-label': `Next action: ${action.title}`,
    })]
  })
  return DecorationSet.create(doc, decorations)
}

export const ResearchActionHighlight = Extension.create({
  name: 'researchActionHighlight',
  addProseMirrorPlugins() {
    return [new Plugin<PluginState>({
      key: researchActionHighlightKey,
      state: {
        init: () => ({ actions: [], decorations: DecorationSet.empty }),
        apply(transaction, value, _oldState, newState) {
          const actions = transaction.getMeta(researchActionHighlightKey) as ResearchAction[] | undefined
          if (actions) return { actions, decorations: buildResearchActionDecorations(newState.doc, actions) }
          if (transaction.docChanged) return { ...value, decorations: buildResearchActionDecorations(newState.doc, value.actions) }
          return value
        },
      },
      props: {
        decorations: (state) => researchActionHighlightKey.getState(state)?.decorations ?? DecorationSet.empty,
      },
    })]
  },
})
