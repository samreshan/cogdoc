import { describe, expect, it } from 'vitest'
import { generateUsedBibliography, usedCitationIds } from './bibliography'

const document = { type: 'doc', content: [{ type: 'paragraph', content: [
  { type: 'structuredCitation', attrs: { referenceId: 'b' } }, { type: 'text', text: ' then ' },
  { type: 'structuredCitation', attrs: { referenceId: 'a' } }, { type: 'structuredCitation', attrs: { referenceId: 'b' } },
] }] }

describe('used bibliography', () => {
  it('deduplicates citations and excludes unused records', () => {
    expect(usedCitationIds(document)).toEqual(['b', 'a'])
    const records = [
      { id: 'a', title: 'Alpha', authors: ['Maya Chen'], year: '2024', url: 'https://example.com/a' },
      { id: 'b', title: 'Beta', authors: ['A. Rai'], year: '2025', url: 'https://example.com/b' },
      { id: 'unused', title: 'Unused', authors: ['X'], year: '2020', url: 'https://example.com/x' },
    ]
    const result = generateUsedBibliography(document, records, 'apa')
    expect(result).toHaveLength(2)
    expect(result.join(' ')).not.toContain('Unused')
  })
})
