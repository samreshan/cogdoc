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
import StarterKit from '@tiptap/starter-kit'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import { useEffect, useRef, useCallback, useState } from 'react'
import { useCogdoc } from '@/lib/store'
import { api } from '@/lib/api-client'
import { extractLastSentence } from '@/lib/content-analyzer'
import {
  idleThresholdForMode,
  pickEnginesForSentence,
  serializeForSave,
  parseStoredContent,
  extractContext,
  isParagraphComplete,
} from '@/lib/editor-orchestration'
import { WavyUnderline } from '@/lib/extensions/wavy-underline'
import { IdleDetector } from '@/lib/extensions/idle-detector'
import {
  InterventionHighlight,
  interventionHighlightKey,
} from '@/lib/extensions/intervention-highlight'
import { useEngineFiring } from '@/lib/use-engine-firing'
import type { EngineType } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send, Loader2, Clock, Check, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import SentencePopover from './sentence-popover'
import RunningPets, { IdlePetBadge } from './running-pets'
import { ApiError } from '@/lib/api-client'
import { clearRecoveryDraft, loadRecoveryDraft, saveRecoveryDraft } from '@/lib/draft-recovery'

export default function EditorTiptap() {
  const project = useCogdoc((s) => s.activeProject)
  const updateActiveProjectContent = useCogdoc((s) => s.updateActiveProjectContent)
  const pushIntervention = useCogdoc((s) => s.pushIntervention)
  const activeInterventions = useCogdoc((s) => s.activeInterventions)
  const setEngineLoading = useCogdoc((s) => s.setEngineLoading)
  const engineLoading = useCogdoc((s) => s.engineLoading)
  const bumpAnalytics = useCogdoc((s) => s.bumpAnalytics)
  const focusMode = useCogdoc((s) => s.focusMode)
  const setHovered = useCogdoc((s) => s.setHovered)
  const frictionMode = useCogdoc((s) => s.frictionMode)

  const [promptInput, setPromptInput] = useState('')
  const [wordCount, setWordCount] = useState(0)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'offline' | 'recovering' | 'conflict'>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(
    project?.document?.lastSaved ?? null,
  )

  const idleRef = useRef<IdleDetector | null>(null)
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const revisionRef = useRef(project?.document?.revision ?? 0)
  const [conflict, setConflict] = useState<{ serverRevision: number; serverContent: string } | null>(null)
  const reviewPace = project?.reviewPace ?? 'deep'

  const editor = useEditor({
    extensions: [
      StarterKit,
      Table.configure({ resizable: true }), TableRow, TableHeader, TableCell,
      Image.configure({ allowBase64: true }), Link.configure({ openOnClick: false }),
      WavyUnderline, InterventionHighlight,
    ],
    content: parseStoredContent(project?.document?.content),
    editorProps: {
      attributes: {
        class: 'tiptap-editor outline-none',
        style:
          'font-family: var(--font-newsreader), Georgia, serif; font-size: 18px; line-height: 1.8; color: #2a2520; max-width: 680px; margin: 0 auto; min-height: 50vh;',
        'data-placeholder':
          'Start writing here. Cogdoc analyzes every sentence — interventions appear as underlines you can hover to read.',
      },
    },
  })

  const { fireEngine, checkBlindspot } = useEngineFiring(
    useCallback(() => editor?.getText() ?? '', [editor]),
  )

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
  }, [editor, project, updateActiveProjectContent])

  // ── Wire editor events ──────────────────────────────────────────────────
  useEffect(() => {
    if (!editor) return
    const handleUpdate = () => {
      scheduleSave()
      idleRef.current?.ping()
      const text = editor.getText()
      setWordCount(text.split(/\s+/).filter(Boolean).length)
      // Sentence completion → fire matching engines, staggered 500ms so
      // several engines on one sentence don't trip LLM rate limits (429).
      const endChar = text.trim().slice(-1)
      if (reviewPace !== 'rapid' && (endChar === '.' || endChar === '?' || endChar === '!')) {
        const sentence = extractLastSentence(text)
        if (sentence.split(/\s+/).length >= 4) {
          const { context } = extractContext(text)
          const engines = pickEnginesForSentence(sentence).filter((engine) => reviewPace === 'deep' || engine === 'citation' || engine === 'interceptor')
          engines.forEach((eng, idx) => {
            setTimeout(() => fireEngine(eng, sentence, context), idx * 500)
          })
        }
      }
    }
    editor.on('update', handleUpdate)
    return () => { editor.off('update', handleUpdate) }
  }, [editor, scheduleSave, fireEngine, project, reviewPace])

  // ── Idle detector at the friction-scaled 45s (IR §2.3.6) ────────────────
  useEffect(() => {
    if (reviewPace !== 'deep') {
      idleRef.current?.stop()
      return
    }
    idleRef.current = new IdleDetector({
      thresholdMs: idleThresholdForMode(frictionMode),
      onIdle: () => fireEngine('socratic', '', ''),
    })
    idleRef.current.start()
    return () => idleRef.current?.stop()
  }, [frictionMode, fireEngine, reviewPace])

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

  // Cleanup
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  // ── Hover handling for sentence marks (popovers over underlines) ────────
  function handleMouseOver(e: React.MouseEvent) {
    const target = e.target as HTMLElement
    if (target.classList?.contains('cogdoc-mark')) {
      const key = target.dataset.sentenceKey
      if (!key) return
      const rect = target.getBoundingClientRect()
      setHovered(key, { top: rect.bottom, left: rect.left })
    }
  }

  // Submit a prompt to the Interceptor
  async function handlePromptSubmit() {
    if (!project || !promptInput.trim() || !editor) return
    const { context } = extractContext(editor.getText())
    setEngineLoading('interceptor', true)
    try {
      const res = await api.interceptor(project.id, promptInput, context)
      if (res.action === 'pass') {
        toast('Prompt was not delegative — passed through')
      } else if (res.intervention) {
        pushIntervention(res.intervention)
        bumpAnalytics()
      }
      setPromptInput('')
    } catch (e) {
      toast.error('Interceptor failed', { description: (e as Error).message })
    } finally {
      setEngineLoading('interceptor', false)
    }
  }

  // Paragraph completion (Enter) → Scaffold + Blindspot
  function handleKeyDown(e: React.KeyboardEvent) {
    if (!editor) return
    if (e.key === 'Enter' && !e.shiftKey && reviewPace === 'deep') {
      setTimeout(() => {
        const text = editor.getText()
        const paras = text.split(/\n\s*\n/).filter((p) => p.trim())
        if (isParagraphComplete(paras)) {
          const { context } = extractContext(text)
          fireEngine('scaffold', '', context)
          checkBlindspot(text)
        }
      }, 50)
    }
    // Esc → clear selection and close any open sentence popover
    if (e.key === 'Escape') {
      window.getSelection()?.removeAllRanges()
      setHovered(null, null)
    }
  }

  // Seed the word count from the loaded document (updates flow from handleUpdate)
  useEffect(() => {
    if (editor) setWordCount(editor.getText().split(/\s+/).filter(Boolean).length)
  }, [editor])

  if (!project || !editor) return null

  const activeEngines = (Object.keys(engineLoading) as EngineType[]).filter((e) => engineLoading[e])

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
    <div className="flex flex-col h-full" onKeyDown={handleKeyDown} style={{ background: '#faf7f0' }}>
      {/* Subtle toolbar */}
      <div className="px-6 py-1.5 flex items-center justify-between gap-4 border-b border-stone-200/50">
        <div className="flex items-center gap-3 text-xs text-stone-500">
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
          {activeEngines.length > 0 && (
            <>
              <span className="text-stone-300">·</span>
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin text-stone-400" />
                {activeEngines.map((e) => (
                  <IdlePetBadge key={e} engine={e} />
                ))}
                <span className="text-stone-500 text-xs">checking…</span>
              </span>
            </>
          )}
        </div>
        <div className="text-[11px] text-stone-400">
          Sentences with interventions are <span style={{ textDecoration: 'underline wavy #78716c', textUnderlineOffset: '3px' }}>underlined</span> — hover to see them
        </div>
      </div>

      {conflict && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rose-200 bg-rose-50 px-6 py-2 text-xs text-rose-900" role="alert">
          <span>Your unsaved copy is safe. Choose which version to continue with.</span>
          <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => resolveConflict('server')} className="h-7 border-rose-300 bg-white">Use server version</Button><Button size="sm" onClick={() => resolveConflict('mine')} className="h-7 bg-rose-800 hover:bg-rose-900">Keep my version</Button></div>
        </div>
      )}

      {/* Scrollable writing surface */}
      <div className="flex-1 overflow-y-auto">
        <div className="relative w-full max-w-[1000px] mx-auto px-8 py-16">
          {/* Title */}
          <h1
            contentEditable
            suppressContentEditableWarning
            className="text-4xl font-bold text-stone-900 mb-8 outline-none focus:outline-none text-center"
            style={{ fontFamily: 'var(--font-newsreader), Georgia, serif' }}
            data-placeholder="Untitled"
          />
          {/* Writing surface — focus mode dims all but the last paragraph */}
          <div
            onMouseOver={handleMouseOver}
            className={`transition-opacity ${focusMode ? 'focus-within:[&_p:not(:last-child)]:opacity-40' : ''}`}
          >
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>

      {/* Discreet prompt bar */}
      <div className="border-t border-stone-200/50 px-6 py-2.5" style={{ background: '#fffefb' }}>
        <div className="max-w-[680px] mx-auto flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
          <Textarea
            value={promptInput}
            onChange={(e) => setPromptInput(e.target.value)}
            aria-label="Ask Cogdoc"
            placeholder="Ask Cogdoc… (it intercepts delegative prompts and reframes them as questions)"
            rows={1}
            className="resize-none min-h-[32px] max-h-[100px] border-none bg-transparent focus-visible:ring-0 text-sm placeholder:text-stone-400"
            style={{ fontFamily: 'var(--font-geist-sans), sans-serif' }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handlePromptSubmit()
              }
            }}
          />
          <Button
            size="icon"
            aria-label="Send prompt"
            onClick={handlePromptSubmit}
            disabled={!promptInput.trim() || engineLoading.interceptor}
            className="bg-stone-800 hover:bg-stone-700 shrink-0 h-7 w-7"
          >
            {engineLoading.interceptor ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>

      {/* Hover popover (renders outside the scrollable area) */}
      <div data-sentence-popover>
        <SentencePopover />
      </div>

      {/* Running pixelated pets — animate across the screen when engines fire */}
      <RunningPets />
    </div>
  )
}
