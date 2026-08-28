import { describe, expect, it } from 'vitest'
import { formatCitation, parseDisplayName } from '@/lib/citation-format'

const source = {
  title: 'Learning through deliberate practice',
  authors: ['Maya Chen', 'Noah Williams'],
  year: '2025',
  venue: 'Journal of Learning Research',
  doi: 'https://doi.org/10.1000/example',
  url: 'https://doi.org/10.1000/example',
}

describe('formatCitation', () => {
  it('renders APA bibliography and author-date text through CSL', () => {
    const result = formatCitation(source, 'apa')
    expect(result.reference).toBe('Chen, M., & Williams, N. (2025). Learning through deliberate practice. Journal of Learning Research. https://doi.org/10.1000/example')
    expect(result.inText).toBe('(Chen & Williams, 2025)')
    expect(result.processor).toBe('citation-js/citeproc-js')
  })

  it('renders the built-in Harvard CSL template', () => {
    const result = formatCitation(source, 'harvard')
    expect(result.reference).toContain('Chen, M. and Williams, N. (2025)')
    expect(result.reference).toContain('Available at: https://doi.org/10.1000/example')
    expect(result.inText).toBe('(Chen and Williams, 2025)')
  })

  it('uses n.d. without inventing a publication year', () => {
    const result = formatCitation({ ...source, year: null }, 'apa')
    expect(result.reference).toContain('(n.d.).')
  })
})

describe('parseDisplayName', () => {
  it('retains surname particles', () => {
    expect(parseDisplayName('Jeroen J. G. van Merriënboer')).toEqual({ family: 'van Merriënboer', given: 'Jeroen J. G.' })
  })

  it('accepts registry-style family, given names', () => {
    expect(parseDisplayName('Chen, Maya')).toEqual({ family: 'Chen', given: 'Maya' })
  })
})
