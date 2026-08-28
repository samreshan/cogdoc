import { describe, expect, it } from 'vitest'
import { metadataConfidence, type NormalizedReferenceMetadata } from '@/lib/reference-metadata'

const registry: NormalizedReferenceMetadata = {
  provider: 'crossref',
  doi: '10.1000/example',
  title: 'Learning through deliberate practice',
  year: '2025',
  authors: ['Chen'],
  url: 'https://doi.org/10.1000/example',
  raw: {},
}

describe('metadataConfidence', () => {
  it('matches a discovered full author name to a registry family name', () => {
    expect(metadataConfidence({
      rawText: '', authors: ['Maya Chen'], year: '2025',
      title: 'Learning through deliberate practice', doi: registry.doi, key: 'chen:2025',
    }, registry)).toBe(1)
  })

  it('does not accept a different lead author', () => {
    expect(metadataConfidence({
      rawText: '', authors: ['Noah Williams'], year: '2025',
      title: 'Learning through deliberate practice', doi: registry.doi, key: 'williams:2025',
    }, registry)).toBe(0.8)
  })
})
