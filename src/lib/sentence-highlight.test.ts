// @vitest-environment happy-dom
/**
 * Characterization tests for sentence-highlight.ts
 *
 * Runs in happy-dom (DOM environment) because highlightSentences manipulates
 * the DOM via createTreeWalker, window.getSelection, and innerHTML.
 *
 * These tests lock the marking behaviour so the Tiptap migration (Sprint 2)
 * can swap the editor surface while preserving the sentence→intervention
 * linking contract.
 *
 * Maps to PRODUCT.md §15.2 U-12.
 */
import { describe, it, expect } from 'vitest'
import {
  buildSentenceMap,
  highlightSentences,
  getInterventionsForKey,
  ENGINE_COLORS,
} from '@/lib/sentence-highlight'
import type { Intervention, EngineType } from '@/lib/types'

function makeIntervention(overrides: Partial<Intervention> = {}): Intervention {
  return {
    id: 'iv-1',
    userId: 'u1',
    projectId: 'p1',
    paragraphId: null,
    promptTemplateTag: 'Provocation',
    engineType: 'socratic',
    promptText: 'the cat sat on the mat',
    responseText: 'a question',
    verdict: null,
    status: 'active',
    userAction: null,
    createdAt: new Date().toISOString(),
    resolvedAt: null,
    ...overrides,
  }
}

describe('ENGINE_COLORS', () => {
  it('defines a hex colour for every EngineType', () => {
    const engines: EngineType[] = ['interceptor', 'socratic', 'citation', 'scaffold']
    for (const e of engines) {
      expect(ENGINE_COLORS[e]).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })
})

describe('buildSentenceMap', () => {
  it('skips non-active interventions', () => {
    const iv = makeIntervention({ status: 'resolved' })
    const map = buildSentenceMap([iv])
    expect(map.size).toBe(0)
  })

  it('skips interventions with promptText shorter than 5 chars', () => {
    const iv = makeIntervention({ promptText: 'hi' })
    const map = buildSentenceMap([iv])
    expect(map.size).toBe(0)
  })

  it('groups interventions by normalized key', () => {
    const a = makeIntervention({ id: 'a', promptText: 'The cat sat on the mat' })
    const b = makeIntervention({ id: 'b', promptText: 'the cat sat on the mat.' })
    // Both normalize to the same key
    const map = buildSentenceMap([a, b])
    expect(map.size).toBe(1)
    for (const [, ints] of map) expect(ints).toHaveLength(2)
  })
})

describe('getInterventionsForKey', () => {
  it('returns active interventions matching the normalized key', () => {
    const iv = makeIntervention({ promptText: 'Cognitive load reduces performance.' })
    const result = getInterventionsForKey([iv], 'cognitive load reduces performance')
    expect(result).toHaveLength(1)
  })

  it('excludes non-active interventions', () => {
    const iv = makeIntervention({ status: 'resolved', promptText: 'Cognitive load reduces performance.' })
    expect(getInterventionsForKey([iv], 'cognitive load reduces performance')).toHaveLength(0)
  })
})

describe('highlightSentences (DOM)', () => {
  it('returns 0 and adds no marks when no active interventions', () => {
    document.body.innerHTML = '<div id="ed">some text content here</div>'
    const editor = document.getElementById('ed')!
    const count = highlightSentences(editor, [])
    expect(count).toBe(0)
    expect(editor.querySelectorAll('mark.cogdoc-mark').length).toBe(0)
  })

  it('wraps a matching sentence in a mark with engine colour style', () => {
    const iv = makeIntervention({
      engineType: 'citation',
      promptText: 'the study shows significant results',
    })
    document.body.innerHTML =
      '<div id="ed">Here is context. the study shows significant results. More text.</div>'
    const editor = document.getElementById('ed')!

    const count = highlightSentences(editor, [iv])
    expect(count).toBe(1)

    const mark = editor.querySelector('mark.cogdoc-mark')
    expect(mark).not.toBeNull()
    // the citation engine colour appears in the style
    expect(mark!.getAttribute('style')).toContain(ENGINE_COLORS.citation)
    expect(mark!.getAttribute('data-engine-types')).toContain('citation')
  })

  it('unwraps previous marks before re-applying (no duplication)', () => {
    const iv = makeIntervention({ promptText: 'the cat sat on the mat' })
    document.body.innerHTML = '<div id="ed">the cat sat on the mat here</div>'
    const editor = document.getElementById('ed')!

    highlightSentences(editor, [iv])
    highlightSentences(editor, [iv])
    expect(editor.querySelectorAll('mark.cogdoc-mark').length).toBe(1)
  })

  it('handles multiple distinct interventions as separate marks', () => {
    const a = makeIntervention({ id: 'a', promptText: 'first claim is supported' })
    const b = makeIntervention({ id: 'b', engineType: 'interceptor', promptText: 'second claim about data' })
    document.body.innerHTML =
      '<div id="ed">first claim is supported. second claim about data. trailing.</div>'
    const editor = document.getElementById('ed')!

    const count = highlightSentences(editor, [a, b])
    expect(count).toBe(2)
    expect(editor.querySelectorAll('mark.cogdoc-mark').length).toBe(2)
  })
})
