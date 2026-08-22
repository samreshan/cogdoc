/** Deterministic first-pass academic review. LLM/RAG enrichment happens later. */

export interface ParsedReference {
  rawText: string
  authors: string[]
  year: string | null
  title: string | null
  doi: string | null
  key: string
}

export interface ParsedCitation {
  rawText: string
  authors: string[]
  year: string | null
  locator: string | null
  sentence: string
  start: number
  end: number
  key: string
}

export interface ParsedClaim {
  text: string
  start: number
  end: number
  riskCategory: 'quotation' | 'numeric' | 'causal' | 'empirical' | 'general'
  central: boolean
}

export interface GeneratedReviewItem {
  type: string
  severity: 'critical' | 'advisory'
  title: string
  detail: string
  blocksCertification: boolean
  anchor: { start: number; end: number; quote: string } | null
  evidence: Record<string, unknown>
}

const YEAR = '(?:19|20)\\d{2}[a-z]?'

function normalizeSurname(value: string): string {
  return value.toLowerCase().replace(/et\s+al\.?/g, '').replace(/[^a-z]/g, '')
}

function citationKey(authors: string[], year: string | null): string {
  return `${normalizeSurname(authors[0] ?? '')}:${(year ?? '').toLowerCase()}`
}

function extractAuthors(raw: string): string[] {
  const beforeYear = raw.split(new RegExp(`\\b${YEAR}\\b`, 'i'))[0] ?? raw
  return beforeYear
    .replace(/[()]/g, '')
    .split(/\s*(?:,|&|\band\b)\s*/i)
    .map((part) => part.trim().split(/\s+/).filter(Boolean).at(-1) ?? '')
    .filter((part) => part && !/^(et|al)$/i.test(part))
}

export function splitDocumentAndReferences(text: string): { body: string; referenceLines: string[] } {
  const lines = text.split('\n')
  const headingIndex = lines.findIndex((line) => /^\s*(references|bibliography|works cited)\s*$/i.test(line))
  if (headingIndex < 0) return { body: text, referenceLines: [] }
  return {
    body: lines.slice(0, headingIndex).join('\n').trim(),
    referenceLines: lines.slice(headingIndex + 1).map((line) => line.trim()).filter(Boolean),
  }
}

export function parseReferences(text: string): ParsedReference[] {
  const { referenceLines } = splitDocumentAndReferences(text)
  return referenceLines.map((rawText) => {
    const year = rawText.match(new RegExp(`\\b(${YEAR})\\b`, 'i'))?.[1] ?? null
    const authors = extractAuthors(rawText)
    const doi = rawText.match(/10\.\d{4,9}\/[\w.()/:;-]+/i)?.[0].replace(/[.,;]+$/, '') ?? null
    const afterYear = year ? rawText.slice((rawText.indexOf(year) + year.length)).replace(/^[).,\s]+/, '') : ''
    const title = afterYear.split(/\.\s+/)[0]?.trim() || null
    return { rawText, authors, year, title, doi, key: citationKey(authors, year) }
  })
}

function sentenceAt(text: string, index: number): { text: string; start: number; end: number } {
  const left = Math.max(text.lastIndexOf('.', index - 1), text.lastIndexOf('?', index - 1), text.lastIndexOf('!', index - 1), text.lastIndexOf('\n', index - 1)) + 1
  const rightCandidates = [text.indexOf('.', index), text.indexOf('?', index), text.indexOf('!', index), text.indexOf('\n', index)].filter((n) => n >= 0)
  const right = rightCandidates.length ? Math.min(...rightCandidates) + 1 : text.length
  return { text: text.slice(left, right).trim(), start: left, end: right }
}

export function parseCitations(text: string): ParsedCitation[] {
  const { body } = splitDocumentAndReferences(text)
  const found: ParsedCitation[] = []
  const seen = new Set<string>()
  const parenthetical = /\(([^()]*?\b(?:19|20)\d{2}[a-z]?[^()]*)\)/gi
  for (const match of body.matchAll(parenthetical)) {
    const wholeStart = match.index ?? 0
    // A bare year belongs to a narrative citation (e.g. Sharma (2024)); the
    // narrative pass below captures the author and year together.
    if (new RegExp(`^\\s*${YEAR}\\s*$`, 'i').test(match[1] ?? '')) continue
    const parts = (match[1] ?? '').split(/\s*;\s*/)
    let offset = 1
    for (const part of parts) {
      const year = part.match(new RegExp(`\\b(${YEAR})\\b`, 'i'))?.[1] ?? null
      if (!year) continue
      const authors = extractAuthors(part)
      const locator = part.match(/(?:p{1,2}\.|para\.)\s*([\d–-]+)/i)?.[0] ?? null
      const sentence = sentenceAt(body, wholeStart)
      const start = wholeStart + offset
      const id = `${start}:${part}`
      if (!seen.has(id)) {
        found.push({ rawText: part, authors, year, locator, sentence: sentence.text, start, end: start + part.length, key: citationKey(authors, year) })
        seen.add(id)
      }
      offset += part.length + 1
    }
  }

  const narrative = new RegExp(`\\b([A-Z][A-Za-z’'-]+(?:\\s+(?:and|&)\\s+[A-Z][A-Za-z’'-]+|\\s+et\\s+al\\.)?)\\s+\\((${YEAR})\\)`, 'g')
  for (const match of body.matchAll(narrative)) {
    const start = match.index ?? 0
    const id = `${start}:${match[0]}`
    if (seen.has(id)) continue
    const authors = extractAuthors(`${match[1]} ${match[2]}`)
    const sentence = sentenceAt(body, start)
    found.push({ rawText: match[0], authors, year: match[2], locator: null, sentence: sentence.text, start, end: start + match[0].length, key: citationKey(authors, match[2]) })
    seen.add(id)
  }
  return found.sort((a, b) => a.start - b.start)
}

export function extractClaims(text: string): ParsedClaim[] {
  const { body } = splitDocumentAndReferences(text)
  const matches = body.matchAll(/[^.!?\n]+[.!?]?/g)
  const claims: ParsedClaim[] = []
  for (const match of matches) {
    const raw = match[0]?.trim() ?? ''
    if (raw.split(/\s+/).length < 6) continue
    let riskCategory: ParsedClaim['riskCategory'] = 'general'
    if (/[“"][^”"]+[”"]/.test(raw)) riskCategory = 'quotation'
    else if (/\b\d+(?:\.\d+)?%|\b(?:p|n)\s*[=<]\s*0?\.\d+/i.test(raw)) riskCategory = 'numeric'
    else if (/\b(?:causes?|leads? to|results? in|because of|therefore)\b/i.test(raw)) riskCategory = 'causal'
    else if (/\b(?:research|stud(?:y|ies)|evidence|data|participants|findings?)\b/i.test(raw)) riskCategory = 'empirical'
    if (riskCategory === 'general' && !/\([^)]*(?:19|20)\d{2}/.test(raw)) continue
    const start = match.index ?? 0
    claims.push({ text: raw, start, end: start + raw.length, riskCategory, central: claims.length === 0 })
  }
  return claims
}

export function generateReview(text: string, requirements: string[] = []): {
  references: ParsedReference[]
  citations: ParsedCitation[]
  claims: ParsedClaim[]
  items: GeneratedReviewItem[]
} {
  const references = parseReferences(text)
  const citations = parseCitations(text)
  const claims = extractClaims(text)
  const items: GeneratedReviewItem[] = []
  const referenceByKey = new Map(references.map((reference) => [reference.key, reference]))
  const citedKeys = new Set(citations.map((citation) => citation.key))

  for (const citation of citations) {
    if (!referenceByKey.has(citation.key)) {
      items.push({
        type: 'citation_missing_reference', severity: 'critical', blocksCertification: true,
        title: 'Citation has no matching reference',
        detail: `“${citation.rawText}” could not be paired with the bibliography. Add or correct the reference before verification.`,
        anchor: { start: citation.start, end: citation.end, quote: citation.rawText },
        evidence: { citation },
      })
    }
  }

  for (const reference of references) {
    if (!citedKeys.has(reference.key)) {
      items.push({
        type: 'reference_not_cited', severity: 'advisory', blocksCertification: false,
        title: 'Reference is not cited in the document',
        detail: 'Confirm that this source belongs in the bibliography or cite it where it informs the argument.',
        anchor: null, evidence: { reference },
      })
    }
  }

  for (const claim of claims) {
    const hasCitation = citations.some((citation) => citation.start >= claim.start && citation.start <= claim.end)
    if (!hasCitation && ['quotation', 'numeric', 'causal', 'empirical'].includes(claim.riskCategory)) {
      const critical = claim.riskCategory === 'quotation' || claim.riskCategory === 'numeric' || claim.riskCategory === 'causal'
      items.push({
        type: 'claim_needs_evidence', severity: critical ? 'critical' : 'advisory', blocksCertification: critical,
        title: critical ? 'High-risk claim needs evidence' : 'Claim may need evidence',
        detail: `This ${claim.riskCategory} claim has no linked citation. Add a source, narrow the claim, or explain why evidence is unavailable.`,
        anchor: { start: claim.start, end: claim.end, quote: claim.text }, evidence: { claim },
      })
    }
    if (hasCitation && (claim.central || ['quotation', 'numeric', 'causal'].includes(claim.riskCategory))) {
      items.push({
        type: 'evidence_passage_required', severity: 'critical', blocksCertification: true,
        title: 'Link the passage that supports this claim',
        detail: 'A bibliography match is not evidence. Confirm a passage from an uploaded source, or an exact range from the captured code snapshot.',
        anchor: { start: claim.start, end: claim.end, quote: claim.text }, evidence: { claim },
      })
    }
    if (claim.riskCategory === 'quotation') {
      const linkedCitations = citations.filter((citation) => citation.start >= claim.start && citation.start <= claim.end)
      if (linkedCitations.length && linkedCitations.every((citation) => !citation.locator)) {
        items.push({
          type: 'quotation_locator_missing', severity: 'critical', blocksCertification: true,
          title: 'Direct quotation needs a page or paragraph locator',
          detail: 'Add the precise page, paragraph, or section locator required by the selected citation style, then recheck this block.',
          anchor: { start: claim.start, end: claim.end, quote: claim.text }, evidence: { claim, citations: linkedCitations },
        })
      }
    }
  }

  for (const requirement of requirements) {
    const terms = requirement.toLowerCase().split(/\W+/).filter((term) => term.length > 4)
    if (terms.length && !terms.some((term) => text.toLowerCase().includes(term))) {
      items.push({
        type: 'rubric_gap', severity: 'advisory', blocksCertification: false,
        title: 'Requirement may not be addressed', detail: requirement,
        anchor: null, evidence: { requirement },
      })
    }
  }

  const wordCount = text.split(/\s+/).filter(Boolean).length
  const sampleCount = wordCount > 500 ? Math.min(5, Math.max(3, Math.ceil(wordCount / 1000))) : wordCount >= 120 ? 1 : 0
  const samplePool = [
    ...claims.filter((claim) => claim.riskCategory !== 'general'),
    ...claims.filter((claim) => claim.riskCategory === 'general'),
  ].filter((claim, index, all) => all.findIndex((candidate) => candidate.start === claim.start) === index)
  for (const claim of samplePool.slice(0, sampleCount)) {
    items.push({
      type: 'comprehension_check', severity: 'critical', blocksCertification: true,
      title: 'Explain why this evidence supports your claim',
      detail: 'Answer in your own words. Cogdoc records the response but does not write it into the assignment.',
      anchor: { start: claim.start, end: claim.end, quote: claim.text }, evidence: { claim },
    })
  }

  if (!references.length && citations.length) {
    items.unshift({
      type: 'bibliography_missing', severity: 'critical', blocksCertification: true,
      title: 'Bibliography not found', detail: 'Cogdoc found in-text citations but no References or Bibliography section.',
      anchor: null, evidence: { citationCount: citations.length },
    })
  }

  return { references, citations, claims, items }
}
