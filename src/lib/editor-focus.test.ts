import { Schema } from '@tiptap/pm/model'
import { describe, expect, it } from 'vitest'
import { findEditorTextRange } from '@/lib/editor-focus'

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { content: 'text*', group: 'block' },
    text: { group: 'inline' },
  },
})

const paragraph = (...parts: string[]) => schema.nodes.paragraph.create(null, parts.map((part) => schema.text(part)))

describe('findEditorTextRange', () => {
  it('returns the exact selectable range for text in a long document', () => {
    const doc = schema.nodes.doc.create(null, [
      paragraph('Opening context.'),
      paragraph('The claim that needs attention appears in this paragraph.'),
    ])

    expect(findEditorTextRange(doc, 'The claim that needs attention')).toEqual({ from: 19, to: 49 })
  })

  it('matches text split across ProseMirror text nodes', () => {
    const doc = schema.nodes.doc.create(null, [paragraph('This claim ', 'continues across formatting.')])

    expect(findEditorTextRange(doc, 'claim continues')).toEqual({ from: 6, to: 21 })
  })

  it('matches whitespace-insensitively when an imported document changes spacing', () => {
    const doc = schema.nodes.doc.create(null, [paragraph('Evidence   needs careful interpretation.')])

    expect(findEditorTextRange(doc, 'Evidence needs careful interpretation.')).toEqual({ from: 1, to: 41 })
  })

  it('returns null when the reviewed passage is no longer in the draft', () => {
    const doc = schema.nodes.doc.create(null, [paragraph('A different draft.')])

    expect(findEditorTextRange(doc, 'Missing passage')).toBeNull()
  })
})
