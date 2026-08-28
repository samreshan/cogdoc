// @vitest-environment happy-dom

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Editor } from '@tiptap/core'
import EditorToolbar from './editor-toolbar'

function fakeEditor() {
  const calls: string[] = []
  const chain: Record<string, (...args: unknown[]) => unknown> = {}
  for (const command of [
    'focus', 'setParagraph', 'toggleHeading', 'toggleBold', 'toggleItalic',
    'toggleStrike', 'toggleCode', 'toggleBulletList', 'toggleOrderedList',
    'toggleBlockquote', 'setHorizontalRule', 'insertTable', 'unsetAllMarks',
    'clearNodes', 'undo', 'redo',
  ]) {
    chain[command] = (..._args: unknown[]) => {
      calls.push(command)
      return chain
    }
  }
  chain.run = () => true
  const editor = {
    chain: () => chain,
    can: () => ({ chain: () => chain }),
    isActive: () => false,
  } as unknown as Editor
  return { editor, calls }
}

describe('EditorToolbar', () => {
  it('keeps source search disabled until the author selects a useful passage', () => {
    const { editor } = fakeEditor()
    const onFindSources = vi.fn()
    const { rerender } = render(<EditorToolbar editor={editor} selectedText="short" onFindSources={onFindSources} />)
    expect(screen.getByRole('button', { name: 'Find sources' })).toBeDisabled()

    rerender(<EditorToolbar editor={editor} selectedText="A selected research claim" onFindSources={onFindSources} />)
    fireEvent.click(screen.getByRole('button', { name: 'Find sources' }))
    expect(onFindSources).toHaveBeenCalledOnce()
  })

  it('runs visible formatting commands without replacing editor text', () => {
    const { editor, calls } = fakeEditor()
    render(<EditorToolbar editor={editor} selectedText="" onFindSources={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: 'Bold' }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Text style' }), { target: { value: 'heading-2' } })

    expect(calls).toContain('toggleBold')
    expect(calls).toContain('toggleHeading')
  })
})
