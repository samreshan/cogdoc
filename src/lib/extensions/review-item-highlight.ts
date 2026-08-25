/**
 * ReviewItemHighlight — document decorations for actionable review items.
 *
 * Review items are anchored to an exact document quote. Rendering that anchor
 * as a decoration makes the relationship visible in long drafts and lets the
 * queue's focus action land on a real underline instead of an invisible range.
 */
import { Extension } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { findEditorTextRange } from '@/lib/editor-focus'

interface PluginState {
  quotes: string[]
  decorations: DecorationSet
}

export const reviewItemHighlightKey = new PluginKey<PluginState>('cogdoc-review-item-highlight')

export const reviewItemUnderlineStyle = [
  'text-decoration: underline wavy #a16207',
  'text-decoration-thickness: 2px',
  'text-underline-offset: 4px',
  'background: #fef3c7',
  'border-radius: 2px',
  'padding: 1px 2px',
  'margin: 0 -1px',
  'color: inherit',
].join('; ')

export function buildReviewItemDecorations(doc: PMNode, quotes: string[]): DecorationSet {
  const uniqueQuotes = [...new Set(quotes.map((quote) => quote.trim()).filter((quote) => quote.length >= 5))]
  const decorations = uniqueQuotes.flatMap((quote) => {
    const range = findEditorTextRange(doc, quote)
    if (!range) return []
    return [Decoration.inline(range.from, range.to, {
      class: 'cogdoc-review-mark',
      'data-review-quote': quote.slice(0, 300),
      style: reviewItemUnderlineStyle,
    })]
  })
  return DecorationSet.create(doc, decorations)
}

export const ReviewItemHighlight = Extension.create({
  name: 'reviewItemHighlight',

  addProseMirrorPlugins() {
    return [
      new Plugin<PluginState>({
        key: reviewItemHighlightKey,
        state: {
          init: () => ({ quotes: [], decorations: DecorationSet.empty }),
          apply(tr, value, _oldState, newState) {
            const quotes = tr.getMeta(reviewItemHighlightKey) as string[] | undefined
            if (quotes) {
              return { quotes, decorations: buildReviewItemDecorations(newState.doc, quotes) }
            }
            if (tr.docChanged) {
              return { ...value, decorations: buildReviewItemDecorations(newState.doc, value.quotes) }
            }
            return value
          },
        },
        props: {
          decorations(state) {
            return reviewItemHighlightKey.getState(state)?.decorations ?? DecorationSet.empty
          },
        },
      }),
    ]
  },
})
