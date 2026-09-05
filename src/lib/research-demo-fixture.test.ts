import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const fixture = require('../../scripts/research-demo-fixture.js') as {
  sources: Array<{ key: string; chunks: Array<{ page: number; sourcePage: number; text: string }> }>
  claims: Record<string, string>
  interventions: Array<{ engineType: string; promptText: string; evidence?: Array<{ source: string; chunk: number }> }>
  actions: Array<{ quote: string; factors: { aiAdjustment: number } }>
  buildDocument: (references: Record<string, { id: string; title: string; authors: string[]; year: string }>) => unknown
}

describe('research demo fixture', () => {
  const references = Object.fromEntries(fixture.sources.map((source) => [source.key, {
    id: `reference-${source.key}`,
    title: `Title ${source.key}`,
    authors: ['Demo Author'],
    year: '2026',
  }]))
  const document = JSON.stringify(fixture.buildDocument(references))

  it('reproduces one exactly anchored intervention from every engine', () => {
    expect(new Set(fixture.interventions.map((item) => item.engineType))).toEqual(new Set(['citation', 'interceptor', 'scaffold', 'socratic']))
    for (const intervention of fixture.interventions) expect(document).toContain(intervention.promptText)
  })

  it('keeps all passage evidence resolvable', () => {
    expect(fixture.sources).toHaveLength(3)
    expect(fixture.sources.flatMap((source) => source.chunks)).toHaveLength(9)
    for (const source of fixture.sources) expect(source.chunks.map((chunk) => chunk.page)).toEqual([1, 2, 3])
    for (const intervention of fixture.interventions) {
      for (const evidence of intervention.evidence ?? []) {
        const source = fixture.sources.find((candidate) => candidate.key === evidence.source)
        expect(source?.chunks[evidence.chunk]).toBeDefined()
      }
    }
  })

  it('anchors every ranked action and bounds the AI adjustment', () => {
    for (const action of fixture.actions) {
      expect(document).toContain(action.quote)
      expect(Math.abs(action.factors.aiAdjustment)).toBeLessThanOrEqual(5)
    }
  })

  it('inserts only supplied verified reference identifiers', () => {
    for (const reference of Object.values(references)) expect(document).toContain(reference.id)
    expect(document).toContain('structuredCitation')
  })
})
