import { describe, expect, it } from 'vitest'
import { Schema } from '@tiptap/pm/model'
import { buildReviewItemDecorations, reviewItemUnderlineStyle } from './review-item-highlight'

const schema = new Schema({
  nodes: {
    doc: { content: 'paragraph+' },
    paragraph: { content: 'text*' },
    text: { group: 'inline' },
  },
})

function documentWith(text: string) {
  return schema.node('doc', null, [schema.node('paragraph', null, schema.text(text))])
}

describe('ReviewItemHighlight', () => {
  it('underlines each unique review anchor at its exact editor range', () => {
    const doc = documentWith('Opening context. The cited claim needs a source. Closing context.')
    const decorations = buildReviewItemDecorations(doc, [
      'The cited claim needs a source.',
      'The cited claim needs a source.',
    ]).find()

    expect(decorations).toHaveLength(1)
    expect(decorations[0]).toMatchObject({ from: 18, to: 49 })
    expect(decorations[0].type.attrs).toMatchObject({ role: 'button', tabindex: '0' })
  })

  it('ignores missing and very short anchors', () => {
    const decorations = buildReviewItemDecorations(documentWith('A complete paragraph of draft text.'), ['text', 'Not in this document.']).find()
    expect(decorations).toHaveLength(0)
  })

  it('uses a visible but non-destructive review underline treatment', () => {
    expect(reviewItemUnderlineStyle).toContain('underline wavy #a16207')
    expect(reviewItemUnderlineStyle).toContain('background: #fef3c7')
  })
})
