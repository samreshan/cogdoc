/**
 * Sentence highlighting utility.
 *
 * Wraps sentences that have active interventions in <mark> tags with colored
 * wavy underlines. If a sentence has multiple interventions from different
 * engines, it gets a multi-colored underline (stacked borders).
 *
 * On hover, the editor shows a popover with all interventions for that sentence.
 */

import type { Intervention, EngineType } from '@/lib/types'

const MARK_CLASS = 'cogdoc-mark'

export const ENGINE_COLORS: Record<EngineType, string> = {
  interceptor: '#d97706', // amber-600
  socratic: '#e11d48',    // rose-600
  citation: '#059669',    // emerald-600
  scaffold: '#0284c7',    // sky-600
}

/**
 * Build a map: normalized sentence text -> interventions
 */
export function buildSentenceMap(interventions: Intervention[]): Map<string, Intervention[]> {
  const map = new Map<string, Intervention[]>()
  for (const i of interventions) {
    if (i.status !== 'active') continue
    if (!i.promptText || i.promptText.trim().length < 5) continue
    const key = normalizeKey(i.promptText)
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(i)
  }
  return map
}

function normalizeKey(text: string): string {
  // Fuzzy normalize: lowercase, collapse whitespace, strip leading/trailing
  // punctuation, and trim to 300 chars. This makes matching resilient to
  // minor edits the writer makes after the intervention was created.
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/^["'(\[]+/, '')
    .replace(/[)"'\].!?;:,]+$/, '')
    .slice(0, 300)
}

function saveCursorOffset(editor: HTMLElement): number {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return 0
  const range = sel.getRangeAt(0)
  const preRange = range.cloneRange()
  preRange.selectNodeContents(editor)
  preRange.setEnd(range.startContainer, range.startOffset)
  return preRange.toString().length
}

function restoreCursorOffset(editor: HTMLElement, offset: number) {
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT)
  let remaining = offset
  let node: Node | null
  while ((node = walker.nextNode())) {
    const len = node.textContent?.length ?? 0
    if (remaining <= len) {
      const range = document.createRange()
      range.setStart(node, remaining)
      range.collapse(true)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
      return
    }
    remaining -= len
  }
}

function unwrapMarks(editor: HTMLElement) {
  const marks = editor.querySelectorAll(`mark.${MARK_CLASS}`)
  marks.forEach((mark) => {
    const parent = mark.parentNode
    if (!parent) return
    while (mark.firstChild) {
      parent.insertBefore(mark.firstChild, mark)
    }
    parent.removeChild(mark)
  })
  editor.normalize()
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Build a CSS style string for a highly-visible multi-colored underline.
 * Uses a thick solid underline (3px) + a subtle background tint matching the
 * engine color so the marked sentence is impossible to miss.
 * Exported for the ProseMirror decoration plugin (intervention-highlight.ts).
 */
export function buildUnderlineStyle(engineTypes: EngineType[]): string {
  const colors = engineTypes.map((e) => ENGINE_COLORS[e])

  // Thick solid underline (3px) — much more visible than wavy 1.5px
  // If multiple engines, stack underlines with increasing offset
  const decorations = colors
    .map((c) => `underline solid ${c}`)
    .join(', ')

  // Subtle background tint (8% opacity) of the primary engine color
  const primaryColor = colors[0]
  const bgColor = `${primaryColor}14` // 14 = ~8% opacity in hex

  return [
    `text-decoration: ${decorations}`,
    'text-decoration-thickness: 3px',
    'text-underline-offset: 3px',
    `background: ${bgColor}`,
    'border-radius: 2px',
    'padding: 1px 2px',
    'margin: 0 -1px',
    'color: inherit',
  ].join('; ')
}

/**
 * Highlight all sentences in the editor that have active interventions.
 */
export function highlightSentences(
  editor: HTMLElement,
  interventions: Intervention[],
): number {
  const sentenceMap = buildSentenceMap(interventions)
  if (sentenceMap.size === 0) {
    unwrapMarks(editor)
    return 0
  }

  const cursorOffset = saveCursorOffset(editor)
  unwrapMarks(editor)

  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []
  let node: Node | null
  while ((node = walker.nextNode())) {
    textNodes.push(node as Text)
  }

  let marksCreated = 0

  for (const textNode of textNodes) {
    const text = textNode.textContent ?? ''
    if (text.length < 5) continue

    type Match = { start: number; end: number; key: string; ints: Intervention[] }
    const matches: Match[] = []
    const lower = text.toLowerCase()
    for (const [key, ints] of sentenceMap) {
      // Try exact match first
      let idx = 0
      while ((idx = lower.indexOf(key, idx)) !== -1) {
        matches.push({ start: idx, end: idx + key.length, key, ints })
        idx += key.length
      }
      // If no exact match, try matching the first 40 chars of the key
      // (handles cases where the writer edited the end of the sentence)
      if (!matches.some((m) => m.key === key) && key.length > 40) {
        const prefix = key.slice(0, 40)
        idx = lower.indexOf(prefix)
        if (idx !== -1) {
          // Extend to the end of the sentence in the editor
          let end = idx + prefix.length
          while (end < lower.length && !'[.!?]'.includes(lower[end])) end++
          if (end < lower.length) end++ // include the punctuation
          matches.push({ start: idx, end, key, ints })
        }
      }
    }

    if (matches.length === 0) continue

    matches.sort((a, b) => a.start - b.start)
    const valid: Match[] = []
    let lastEnd = 0
    for (const m of matches) {
      if (m.start >= lastEnd) {
        valid.push(m)
        lastEnd = m.end
      }
    }

    if (valid.length === 0) continue

    let html = ''
    let pos = 0
    for (const m of valid) {
      html += escapeHtml(text.slice(pos, m.start))
      const engineTypes = [...new Set(m.ints.map((i) => i.engineType))] as EngineType[]
      const style = buildUnderlineStyle(engineTypes)
      const dataInterventionIds = m.ints.map((i) => i.id).join(',')
      html += `<mark class="${MARK_CLASS}" data-sentence-key="${escapeHtml(m.key)}" data-engine-types="${engineTypes.join(',')}" data-intervention-ids="${dataInterventionIds}" style="${style}">${escapeHtml(text.slice(m.start, m.end))}</mark>`
      pos = m.end
    }
    html += escapeHtml(text.slice(pos))

    const temp = document.createElement('span')
    temp.innerHTML = html
    const parent = textNode.parentNode
    if (!parent) continue
    while (temp.firstChild) {
      parent.insertBefore(temp.firstChild, textNode)
    }
    parent.removeChild(textNode)
    marksCreated += valid.length
  }

  restoreCursorOffset(editor, cursorOffset)
  return marksCreated
}

export function getInterventionsForKey(
  interventions: Intervention[],
  key: string,
): Intervention[] {
  const normalized = normalizeKey(key)
  return interventions.filter(
    (i) => i.status === 'active' && normalizeKey(i.promptText ?? '') === normalized,
  )
}
