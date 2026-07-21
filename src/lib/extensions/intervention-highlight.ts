/**
 * InterventionHighlight — ProseMirror decoration plugin for sentence underlines.
 *
 * The legacy highlightSentences() wrapped matched sentences in <mark> tags by
 * mutating the editor DOM directly. That worked on the old contentEditable
 * surface, but ProseMirror's mutation observer reverts foreign DOM edits, so
 * on the Tiptap editor the marks vanished the instant they were added (the
 * "Phase 6 polish" note in editor-tiptap). This extension does it properly:
 * inline decorations computed from the active interventions, re-mapped on
 * every doc change, rendered by the view — never fighting ProseMirror.
 *
 * The editor pushes fresh interventions in via a transaction meta:
 *   editor.view.dispatch(editor.state.tr.setMeta(interventionHighlightKey, interventions))
 *
 * Decorated spans carry the same class + data attributes the hover popover
 * already listens for (.cogdoc-mark / data-sentence-key), so the popover
 * layer needed no changes.
 */
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as PMNode } from '@tiptap/pm/model'
import type { Intervention, EngineType } from '@/lib/types'
import { buildSentenceMap, buildUnderlineStyle } from '@/lib/sentence-highlight'

export const interventionHighlightKey = new PluginKey<PluginState>('cogdoc-intervention-highlight')

interface PluginState {
  interventions: Intervention[]
  decorations: DecorationSet
}

function buildDecorations(doc: PMNode, interventions: Intervention[]): DecorationSet {
  const sentenceMap = buildSentenceMap(interventions)
  if (sentenceMap.size === 0) return DecorationSet.empty

  const decorations: Decoration[] = []
  const matchedKeys = new Set<string>()

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text || node.text.length < 5) return
    const lower = node.text.toLowerCase()

    for (const [key, ints] of sentenceMap) {
      // Exact occurrences of the normalized sentence
      let idx = 0
      while ((idx = lower.indexOf(key, idx)) !== -1) {
        decorations.push(makeDecoration(pos + idx, pos + idx + key.length, key, ints))
        matchedKeys.add(key)
        idx += key.length
      }
      // Prefix fallback (writer edited the sentence tail): match the first
      // 40 chars and extend to the end of the sentence in the editor.
      if (!matchedKeys.has(key) && key.length > 40) {
        const prefix = key.slice(0, 40)
        const at = lower.indexOf(prefix)
        if (at !== -1) {
          let end = at + prefix.length
          while (end < lower.length && !'.!?'.includes(lower[end])) end++
          if (end < lower.length) end++ // include the punctuation
          decorations.push(makeDecoration(pos + at, pos + end, key, ints))
          matchedKeys.add(key)
        }
      }
    }
  })

  return DecorationSet.create(doc, decorations)
}

function makeDecoration(from: number, to: number, key: string, ints: Intervention[]): Decoration {
  const engineTypes = [...new Set(ints.map((i) => i.engineType))] as EngineType[]
  return Decoration.inline(from, to, {
    class: 'cogdoc-mark',
    'data-sentence-key': key,
    'data-engine-types': engineTypes.join(','),
    'data-intervention-ids': ints.map((i) => i.id).join(','),
    style: buildUnderlineStyle(engineTypes),
  })
}

export const InterventionHighlight = Extension.create({
  name: 'interventionHighlight',

  addProseMirrorPlugins() {
    return [
      new Plugin<PluginState>({
        key: interventionHighlightKey,
        state: {
          init: () => ({ interventions: [], decorations: DecorationSet.empty }),
          apply(tr, value, _oldState, newState) {
            const meta = tr.getMeta(interventionHighlightKey) as Intervention[] | undefined
            if (meta) {
              return { interventions: meta, decorations: buildDecorations(newState.doc, meta) }
            }
            if (tr.docChanged) {
              // Rebuild (not just map) so highlights follow sentence edits.
              return { ...value, decorations: buildDecorations(newState.doc, value.interventions) }
            }
            return value
          },
        },
        props: {
          decorations(state) {
            return interventionHighlightKey.getState(state)?.decorations ?? DecorationSet.empty
          },
        },
      }),
    ]
  },
})
