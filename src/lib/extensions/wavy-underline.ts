/**
 * WavyUnderline — a Tiptap Mark that wraps intervention-linked sentences in
 * a coloured <mark>, mirroring the sentence-highlight.ts contract.
 *
 * The mark carries data attributes (engineTypes, interventionIds, sentenceKey)
 * so the popover + living-margin can resolve interventions from the DOM node.
 * Sprint 2 Stream C: the editor surface migrates from raw contentEditable to
 * Tiptap behind USE_TIPTAP_EDITOR; this Mark preserves the highlighting
 * contract the characterization tests lock.
 */
import { Mark, type MarkSpec } from '@tiptap/core'
import type { EngineType } from '@/lib/types'

/** Hex colours per engine — mirrors ENGINE_COLORS in sentence-highlight.ts. */
export const ENGINE_MARK_COLORS: Record<EngineType, string> = {
  interceptor: '#d97706', // amber-600
  socratic: '#e11d48', // rose-600
  citation: '#059669', // emerald-600
  scaffold: '#0284c7', // sky-600
}

/**
 * Build the underline style string for a set of engine types.
 * Multi-engine sentences get stacked underlines + a tint of the primary colour.
 * Exported for direct unit testing (pure).
 */
export function buildUnderlineStyle(engineTypesCsv: string): string {
  const engines = engineTypesCsv.split(',').filter(Boolean) as EngineType[]
  const colors = engines.map((e) => ENGINE_MARK_COLORS[e] ?? '#999999')
  const decorations = colors.map((c) => `underline solid ${c}`).join(', ')
  const primary = colors[0] ?? '#999999'
  const bg = `${primary}14` // ~8% opacity
  return [
    `text-decoration: ${decorations}`,
    'text-decoration-thickness: 3px',
    'text-underline-offset: 3px',
    `background: ${bg}`,
    'border-radius: 2px',
    'padding: 1px 2px',
    'margin: 0 -1px',
    'color: inherit',
  ].join('; ')
}

export const WavyUnderline = Mark.create({
  name: 'wavyUnderline',

  addAttributes() {
    return {
      engineTypes: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-engine-types') ?? '',
        renderHTML: (attrs) => (attrs.engineTypes ? { 'data-engine-types': attrs.engineTypes } : {}),
      },
      interventionIds: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-intervention-ids') ?? '',
        renderHTML: (attrs) => (attrs.interventionIds ? { 'data-intervention-ids': attrs.interventionIds } : {}),
      },
      sentenceKey: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-sentence-key') ?? '',
        renderHTML: (attrs) => (attrs.sentenceKey ? { 'data-sentence-key': attrs.sentenceKey } : {}),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'mark.cogdoc-mark' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const engineTypes = (node.attrs.engineTypes as string) || ''
    const style = buildUnderlineStyle(engineTypes)
    return [
      'mark',
      {
        class: 'cogdoc-mark',
        style,
        ...HTMLAttributes,
      },
    ]
  },
})