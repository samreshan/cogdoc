// @vitest-environment happy-dom

import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { afterEach, describe, expect, it } from 'vitest'
import type { Intervention } from '@/lib/types'
import { InterventionHighlight, interventionHighlightKey } from '@/lib/extensions/intervention-highlight'

const intervention: Intervention = {
  id: 'intervention-1',
  userId: 'user-1',
  projectId: 'project-1',
  paragraphId: null,
  promptTemplateTag: null,
  engineType: 'citation',
  promptText: 'This claim needs supporting evidence.',
  responseText: 'Check the strength of the source support.',
  verdict: null,
  status: 'active',
  userAction: null,
  createdAt: '2026-08-28T00:00:00.000Z',
  resolvedAt: null,
}

let editor: Editor | null = null

afterEach(() => {
  editor?.destroy()
  editor = null
  document.body.replaceChildren()
})

describe('InterventionHighlight accessibility', () => {
  it('renders matched underlines as labelled keyboard-focusable controls', () => {
    const element = document.createElement('div')
    document.body.append(element)
    editor = new Editor({
      element,
      extensions: [StarterKit, InterventionHighlight],
      content: '<p>This claim needs supporting evidence.</p>',
    })

    editor.view.dispatch(editor.state.tr.setMeta(interventionHighlightKey, [intervention]))

    const mark = element.querySelector<HTMLElement>('.cogdoc-mark')
    expect(mark).not.toBeNull()
    expect(mark).toHaveAttribute('role', 'button')
    expect(mark).toHaveAttribute('tabindex', '0')
    expect(mark).toHaveAttribute('aria-label', 'Review 1 intervention for this passage')
    expect(mark).toHaveAttribute('data-intervention-ids', 'intervention-1')
  })
})
