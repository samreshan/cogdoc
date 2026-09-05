// @vitest-environment happy-dom

import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { afterEach, describe, expect, it } from 'vitest'
import { DocumentOutlineAnchors } from './document-outline-anchors'

let editor: Editor | null = null

afterEach(() => {
  editor?.destroy()
  editor = null
  document.body.replaceChildren()
})

describe('DocumentOutlineAnchors', () => {
  it('renders headings as stable, non-interactive hyperlink targets', () => {
    const element = document.createElement('div')
    document.body.append(element)
    editor = new Editor({
      element,
      extensions: [StarterKit, DocumentOutlineAnchors],
      content: '<h1>Method</h1><h2>Method</h2>',
    })

    const headings = [...element.querySelectorAll<HTMLElement>('.cogdoc-outline-heading')]
    expect(headings.map((heading) => heading.id)).toEqual(['outline-method', 'outline-method-2'])
    expect(headings[0]).toHaveAttribute('tabindex', '-1')
    expect(headings[0]).not.toHaveAttribute('aria-label')
  })
})
