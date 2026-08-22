import { Schema } from '@tiptap/pm/model'
import { describe, expect, it } from 'vitest'
import { styleReviewBlocksForScope } from '@/lib/style-review-editor'

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { content: 'text*', group: 'block' },
    heading: { content: 'text*', group: 'block' },
    blockquote: { content: 'text*', group: 'block' },
    codeBlock: { content: 'text*', group: 'block' },
    text: { group: 'inline' },
  },
})

const text = (value: string) => schema.text(value)
const paragraph = (value: string) => schema.nodes.paragraph.create(null, text(value))
const heading = (value: string) => schema.nodes.heading.create(null, text(value))

describe('styleReviewBlocksForScope', () => {
  it('maps document text blocks to selectable ProseMirror ranges and protects bibliography content', () => {
    const doc = schema.nodes.doc.create(null, [
      paragraph('A clear opening.'),
      heading('References'),
      paragraph('Smith, J. (2024). In order to understand evidence.'),
    ])

    expect(styleReviewBlocksForScope(doc, { from: 1, to: 1 }, 'document')).toEqual([
      { text: 'A clear opening.', from: 1, to: 17, nodeType: 'paragraph', isProtected: false },
      { text: 'References', from: 19, to: 29, nodeType: 'heading', isProtected: true },
      { text: 'Smith, J. (2024). In order to understand evidence.', from: 31, to: 81, nodeType: 'paragraph', isProtected: true },
    ])
  })

  it('clips selected text while preserving the exact selectable range', () => {
    const doc = schema.nodes.doc.create(null, [paragraph('In order to evaluate the prototype.')])

    expect(styleReviewBlocksForScope(doc, { from: 1, to: 12 }, 'selection')).toEqual([
      { text: 'In order to', from: 1, to: 12, nodeType: 'paragraph', isProtected: false },
    ])
  })

  it('returns only the active paragraph for paragraph scope', () => {
    const doc = schema.nodes.doc.create(null, [paragraph('First paragraph.'), paragraph('Second paragraph.')])

    expect(styleReviewBlocksForScope(doc, { from: 20, to: 20 }, 'paragraph')).toEqual([
      { text: 'Second paragraph.', from: 19, to: 36, nodeType: 'paragraph', isProtected: false },
    ])
  })
})
