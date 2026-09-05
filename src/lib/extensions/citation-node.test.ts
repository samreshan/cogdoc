// @vitest-environment happy-dom
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { describe, expect, it } from 'vitest'
import { StructuredCitation } from './citation-node'

describe('structured citation node', () => {
  it('inserts verified metadata only and participates in undo/redo', () => {
    const editor = new Editor({ extensions: [StarterKit, StructuredCitation], content: '<p>Evidence </p>' })
    editor.commands.setTextSelection(9)
    editor.commands.insertCitation({ referenceId: 'r1', title: 'Study', author: 'Chen', year: '2025', locator: 'p. 14', verified: true, metadataVersion: 'v1' })
    expect(editor.getText()).toContain('(Chen, 2025, p. 14)')
    expect(editor.getJSON().content?.[0].content?.some((node) => node.type === 'structuredCitation')).toBe(true)
    editor.commands.undo()
    expect(editor.getText()).not.toContain('Chen')
    editor.commands.redo()
    expect(editor.getText()).toContain('Chen')
    editor.destroy()
  })
})
