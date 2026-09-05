import { describe, expect, it } from 'vitest'
import { structuredCitationForReference } from './citation-insertion'
import type { ReferenceSummary } from './types'

const reference: ReferenceSummary = {
  id: 'ref-1', rawText: 'Sharma and Rai (2025). Study.', style: 'harvard',
  authorsJson: JSON.stringify(['Asha Sharma', 'Nabin Rai']), year: '2025', title: 'Study',
  doi: '10.1000/test', url: 'https://doi.org/10.1000/test', metadataStatus: 'matched',
  metadataConfidence: 0.96, metadataJson: null, createdAt: '2026-09-01T00:00:00Z', source: null,
}

describe('structured citation insertion', () => {
  it('builds verified metadata with an optional locator', () => {
    expect(structuredCitationForReference(reference, 'p. 14')).toMatchObject({
      referenceId: 'ref-1', author: 'Sharma & Rai', year: '2025', locator: 'p. 14', verified: true,
    })
  })

  it('refuses unverified reference metadata', () => {
    expect(structuredCitationForReference({ ...reference, metadataStatus: 'unverified' })).toBeNull()
  })
})
