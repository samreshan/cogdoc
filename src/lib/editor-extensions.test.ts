// @vitest-environment happy-dom

import { Editor } from '@tiptap/core'
import { describe, expect, it } from 'vitest'
import { createEditorExtensions } from './editor-extensions'

describe('createEditorExtensions', () => {
  it('registers the built-in link extension exactly once', () => {
    const editor = new Editor({
      content: '<p><a href="https://example.com">Source</a></p>',
      extensions: createEditorExtensions(),
    })

    const names = editor.extensionManager.extensions.map((extension) => extension.name)
    expect(names.filter((name) => name === 'link')).toHaveLength(1)
    expect(new Set(names).size).toBe(names.length)

    editor.destroy()
  })
})
