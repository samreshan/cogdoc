import { describe, expect, it } from 'vitest'
import { documentOutlineFromStoredContent } from './document-outline'

describe('document outline permalinks', () => {
  it('creates stable readable links and disambiguates duplicate headings', () => {
    const content = JSON.stringify({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Research Question' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Draft text.' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Research Question' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Evidence & Limits' }] },
      ],
    })

    expect(documentOutlineFromStoredContent(content)).toEqual([
      { id: 'outline-research-question', label: 'Research Question', level: 1 },
      { id: 'outline-research-question-2', label: 'Research Question', level: 2 },
      { id: 'outline-evidence-limits', label: 'Evidence & Limits', level: 2 },
    ])
  })

  it('returns an empty outline for legacy or malformed content', () => {
    expect(documentOutlineFromStoredContent('<h1>Legacy heading</h1>')).toEqual([])
  })
})
