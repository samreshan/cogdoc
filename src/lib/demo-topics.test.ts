import { describe, expect, it } from 'vitest'
import { DEMO_TOPICS, DEMO_SOURCE_CATALOG, demoStarterContent, readableDocumentation } from './demo-topics'
import { chunkText } from './retrieval'
describe('demo source preparation', () => {
  it('removes build directives while retaining source prose', () => {
    expect(readableDocumentation('---\ntitle: Service\n---\n<!-- overview -->\nUse {{< glossary_tooltip text="Pods" term_id="pod" >}} &mdash; stable addresses.')).toBe('Use Pods — stable addresses.')
  })
  it('supplies labelled editable writing and valid source mappings for every topic', () => {
    for (const topic of DEMO_TOPICS) {
      const doc = JSON.parse(demoStarterContent(topic))
      expect(doc.type).toBe('doc')
      expect(JSON.stringify(doc)).toContain('DEMO STARTER')
      expect(JSON.stringify(doc)).toContain(topic.draft)
      for (const source of topic.sources) expect(DEMO_SOURCE_CATALOG[source].textUrl).toMatch(/^https:\/\/raw.githubusercontent.com\/kubernetes\/website\//)
    }
  })
  it('bounds huge paragraphs, overlaps context, and retains the ending', () => {
    const text = 'abcdefghij'.repeat(900)
    const chunks = chunkText(text)
    expect(chunks.every((chunk) => chunk.content.length <= 2500)).toBe(true)
    expect(chunks[0].content.slice(-250)).toBe(chunks[1].content.slice(0, 250))
    expect(chunks.at(-1)?.content.endsWith(text.slice(-100))).toBe(true)
  })
})
