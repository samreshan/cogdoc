import { describe, expect, it } from 'vitest'
import { canonicalizeSourceUrl, contentDigest, normalizeDoi } from './research-source'

describe('research source identity', () => {
  it('normalizes DOI and canonical URLs for private-library deduplication', () => {
    expect(normalizeDoi('https://doi.org/10.1000/ABC')).toBe('10.1000/abc')
    expect(canonicalizeSourceUrl('https://EXAMPLE.com/paper/?utm_source=x&id=2#part')).toBe('https://example.com/paper?id=2')
  })
  it('uses stable content hashes', () => expect(contentDigest('same')).toBe(contentDigest(Buffer.from('same'))))
})
