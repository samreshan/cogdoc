'use client'

/**
 * The Cogdoc writing surface — Tiptap/ProseMirror (ADR-0006 close-out).
 *
 * This is THE editor (the legacy contentEditable surface is gone; ADR-0006):
 *  - autosave (debounced 1.5s) serialises via editor.getJSON() → Document.content
 *    (ADR-0009: stored JSON is parsed back on load; legacy HTML still parses)
 *  - engine-firing on sentence-end (. ? !) and on paragraph completion (Enter)
 *  - idle trigger via the IdleDetector at the friction-scaled 45s (IR §2.3.6)
 *  - intervention highlights + hover popovers over the marked sentences
 *  - Devil's Autocomplete ghost-text (§7.1) + Blindspot Monitor (§7.2)
 *  - friction-aware cooldowns (§9) via the shared useEngineFiring hook
 *
 * Orchestration policy lives in src/lib/use-engine-firing.ts and
 * src/lib/editor-orchestration.ts; this component is wiring + presentation.
 */
import { useEditor, EditorContent } from '@tiptap/react'
import { forwardRef, useEffect, useRef, useCallback, useImperativeHandle, useState } from 'react'
import { useCogdoc } from '@/lib/store'
import { api } from '@/lib/api-client'
import {
  serializeForSave,
  parseStoredContent,
} from '@/lib/editor-orchestration'
import {
  interventionHighlightKey,
} from '@/lib/extensions/intervention-highlight'
import {
  reviewItemHighlightKey,
} from '@/lib/extensions/review-item-highlight'
import { researchActionHighlightKey } from '@/lib/extensions/research-action-highlight'
import { Button } from '@/components/ui/button'
import { Loader2, Clock, Check } from 'lucide-react'
import { toast } from 'sonner'
import SentencePopover from './sentence-popover'
import { ApiError } from '@/lib/api-client'
import { clearRecoveryDraft, loadRecoveryDraft, saveRecoveryDraft } from '@/lib/draft-recovery'
import { findEditorTextRange } from '@/lib/editor-focus'
import EditorToolbar from './editor-toolbar'
import { createEditorExtensions } from '@/lib/editor-extensions'
import type { StructuredCitationAttrs } from '@/lib/extensions/citation-node'
import { fingerprintDocumentText } from '@/lib/document-selection'

export interface DocumentEditorSelection {
  text: string
  textFingerprint: string
  documentRevision: number
  selectionId: string
  from: number
  to: number
}

export interface DocumentEditorApplyRequest {
  replacement: string
  expectedDocumentRevision: number
  expectedSelectionId?: string
}

export interface DocumentEditorHandle {
  applyDocumentRevision: (request: DocumentEditorApplyRequest) => { applied: boolean; reason?: 'stale_selection' | 'stale_revision' | 'rejected' }
  focus: () => void
}

interface EditorTiptapProps {
  onSelectionChange?: (selection: DocumentEditorSelection | null) => void
  onOpenSources?: (selection: DocumentEditorSelection | null) => void
  onOpenCollaborator?: (selection: DocumentEditorSelection | null) => void
}

function selectionIdentity(projectId: string, documentId: string, revision: number, from: number, to: number, fingerprint: string) {
  return [projectId, documentId, revision, from, to, fingerprint].join(':')
}

const EditorTiptap = forwardRef<DocumentEditorHandle, EditorTiptapProps>(function EditorTiptap({ onSelectionChange, onOpenSources, onOpenCollaborator }, ref) {
  const project = useCogdoc((s) => s.activeProject)
  const updateActiveProjectContent = useCogdoc((s) => s.updateActiveProjectContent)
  const activeInterventions = useCogdoc((s) => s.activeInterventions)
  const focusMode = useCogdoc((s) => s.focusMode)
  const setHovered = useCogdoc((s) => s.setHovered)
  const editorFocusQuote = useCogdoc((s) => s.editorFocusQuote)
  const clearEditorFocus = useCogdoc((s) => s.clearEditorFocus)
  const reviewHighlightQuotes = useCogdoc((s) => s.reviewHighlightQuotes)
  const researchActions = useCogdoc((s) => s.researchActions)
  const editorOutlineTarget = useCogdoc((s) => s.editorOutlineTarget)
  const clearEditorOutlineFocus = useCogdoc((s) => s.clearEditorOutlineFocus)
  const editorSelectionBookmark = useCogdoc((s) => s.editorSelectionBookmark)
  const setEditorSelectionBookmark = useCogdoc((s) => s.setEditorSelectionBookmark)
  const pendingCitation = useCogdoc((s) => s.pendingCitation)
  const clearPendingCitation = useCogdoc((s) => s.clearPendingCitation)
  const setSourceMapperQuery = useCogdoc((s) => s.setSourceMapperQuery)

  const [selectedText, setSelectedText] = useState('')
  const [, setToolbarVersion] = useState(0)
  const [wordCount, setWordCount] = useState(0)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'offline' | 'recovering' | 'conflict'>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(
    project?.document?.lastSaved ?? null,
  )

  const saveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const revisionRef = useRef(project?.document?.revision ?? 0)
  const selectionPublishTokenRef = useRef(0)
  const publishedSelectionRef = useRef<DocumentEditorSelection | null>(null)
  const [conflict, setConflict] = useState<{ serverRevision: number; serverContent: string } | null>(null)

  const editor = useEditor({
    extensions: createEditorExtensions(),
    immediatelyRender: true,
    content: parseStoredContent(project?.document?.content),
    editorProps: {
      attributes: {
        class: 'tiptap-editor outline-none',
        'data-placeholder':
          'Begin your draft. Select any passage when you want to explain it, find evidence, or ask CogDoc for help.',
      },
    },
  })

  const publishSelection = useCallback(async () => {
    if (!editor || !project?.document) return
    const token = ++selectionPublishTokenRef.current
    const { from, to } = editor.state.selection
    const text = from === to ? '' : editor.state.doc.textBetween(from, to, ' ').trim().slice(0, 2_000)
    setEditorSelectionBookmark({ from, to })
    setSelectedText(text)
    setToolbarVersion((version) => version + 1)
    if (!text) {
      publishedSelectionRef.current = null
      onSelectionChange?.(null)
      return
    }
    const fingerprint = await fingerprintDocumentText(text)
    if (token !== selectionPublishTokenRef.current || !editor || revisionRef.current < 0) return
    const current = editor.state.selection
    const currentText = current.from === current.to ? '' : editor.state.doc.textBetween(current.from, current.to, ' ').trim().slice(0, 2_000)
    if (current.from !== from || current.to !== to || currentText !== text) return
    const selection: DocumentEditorSelection = {
      text,
      textFingerprint: fingerprint,
      documentRevision: revisionRef.current,
      selectionId: selectionIdentity(project.id, project.document.id, revisionRef.current, from, to, fingerprint),
      from,
      to,
    }
    publishedSelectionRef.current = selection
    onSelectionChange?.(selection)
  }, [editor, onSelectionChange, project, setEditorSelectionBookmark])

  useImperativeHandle(ref, () => ({
    applyDocumentRevision(request) {
      if (!editor || !project?.document || !request.replacement.trim()) return { applied: false, reason: 'rejected' }
      if (request.expectedDocumentRevision !== revisionRef.current) return { applied: false, reason: 'stale_revision' }
      if (request.expectedSelectionId && request.expectedSelectionId !== publishedSelectionRef.current?.selectionId) {
        return { applied: false, reason: 'stale_selection' }
      }
      const { from, to } = publishedSelectionRef.current ?? editor.state.selection
      if (request.expectedSelectionId && from !== to) {
        editor.chain().focus().insertContentAt({ from, to }, request.replacement).run()
      } else {
        editor.chain().focus().insertContent(request.replacement).run()
      }
      return { applied: true }
    },
    focus() { editor?.commands.focus() },
  }), [editor, project])

  useEffect(() => {
    if (!editor || !project) return
    const insert = (event: Event) => {
      const detail = (event as CustomEvent<StructuredCitationAttrs>).detail
      if (!detail?.referenceId || !detail.verified) {
        toast.error('Verify citation metadata before inserting it')
        return
      }
      void api.recordDecision(project.id, {
        type: 'citation_inserted', summary: `Inserted citation: ${detail.title}`,
        entityType: 'reference', entityId: detail.referenceId, detail: { locator: detail.locator ?? null },
      }).then(() => { editor.commands.insertCitation(detail) }).catch((error) => {
        toast.error('Citation was not inserted', { description: `Decision history could not be recorded: ${(error as Error).message}` })
      })
    }
    window.addEventListener('cogdoc:insert-citation', insert)
    return () => window.removeEventListener('cogdoc:insert-citation', insert)
  }, [editor, project])

  useEffect(() => {
    if (!editor) return
    const insert = (event: Event) => {
      const draft = String((event as CustomEvent<{ draft?: string }>).detail?.draft ?? '').trim()
      if (!draft) return
      const paragraphs = draft
        .split(/\n{2,}/)
        .map((text) => text.replace(/\s*\n\s*/g, ' ').trim())
        .filter(Boolean)
        .map((text) => ({ type: 'paragraph', content: [{ type: 'text', text }] }))
      if (!paragraphs.length) return
      editor.chain().focus().insertContent(paragraphs).run()
    }
    window.addEventListener('cogdoc:insert-research-draft', insert)
    return () => window.removeEventListener('cogdoc:insert-research-draft', insert)
  }, [editor])

  useEffect(() => {
    if (!editor) return
    const replace = (event: Event) => {
      const detail = (event as CustomEvent<{ passage?: string; replacement?: string }>).detail
      const passage = String(detail?.passage ?? '').trim()
      const replacement = String(detail?.replacement ?? '').trim()
      if (!passage || !replacement) return
      const range = findEditorTextRange(editor.state.doc, passage)
      if (!range) {
        toast.error('The highlighted passage has changed', { description: 'Review the proposal and apply it manually.' })
        return
      }
      editor.chain().focus().insertContentAt(range, replacement).run()
    }
    window.addEventListener('cogdoc:replace-research-passage', replace)
    return () => window.removeEventListener('cogdoc:replace-research-passage', replace)
  }, [editor])

  useEffect(() => {
    if (!editor || !pendingCitation || !project) return
    const bookmark = editorSelectionBookmark?.to ?? editor.state.selection.to
    const position = Math.max(1, Math.min(bookmark, editor.state.doc.content.size))
    const citation = pendingCitation
    void api.recordDecision(project.id, {
      type: 'citation_inserted', summary: `Inserted citation: ${citation.title}`,
      entityType: 'reference', entityId: citation.referenceId, detail: { locator: citation.locator ?? null },
    }).then(() => {
      editor.chain().focus().setTextSelection(position).insertCitation(citation).run()
      toast.success('Citation inserted at your saved cursor', { description: 'The bibliography will use citations present in the document.' })
    }).catch((error) => {
      toast.error('Citation was not inserted', { description: `Decision history could not be recorded: ${(error as Error).message}` })
    }).finally(clearPendingCitation)
  }, [editor, pendingCitation, editorSelectionBookmark, clearPendingCitation, project])

  // ── Autosave (debounced 1.5s) — serialise ProseMirror JSON (ADR-0009) ────
  const scheduleSave = useCallback(() => {
    if (!editor || !project) return
    const json = serializeForSave(editor.getJSON())
    void saveRecoveryDraft(project.id, { content: json, revision: revisionRef.current, updatedAt: Date.now() })
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      if (!navigator.onLine) {
        setSaveState('offline')
        return
      }
      setSaveState('saving')
      try {
        const res = await api.saveDocument(project.id, json, revisionRef.current)
        revisionRef.current = res.revision
        updateActiveProjectContent(json, res.lastSaved, res.revision, res.contentHash)
        setLastSavedAt(res.lastSaved)
        setSaveState('saved')
        setConflict(null)
        void publishSelection()
        await clearRecoveryDraft(project.id)
        setTimeout(() => setSaveState('idle'), 1500)
      } catch (error) {
        if (error instanceof ApiError && error.status === 409) {
          setConflict({
            serverRevision: Number(error.payload.serverRevision ?? revisionRef.current),
            serverContent: String(error.payload.serverContent ?? ''),
          })
          setSaveState('conflict')
        } else {
          setSaveState(navigator.onLine ? 'idle' : 'offline')
        }
      }
    }, 1500)
  }, [editor, project, publishSelection, updateActiveProjectContent])

  // ── Wire editor events ──────────────────────────────────────────────────
  useEffect(() => {
    if (!editor) return
    const handleUpdate = () => {
      scheduleSave()
      const text = editor.getText()
      setWordCount(text.split(/\s+/).filter(Boolean).length)
    }
    editor.on('update', handleUpdate)
    return () => { editor.off('update', handleUpdate) }
  }, [editor, scheduleSave])

  // Keep research actions and formatting state in sync with the editor's
  // current selection. The selected text remains author-controlled and is
  // only sent when they explicitly open the source finder.
  useEffect(() => {
    if (!editor) return
    const handleSelection = () => { void publishSelection() }
    editor.on('selectionUpdate', handleSelection)
    editor.on('transaction', handleSelection)
    handleSelection()
    return () => {
      editor.off('selectionUpdate', handleSelection)
      editor.off('transaction', handleSelection)
    }
  }, [editor, publishSelection])

  // Recover the latest unsent local draft after an offline close or failed save.
  useEffect(() => {
    if (!editor || !project) return
    loadRecoveryDraft(project.id).then((draft) => {
      if (!draft || draft.content === serializeForSave(editor.getJSON())) return
      if (draft.revision >= (project.document?.revision ?? 0)) {
        setSaveState('recovering')
        editor.commands.setContent(parseStoredContent(draft.content))
        revisionRef.current = project.document?.revision ?? draft.revision
        toast('Recovered unsaved work from this device')
        setTimeout(() => scheduleSave(), 100)
      }
    }).catch(() => {})
  }, [editor, project?.id])

  useEffect(() => {
    const online = () => { setSaveState('recovering'); scheduleSave() }
    const offline = () => setSaveState('offline')
    window.addEventListener('online', online)
    window.addEventListener('offline', offline)
    return () => { window.removeEventListener('online', online); window.removeEventListener('offline', offline) }
  }, [scheduleSave])

  // ── Highlight interventions via ProseMirror decorations ─────────────────
  // Push the active list into the InterventionHighlight plugin; it renders
  // .cogdoc-mark spans and re-maps them on every doc change. (The legacy
  // DOM-mutation highlight was reverted by ProseMirror's mutation observer.)
  useEffect(() => {
    if (!editor) return
    editor.view.dispatch(
      editor.state.tr.setMeta(interventionHighlightKey, activeInterventions),
    )
  }, [editor, activeInterventions])

  // Document-anchored review actions receive their own visible underline.
  // This is deliberately separate from live intervention marks: review items
  // do not open engine popovers and never alter the author's text.
  useEffect(() => {
    if (!editor) return
    editor.view.dispatch(
      editor.state.tr.setMeta(reviewItemHighlightKey, reviewHighlightQuotes),
    )
  }, [editor, reviewHighlightQuotes])

  // Automatic next actions that point at an exact draft quote are visible in
  // the document and expose the same context available in the navigator.
  useEffect(() => {
    if (!editor) return
    editor.view.dispatch(
      editor.state.tr.setMeta(researchActionHighlightKey, researchActions),
    )
  }, [editor, researchActions])

  // The review queue and live writing signals use this handoff to reveal a
  // sentence in long documents without requiring the author to hunt for an
  // underline manually.
  useEffect(() => {
    if (!editor || !editorFocusQuote) return
    const range = findEditorTextRange(editor.state.doc, editorFocusQuote)
    clearEditorFocus()
    if (!range) {
      toast('This passage changed after the review and could not be located.')
      return
    }
    editor.chain().focus().setTextSelection(range).scrollIntoView().run()
  }, [editor, editorFocusQuote, clearEditorFocus])

  useEffect(() => {
    if (!editor || !editorOutlineTarget) return
    const target = [...editor.view.dom.querySelectorAll<HTMLElement>('[data-outline-id]')]
      .find((element) => element.dataset.outlineId === editorOutlineTarget)
    clearEditorOutlineFocus()
    if (!target) {
      toast('This heading changed and its link could not be located.')
      return
    }
    window.history.replaceState(null, '', `#${editorOutlineTarget}`)
    target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    target.focus({ preventScroll: true })
    target.classList.add('cogdoc-outline-heading--target')
    window.setTimeout(() => target.classList.remove('cogdoc-outline-heading--target'), 1200)
  }, [editor, editorOutlineTarget, clearEditorOutlineFocus])

  // Cleanup
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  // ── Hover handling for sentence marks (popovers over underlines) ────────
  function revealInlineContext(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false
    const actionMark = target.closest<HTMLElement>('.cogdoc-action-mark')
    if (actionMark?.dataset.actionId) {
      const rect = actionMark.getBoundingClientRect()
      setHovered(`action:${actionMark.dataset.actionId}`, { top: rect.bottom, left: rect.left })
      return true
    }
    const reviewMark = target.closest<HTMLElement>('.cogdoc-review-mark')
    if (reviewMark?.dataset.reviewQuote) {
      const rect = reviewMark.getBoundingClientRect()
      setHovered(`review:${reviewMark.dataset.reviewQuote}`, { top: rect.bottom, left: rect.left })
      return true
    }
    const mark = target.closest<HTMLElement>('.cogdoc-mark')
    const key = mark?.dataset.sentenceKey
    if (!mark || !key) return false
    const rect = mark.getBoundingClientRect()
    setHovered(key, { top: rect.bottom, left: rect.left })
    return true
  }

  function handleMouseOver(e: React.MouseEvent) {
    revealInlineContext(e.target)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!editor) return
    if ((e.key === 'Enter' || e.key === ' ') && revealInlineContext(e.target)) {
      e.preventDefault()
      return
    }
    // Esc → clear selection and close any open sentence popover
    if (e.key === 'Escape') {
      window.getSelection()?.removeAllRanges()
      setHovered(null, null)
    }
  }

  // Seed the word count from the loaded document (updates flow from handleUpdate)
  useEffect(() => {
    if (!editor) return
    const timer = window.setTimeout(() => setWordCount(editor.getText().split(/\s+/).filter(Boolean).length), 0)
    return () => window.clearTimeout(timer)
  }, [editor])

  if (!project || !editor) return null

  function resolveConflict(choice: 'server' | 'mine') {
    if (!conflict) return
    revisionRef.current = conflict.serverRevision
    if (choice === 'server') {
      editor.commands.setContent(parseStoredContent(conflict.serverContent))
      void clearRecoveryDraft(project!.id)
      setSaveState('idle')
    } else {
      setSaveState('recovering')
      setTimeout(() => scheduleSave(), 0)
    }
    setConflict(null)
  }

  return (
    <div className="flex h-full flex-col bg-[var(--cog-workspace)]" onKeyDown={handleKeyDown}>
      {/* Subtle toolbar */}
      <div className="flex min-h-10 items-center justify-between gap-4 border-b border-[var(--cog-border)] bg-[var(--cog-paper)] px-4 py-1.5 sm:px-6">
        <div className="flex items-center gap-3 text-xs text-[var(--cog-muted-foreground)]" aria-live="polite" aria-atomic="true">
          {saveState === 'saving' ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" /> Saving…
            </span>
          ) : saveState === 'saved' ? (
            <span className="flex items-center gap-1.5 text-emerald-600">
              <Check className="w-3 h-3" /> Saved
            </span>
          ) : saveState === 'offline' ? (
            <span className="flex items-center gap-1.5 text-amber-700">Offline · draft safe on this device</span>
          ) : saveState === 'recovering' ? (
            <span className="flex items-center gap-1.5 text-[#28614f]"><Loader2 className="w-3 h-3 animate-spin" /> Recovering…</span>
          ) : saveState === 'conflict' ? (
            <span className="flex items-center gap-1.5 text-rose-700">Another session changed this draft</span>
          ) : lastSavedAt ? (
            <span className="flex items-center gap-1.5">
              <Clock className="w-3 h-3" /> {new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          ) : <span>Not saved</span>}
          <span className="text-stone-300">·</span>
          <span>{wordCount} words</span>
        </div>
        <p className="hidden text-xs text-[var(--cog-muted-foreground)] md:block">Select text to research or ask the collaborator</p>
      </div>

      {conflict && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rose-200 bg-rose-50 px-6 py-2 text-xs text-rose-900" role="alert">
          <span>Your unsaved copy is safe. Choose which version to continue with.</span>
          <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => resolveConflict('server')} className="h-7 border-rose-300 bg-white">Use server version</Button><Button size="sm" onClick={() => resolveConflict('mine')} className="h-7 bg-rose-800 hover:bg-rose-900">Keep my version</Button></div>
        </div>
      )}

      <EditorToolbar editor={editor} selectedText={selectedText} onFindSources={() => {
        setSourceMapperQuery(selectedText)
        void publishSelection().then(() => onOpenSources?.(publishedSelectionRef.current))
      }} onAskCollaborator={() => { void publishSelection().then(() => onOpenCollaborator?.(publishedSelectionRef.current)) }} />

      {/* Scrollable writing surface */}
      <div className="document-scroll flex-1 overflow-y-auto overscroll-contain">
        <div className="document-paper relative mx-auto min-h-full w-full max-w-[920px] bg-[var(--cog-paper)] px-7 py-12 sm:px-14 sm:py-16 lg:px-20">
          {/* Writing surface — focus mode dims all but the last paragraph */}
          <div
            onMouseOver={handleMouseOver}
            onFocus={(event) => revealInlineContext(event.target)}
            onClick={(event) => revealInlineContext(event.target)}
            className={`transition-opacity ${focusMode ? 'focus-within:[&_p:not(:last-child)]:opacity-40' : ''}`}
          >
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>

      {/* Hover popover (renders outside the scrollable area) */}
      <div data-sentence-popover>
        <SentencePopover />
      </div>

    </div>
  )
})

EditorTiptap.displayName = 'EditorTiptap'

export default EditorTiptap
