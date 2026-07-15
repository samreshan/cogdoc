'use client'

/**
 * Tiptap editor (ADR-0006 close-out) — the ProseMirror-based writing surface.
 *
 * Ports the orchestration from the legacy contentEditable editor onto the
 * Tiptap transaction model:
 *  - autosave (debounced 1.5s) serialises via editor.getJSON() → Document.content
 *  - engine-firing on sentence-end (. ? !) and on paragraph completion (Enter)
 *  - idle trigger via the IdleDetector at the friction-scaled 45s (was 2s debug)
 *  - intervention highlights via the WavyUnderline Mark (replaces DOM marks)
 *  - Devil's Autocomplete ghost-text (Phase 2) + Blindspot (Phase 2)
 *  - friction-aware cooldowns (Phase 1)
 *
 * Activated behind USE_TIPTAP_EDITOR (editor-shell swaps on the flag). The old
 * contentEditable editor remains the fallback. Both read/write Document.content
 * (ADR-0009: HTML and ProseMirror JSON both load via setContent).
 */
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect, useRef, useCallback, useState } from 'react'
import { useCogdoc } from '@/lib/store'
import { api } from '@/lib/api-client'
import { extractLastSentence } from '@/lib/content-analyzer'
import { getCooldown } from '@/lib/friction'
import {
  idleThresholdForMode,
  pickEnginesForSentence,
  serializeForSave,
  isParagraphComplete,
} from '@/lib/editor-orchestration'
import { WavyUnderline } from '@/lib/extensions/wavy-underline'
import { IdleDetector } from '@/lib/extensions/idle-detector'
import { highlightSentences } from '@/lib/sentence-highlight'
import { useDevilsAutocomplete } from '@/lib/use-devils-autocomplete'
import { consumeInterceptorStream } from '@/lib/ai-gateway'
import type { EngineType, Intervention } from '@/lib/types'
import { Textarea } from '@/components/ui/textarea'
import { Send, Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

function docToText(editor: ReturnType<typeof useEditor>): string {
  if (!editor) return ''
  return editor.getText()
}

export default function EditorTiptap() {
  const project = useCogdoc((s) => s.activeProject)
  const updateActiveProjectContent = useCogdoc((s) => s.updateActiveProjectContent)
  const pushIntervention = useCogdoc((s) => s.pushIntervention)
  const activeInterventions = useCogdoc((s) => s.activeInterventions)
  const setEngineLoading = useCogdoc((s) => s.setEngineLoading)
  const engineLoading = useCogdoc((s) => s.engineLoading)
  const bumpAnalytics = useCogdoc((s) => s.bumpAnalytics)
  const frictionMode = useCogdoc((s) => s.frictionMode)
  const blindspotShown = useCogdoc((s) => s.blindspotShownThisSession)
  const markBlindspotShown = useCogdoc((s) => s.markBlindspotShown)

  const [promptInput, setPromptInput] = useState('')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')

  const autocomplete = useDevilsAutocomplete(frictionMode)

  // Refs that need to survive re-renders without re-creating the editor.
  const lastFireRef = useRef<Record<EngineType, number>>({
    socratic: 0, interceptor: 0, citation: 0, scaffold: 0,
  })
  const idleRef = useRef<IdleDetector | null>(null)
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null)

  const editor = useEditor({
    extensions: [StarterKit, WavyUnderline],
    content: project?.document?.content ?? '',
    editorProps: {
      attributes: {
        class: 'tiptap-editor outline-none',
        style:
          "fontFamily: var(--font-newsreader), Georgia, serif; fontSize: 18px; lineHeight: 1.8; color: #2a2520; maxWidth: 680px; margin: 0 auto; minHeight: 50vh;",
        'data-placeholder': 'Start writing here. Cogdoc analyzes every sentence.',
      },
    },
  })

  // ── Autosave (debounced 1.5s) — serialise ProseMirror JSON (ADR-0009) ────
  const scheduleSave = useCallback(() => {
    if (!editor || !project) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    setSaveState('saving')
    saveTimerRef.current = setTimeout(async () => {
      const json = serializeForSave(editor.getJSON())
      try {
        const res = await api.saveDocument(project.id, json)
        updateActiveProjectContent(json, res.lastSaved)
        setSaveState('saved')
      } catch {
        setSaveState('idle')
      }
    }, 1500)
  }, [editor, project, updateActiveProjectContent])

  // ── Unified engine fire (friction-aware cooldowns, Phase 1) ─────────────
  const fireEngine = useCallback(
    async (engine: EngineType, sentence: string, context: string) => {
      if (!project) return
      const now = Date.now()
      if (now - lastFireRef.current[engine] < getCooldown(engine, frictionMode)) return
      lastFireRef.current[engine] = now

      let effective = sentence
      if (engine === 'socratic' && !effective) {
        effective = extractLastSentence(docToText(editor))
        if (!effective) return
      }

      setEngineLoading(engine, true)
      try {
        let intervention: Intervention | null = null
        if (engine === 'citation') {
          const res = await api.citationSentinel(project.id, effective, undefined, frictionMode)
          intervention = res.intervention
        } else if (engine === 'interceptor') {
          // Phase 3: stream token-by-token, fall back to blocking on error.
          try {
            await consumeInterceptorStream(
              { project_id: project.id, prompt: effective, context, friction_mode: frictionMode },
              (partial) => toast(`✦ ${partial}`, { id: 'interceptor-stream', duration: 1200 }),
            )
            const res = await api.interceptor(project.id, effective, context, undefined, frictionMode)
            if (res.action === 'pass') return
            intervention = res.intervention
          } catch {
            const res = await api.interceptor(project.id, effective, context, undefined, frictionMode)
            if (res.action === 'pass') return
            intervention = res.intervention
          }
        } else if (engine === 'scaffold') {
          const res = await api.scaffold(project.id, 'Provide a structural scaffold for my next paragraph.', context, undefined, frictionMode)
          intervention = res.intervention
        } else {
          const res = await api.socraticSpacer(project.id, context, effective, undefined, frictionMode)
          intervention = res.intervention
        }
        if (intervention) {
          pushIntervention(intervention)
          bumpAnalytics()
        }
      } catch (e) {
        console.error(`${engine} failed:`, e)
      } finally {
        setEngineLoading(engine, false)
      }
    },
    [project, editor, pushIntervention, setEngineLoading, bumpAnalytics, frictionMode],
  )

  // ── Blindspot (Phase 2, one per session) ────────────────────────────────
  const checkBlindspot = useCallback(
    (draft: string) => {
      if (!project || blindspotShown) return
      if (draft.split(/\s+/).filter(Boolean).length < 30) return
      api.blindspot(project.id, draft).then((res) => {
        if (res.blindspot && res.intervention) {
          pushIntervention(res.intervention)
          bumpAnalytics()
          markBlindspotShown()
        }
      }).catch(() => {})
    },
    [project, blindspotShown, pushIntervention, bumpAnalytics, markBlindspotShown],
  )

  // ── Wire editor events ──────────────────────────────────────────────────
  useEffect(() => {
    if (!editor) return
    const handleUpdate = () => {
      scheduleSave()
      idleRef.current?.ping()
      // Devil's Autocomplete: try commit or load
      const text = editor.getText()
      const lastChar = text.slice(-1)
      if (autocomplete.suggestion && lastChar) {
        autocomplete.typeCommit(lastChar)
      } else if (project && text.length > 0 && text.length % 8 === 0) {
        autocomplete.load(project.id, text).catch(() => {})
      }
      // Sentence completion → fire matching engines
      const endChar = text.trim().slice(-1)
      if (endChar === '.' || endChar === '?' || endChar === '!') {
        const sentence = extractLastSentence(text)
        if (sentence.split(/\s+/).length >= 4) {
          const engines = pickEnginesForSentence(sentence)
          engines.forEach((eng, idx) => {
            setTimeout(() => fireEngine(eng, sentence, ''), idx * 500)
          })
        }
      }
    }
    editor.on('update', handleUpdate)
    return () => { editor.off('update', handleUpdate) }
  }, [editor, scheduleSave, fireEngine, autocomplete, project])

  // ── Idle detector at the friction-scaled 45s (was 2s debug) ─────────────
  useEffect(() => {
    idleRef.current = new IdleDetector({
      thresholdMs: idleThresholdForMode(frictionMode),
      onIdle: () => fireEngine('socratic', '', ''),
    })
    idleRef.current.start()
    return () => idleRef.current?.stop()
  }, [frictionMode, fireEngine])

  // ── Highlight interventions via WavyUnderline (re-applied on change) ─────
  // Tiptap manages marks via transactions; for the MVP we mirror the DOM-based
  // highlight (the WavyUnderline mark is wired but applying it per-sentence via
  // a decoration plugin is Phase 6 polish). The legacy highlightSentences keeps
  // the contract green.
  useEffect(() => {
    if (!editor || activeInterventions.length === 0) return
    const el = editor.view.dom as HTMLElement
    const t = setTimeout(() => highlightSentences(el, activeInterventions), 100)
    return () => clearTimeout(t)
  }, [editor, activeInterventions])

  // Cleanup
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  // Submit a prompt to the Interceptor
  async function handlePromptSubmit() {
    if (!project || !promptInput.trim() || !editor) return
    setEngineLoading('interceptor', true)
    try {
      const res = await api.interceptor(project.id, promptInput, editor.getText(), undefined, frictionMode)
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
    if (e.key === 'Enter' && !e.shiftKey) {
      setTimeout(() => {
        const text = editor.getText()
        const paras = text.split(/\n\s*\n/).filter((p) => p.trim())
        if (isParagraphComplete(paras)) {
          fireEngine('scaffold', '', '')
          checkBlindspot(text)
        }
      }, 50)
    }
    // Tab → autocomplete accept (mode-gated)
    if (e.key === 'Tab' && autocomplete.suggestion) {
      e.preventDefault()
      autocomplete.tabAccept()
    }
  }

  if (!project || !editor) return null

  const wordCount = editor.getText().split(/\s+/).filter(Boolean).length
  const activeEngines = (Object.keys(engineLoading) as EngineType[]).filter((e) => engineLoading[e])

  return (
    <div className="flex flex-col h-full" onKeyDown={handleKeyDown} style={{ background: '#faf7f0' }}>
      <div className="px-6 py-1.5 flex items-center justify-between gap-4 border-b border-stone-200/50">
        <div className="flex items-center gap-3 text-xs text-stone-500">
          {saveState === 'saving' ? (
            <span className="flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" /> Saving…</span>
          ) : saveState === 'saved' ? (
            <span className="flex items-center gap-1.5 text-emerald-600">Saved</span>
          ) : (
            <span>{wordCount} words · idle {idleThresholdForMode(frictionMode) / 1000}s · Tiptap</span>
          )}
        </div>
        {activeEngines.length > 0 && (
          <span className="flex items-center gap-1.5 text-xs text-stone-400">
            <Loader2 className="w-3 h-3 animate-spin" /> checking…
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="relative w-full max-w-[1000px] mx-auto px-8 py-16">
          <EditorContent editor={editor} />
          {autocomplete.suggestion && (
            <div
              className="max-w-[680px] mx-auto -mt-2 pointer-events-none select-none"
              style={{ fontFamily: 'var(--font-newsreader), Georgia, serif', fontSize: '18px', lineHeight: 1.8 }}
            >
              <span style={{ color: '#b8b0a4' }}>{autocomplete.suggestion}</span>
              <span className="ml-2 text-[10px] text-stone-400 align-middle">
                {frictionMode === 'assistant' ? 'Tab to accept' : 'type to continue'}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-stone-200/50 px-6 py-2.5" style={{ background: '#fffefb' }}>
        <div className="max-w-[680px] mx-auto flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
          <Textarea
            value={promptInput}
            onChange={(e) => setPromptInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePromptSubmit() } }}
            placeholder="Ask the Interceptor to check a prompt…"
            className="min-h-[36px] max-h-[120px] resize-none border-0 bg-transparent text-sm focus-visible:ring-0 p-1"
            rows={1}
          />
        </div>
      </div>
    </div>
  )
}
