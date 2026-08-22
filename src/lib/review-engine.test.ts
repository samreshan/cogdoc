import { describe, expect, it } from 'vitest'
import { generateReview, parseCitations, parseReferences } from '@/lib/review-engine'

describe('academic review engine', () => {
  it('pairs grouped and narrative Harvard citations with references', () => {
    const text = `Prior work supports the finding (Sharma, 2024, p. 7; Rai & Lim, 2023). Sharma (2024) also reports the result.

References
Sharma, A. (2024). Student verification practices. Journal of Learning. https://doi.org/10.1234/example
Rai, P. and Lim, T. (2023). Evidence-centred writing. Academic Press.`
    expect(parseCitations(text)).toHaveLength(3)
    expect(parseReferences(text)).toHaveLength(2)
    expect(generateReview(text).items.some((item) => item.type === 'citation_missing_reference')).toBe(false)
  })

  it('keeps an unmatched citation and high-risk evidence gap blocking', () => {
    const review = generateReview(`The intervention causes a 40% improvement (Missing, 2025).

References
Known, A. (2024). A different source. Journal.`)
    expect(review.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'citation_missing_reference', blocksCertification: true }),
      expect.objectContaining({ type: 'evidence_passage_required', blocksCertification: true }),
    ]))
  })

  it('requires a locator for a direct quotation', () => {
    const review = generateReview(`The paper states “verification changes student behaviour” (Sharma, 2024).

References
Sharma, A. (2024). Student verification practices. Journal.`)
    expect(review.items).toContainEqual(expect.objectContaining({ type: 'quotation_locator_missing', severity: 'critical' }))
  })

  it('creates three to five comprehension checks for a long reviewable document', () => {
    const claims = Array.from({ length: 6 }, (_, index) =>
      `Study evidence ${index} reports that students changed verification behaviour after repeated practice (Sharma, 2024).`,
    ).join(' ') + ` ${'Context words '.repeat(260)}\n\nReferences\nSharma, A. (2024). Student verification practices. Journal.`
    const checks = generateReview(claims).items.filter((item) => item.type === 'comprehension_check')
    expect(checks.length).toBeGreaterThanOrEqual(3)
    expect(checks.length).toBeLessThanOrEqual(5)
  })
})
