/**
 * Sentence highlighting utility.
 *
 * Wraps sentences that have active interventions in <mark> tags so they get
 * a colored wavy underline. On hover, the editor shows a popover with all
 * interventions for that sentence.
 *
 * Key challenges:
 *  - Must save/restore cursor position (DOM modification resets selection)
 *  - Must not trigger input events (suppress with isHighlighting flag)
 *  - Must handle multiple interventions on the same sentence
 *  - Must handle multiple matches of the same sentence in the text
 */

import type { Intervention, EngineType } from '@/lib/types'

const MARK_CLASS = 'cogdoc-mark'

// Engine colors (matching the Tailwind palette used elsewhere)
export const ENGINE_COLORS: Record<EngineType, string> = {
  interceptor: '#d97706', // amber-600
  socratic: '#e11d48',    // rose-600
  citation: '#059669',    // emerald-600
  scaffold: '#0284c7',    // sky-600
}

const NEUTRAL_COLOR = '#78716c' // stone-500 — used when multiple engine types

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
  return text.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 300)
}

/**
 * Save the current selection as a character offset from the start of the editor.
 */
function saveCursorOffset(editor: HTMLElement): number {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return 0
  const range = sel.getRangeAt(0)
  const preRange = range.cloneRange()
  preRange.selectNodeContents(editor)
  preRange.setEnd(range.startContainer, range.startOffset)
  return preRange.toString().length
}

/**
 * Restore the selection from a character offset.
 */
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

/**
 * Unwrap all existing <mark> tags in the editor (called before re-highlighting).
 */
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
 * Highlight all sentences in the editor that have active interventions.
 * Call this after a debounce (2s idle) to avoid interfering with typing.
 *
 * Returns the number of marks created.
 */
export function highlightSentences(
  editor: HTMLElement,
  interventions: Intervention[],
): number {
  const sentenceMap = buildSentenceMap(interventions)
  if (sentenceMap.size === 0) {
    // Still unwrap any existing marks
    unwrapMarks(editor)
    return 0
  }

  // Save cursor
  const cursorOffset = saveCursorOffset(editor)

  // Unwrap existing marks first
  unwrapMarks(editor)

  // Walk all text nodes, find matches, wrap them
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

    // Find all matches in this text node
    type Match = { start: number; end: number; key: string; ints: Intervention[] }
    const matches: Match[] = []
    const lower = text.toLowerCase()
    for (const [key, ints] of sentenceMap) {
      let idx = 0
      while ((idx = lower.indexOf(key, idx)) !== -1) {
        matches.push({ start: idx, end: idx + key.length, key, ints })
        idx += key.length
      }
    }

    if (matches.length === 0) continue

    // Sort by start position, skip overlaps
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

    // Build replacement HTML
    let html = ''
    let pos = 0
    for (const m of valid) {
      html += escapeHtml(text.slice(pos, m.start))
      const engineTypes = [...new Set(m.ints.map((i) => i.engineType))]
      const color =
        engineTypes.length === 1 ? ENGINE_COLORS[engineTypes[0]] : NEUTRAL_COLOR
      const dataInterventionIds = m.ints.map((i) => i.id).join(',')
      html += `<mark class="${MARK_CLASS}" data-sentence-key="${escapeHtml(m.key)}" data-engine-types="${engineTypes.join(',')}" data-intervention-ids="${dataInterventionIds}" style="text-decoration: underline wavy ${color}; text-decoration-thickness: 1.5px; text-underline-offset: 4px; background: transparent; color: inherit;">${escapeHtml(text.slice(m.start, m.end))}</mark>`
      pos = m.end
    }
    html += escapeHtml(text.slice(pos))

    // Replace text node with marked-up nodes
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

  // Restore cursor
  restoreCursorOffset(editor, cursorOffset)

  return marksCreated
}

/**
 * Get all interventions for a given sentence key.
 */
export function getInterventionsForKey(
  interventions: Intervention[],
  key: string,
): Intervention[] {
  const normalized = normalizeKey(key)
  return interventions.filter(
    (i) => i.status === 'active' && normalizeKey(i.promptText ?? '') === normalized,
  )
}
