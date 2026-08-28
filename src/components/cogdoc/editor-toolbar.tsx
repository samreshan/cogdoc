'use client'

import type { Editor } from '@tiptap/core'
import {
  Bold,
  Code2,
  Eraser,
  Italic,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Search,
  Strikethrough,
  Table2,
  Undo2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface EditorToolbarProps {
  editor: Editor
  selectedText: string
  onFindSources: () => void
}

interface ToolButtonProps {
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}

function ToolButton({ label, active = false, disabled = false, onClick, children }: ToolButtonProps) {
  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      aria-label={label}
      aria-pressed={active || undefined}
      title={label}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`h-8 w-8 shrink-0 rounded-md transition-all active:translate-y-px ${active ? 'bg-[#e4ece7] text-[#173f35] hover:bg-[#d7e4dc]' : 'text-stone-500 hover:bg-stone-100 hover:text-stone-900'}`}
    >
      {children}
    </Button>
  )
}

function currentBlock(editor: Editor): string {
  if (editor.isActive('heading', { level: 1 })) return 'heading-1'
  if (editor.isActive('heading', { level: 2 })) return 'heading-2'
  if (editor.isActive('heading', { level: 3 })) return 'heading-3'
  return 'paragraph'
}

export default function EditorToolbar({ editor, selectedText, onFindSources }: EditorToolbarProps) {
  const hasResearchSelection = selectedText.trim().length >= 10

  function setBlock(value: string) {
    if (value === 'paragraph') editor.chain().focus().setParagraph().run()
    if (value === 'heading-1') editor.chain().focus().toggleHeading({ level: 1 }).run()
    if (value === 'heading-2') editor.chain().focus().toggleHeading({ level: 2 }).run()
    if (value === 'heading-3') editor.chain().focus().toggleHeading({ level: 3 }).run()
  }

  return (
    <nav className="flex min-h-11 items-center gap-1 overflow-x-auto border-b border-stone-200/80 bg-[#fffefb] px-4 py-1.5" aria-label="Document formatting">
      <select
        value={currentBlock(editor)}
        onChange={(event) => setBlock(event.target.value)}
        aria-label="Text style"
        className="h-8 w-[7.5rem] shrink-0 rounded-md border border-stone-200 bg-white px-2 text-xs font-medium text-stone-700 outline-none transition-colors hover:border-stone-300 focus:border-[#386c5c] focus:ring-2 focus:ring-[#386c5c]/15"
      >
        <option value="paragraph">Paragraph</option>
        <option value="heading-1">Heading 1</option>
        <option value="heading-2">Heading 2</option>
        <option value="heading-3">Heading 3</option>
      </select>

      <div className="mx-1 h-5 w-px shrink-0 bg-stone-200" />
      <ToolButton label="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="h-3.5 w-3.5" /></ToolButton>
      <ToolButton label="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="h-3.5 w-3.5" /></ToolButton>
      <ToolButton label="Strikethrough" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough className="h-3.5 w-3.5" /></ToolButton>
      <ToolButton label="Inline code" active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()}><Code2 className="h-3.5 w-3.5" /></ToolButton>

      <div className="mx-1 h-5 w-px shrink-0 bg-stone-200" />
      <ToolButton label="Bulleted list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="h-3.5 w-3.5" /></ToolButton>
      <ToolButton label="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="h-3.5 w-3.5" /></ToolButton>
      <ToolButton label="Block quote" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote className="h-3.5 w-3.5" /></ToolButton>
      <ToolButton label="Insert divider" onClick={() => editor.chain().focus().setHorizontalRule().run()}><Minus className="h-3.5 w-3.5" /></ToolButton>
      <ToolButton label="Insert table" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><Table2 className="h-3.5 w-3.5" /></ToolButton>

      <div className="mx-1 h-5 w-px shrink-0 bg-stone-200" />
      <ToolButton label="Clear formatting" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}><Eraser className="h-3.5 w-3.5" /></ToolButton>
      <ToolButton label="Undo" disabled={!editor.can().chain().focus().undo().run()} onClick={() => editor.chain().focus().undo().run()}><Undo2 className="h-3.5 w-3.5" /></ToolButton>
      <ToolButton label="Redo" disabled={!editor.can().chain().focus().redo().run()} onClick={() => editor.chain().focus().redo().run()}><Redo2 className="h-3.5 w-3.5" /></ToolButton>

      <div className="ml-auto flex shrink-0 items-center gap-2 pl-2">
        {selectedText && <span className="hidden max-w-44 truncate font-serif text-[11px] italic text-stone-500 xl:block">“{selectedText}”</span>}
        <Button
          type="button"
          size="sm"
          onMouseDown={(event) => event.preventDefault()}
          onClick={onFindSources}
          disabled={!hasResearchSelection}
          title={hasResearchSelection ? 'Search for sources about the selected passage' : 'Select at least 10 characters to find sources'}
          className="h-8 shrink-0 rounded-md bg-[#173f35] px-3 text-xs hover:bg-[#245548] active:translate-y-px"
        >
          <Search className="mr-1.5 h-3.5 w-3.5" />Find sources
        </Button>
      </div>
    </nav>
  )
}
