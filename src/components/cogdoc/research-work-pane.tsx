'use client'

import type { Ref } from 'react'
import EditorTiptap, { type DocumentEditorHandle, type DocumentEditorSelection } from './editor-tiptap'

interface ResearchWorkPaneProps {
  editorRef: Ref<DocumentEditorHandle>
  onSelectionChange: (selection: DocumentEditorSelection | null) => void
  onOpenSources: (selection: DocumentEditorSelection | null) => void
  onOpenCollaborator: (selection: DocumentEditorSelection | null) => void
}

export default function ResearchWorkPane({ editorRef, onSelectionChange, onOpenSources, onOpenCollaborator }: ResearchWorkPaneProps) {
  return <main id="main-content" className="h-full min-h-0 min-w-0 bg-[var(--cog-workspace)]" aria-label="Working document">
    <EditorTiptap ref={editorRef} onSelectionChange={onSelectionChange} onOpenSources={onOpenSources} onOpenCollaborator={onOpenCollaborator} />
  </main>
}
