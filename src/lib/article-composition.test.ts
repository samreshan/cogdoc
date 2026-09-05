import { describe, expect, it } from 'vitest'
import { manualOutlineContent, validateGeneratedDraft } from './article-composition'
import type { ArticleFindingInput } from './article-composition-types'

const finding: ArticleFindingInput = {
  findingId: 'finding-1', findingRevisionId: 'revision-1', dependencyHash: 'hash',
  question: 'What does the evidence support?', conclusion: 'Only a qualified conclusion.',
  explanation: 'The evidence is narrow.', uncertainty: 'More evidence may change this.',
  limitations: 'One source.', conflicts: 'None identified.',
  evidence: [{ sourceTitle: 'Synthetic source', locator: '§ 2', excerpt: 'A bounded passage.' }],
}

describe('article composition', () => {
  it('creates a manual writing outline without generated prose', () => {
    const content = manualOutlineContent('My outline', [finding])
    expect(content).toContain('Write this section in your own words')
    expect(content).toContain('What does the evidence support?')
    expect(content).toContain('Synthetic source (§ 2)')
  })

  it('preserves locators and uncertainty while rejecting unknown provider source indexes', () => {
    const result = validateGeneratedDraft({ content: '# Draft', sourceIndexes: [0], unsupportedClaims: ['Confirm this bridge.'] }, [finding])
    expect(result.content).toContain('Synthetic source — § 2')
    expect(result.content).toContain('More evidence may change this.')
    expect(() => validateGeneratedDraft({ content: '# Draft', sourceIndexes: [4], unsupportedClaims: [] }, [finding])).toThrow('unknown finding')
  })
})
