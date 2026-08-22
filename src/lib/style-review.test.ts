import { describe, expect, it } from 'vitest'
import { reviewNaturalStyle, type StyleReviewBlock } from '@/lib/style-review'

function block(text: string, from = 1, overrides: Partial<StyleReviewBlock> = {}): StyleReviewBlock {
  return { text, from, to: from + text.length, nodeType: 'paragraph', ...overrides }
}

describe('reviewNaturalStyle', () => {
  it('flags a long, clause-stacked sentence without proposing replacement prose', () => {
    const text = 'The research process was carefully designed to collect a very large amount of data from several different sources, and it was then reviewed by multiple members of the team, which meant that the final analysis took much longer than originally expected because every result had to be checked again.'
    const result = reviewNaturalStyle({ scope: 'paragraph', blocks: [block(text)] })

    const suggestion = result.suggestions.find((item) => item.rule === 'long_sentence')
    expect(suggestion).toMatchObject({
      severity: 'consider',
      from: 1,
      to: text.length + 1,
    })
    expect(suggestion).not.toHaveProperty('replacement')
    expect(suggestion?.authorPrompt).toMatch(/split|main point/i)
  })

  it('flags repeated openings across adjacent sentences', () => {
    const text = 'This study examines the first issue in detail. This study examines the second issue in detail. This study examines the third issue in detail.'
    const result = reviewNaturalStyle({ scope: 'paragraph', blocks: [block(text)] })

    expect(result.suggestions.filter((item) => item.rule === 'repeated_opener')).toHaveLength(1)
    expect(result.suggestions.find((item) => item.rule === 'repeated_opener')?.excerpt).toContain('This study examines')
  })

  it('flags wordy stock phrasing at its exact editor range', () => {
    const text = 'In order to evaluate the prototype, participants completed a structured task.'
    const result = reviewNaturalStyle({ scope: 'selection', blocks: [block(text, 10)] })
    const suggestion = result.suggestions.find((item) => item.rule === 'wordy_phrase')

    expect(suggestion).toMatchObject({ from: 10, to: 21, excerpt: 'In order to' })
  })

  it('flags clusters of hedging or absolute language as prompts for evidence calibration', () => {
    const text = 'The intervention clearly and undoubtedly proves that students always improve their critical thinking.'
    const result = reviewNaturalStyle({ scope: 'paragraph', blocks: [block(text)] })

    expect(result.suggestions.map((item) => item.rule)).toContain('absolute_language')
  })

  it('does not inspect protected material such as references, quotations, and code', () => {
    const blocks = [
      block('References', 1, { nodeType: 'heading' }),
      block('Smith, J. (2024). In order to understand evidence.', 20, { isProtected: true }),
      block('"In order to understand evidence," the author wrote.', 80, { nodeType: 'blockquote' }),
      block('const result = "in order to understand"', 140, { nodeType: 'codeBlock' }),
    ]

    expect(reviewNaturalStyle({ scope: 'document', blocks }).suggestions).toEqual([])
  })

  it('returns stable, range-sorted results for the same input', () => {
    const text = 'In order to begin, this study examines the first topic. In order to continue, this study examines the second topic. In order to finish, this study examines the third topic.'
    const input = { scope: 'document' as const, blocks: [block(text, 50)] }

    const first = reviewNaturalStyle(input)
    const second = reviewNaturalStyle(input)
    expect(first).toEqual(second)
    expect(first.suggestions.map((item) => item.from)).toEqual([...first.suggestions.map((item) => item.from)].sort((a, b) => a - b))
  })
})
