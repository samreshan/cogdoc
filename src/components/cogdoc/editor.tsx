'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { useCogdoc } from '@/lib/store'
import { api } from '@/lib/api-client'
import { analyzeSentence, extractLastSentence, ENGINE_COOLDOWNS } from '@/lib/content-analyzer'
import type { EngineType } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Send, Loader2, Clock, Check, Sparkles, ShieldCheck, ListTree, BookOpen,
} from 'lucide-react'
import { toast } from 'sonner'
import FloatingInterventions from './floating-interventions'

const IDLE_THRESHOLD_MS = 2_000 // 2s idle → Socratic Spacer
const SOCRATIC_DEBOUNCE_MS = 3_000 // gap between Socratic fires

function htmlToText(html: string): string {
  if (typeof document === 'undefined') return ''
  const div = document.createElement('div')
  div.innerHTML = html
  return (div.textContent ?? '').trim()
}

function extractContext(html: string): { context: string; stub: string } {
  const text = htmlToText(html)
  const paras = text.split(/\n\s*\n/).filter((p) => p.trim())
  if (paras.length === 0) return { context: '', stub: text }
  return { context: paras.slice(-3).join('\n\n'), stub: paras[paras.length - 1] }
}

/**
 * Capture the cursor's y-position relative to the scrollable content container.
 * Used to place floating intervention tooltips at the right vertical offset.
 */
function captureCursorTop(container: HTMLElement | null): number {
  if (!container) return 0
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return 0
  const range = sel.getRangeAt(0).cloneRange()
  range.collapse(true)
  const cursorRect = range.getBoundingClientRect()
  const containerRect = container.getBoundingClientRect()
  return cursorRect.bottom - containerRect.top + 8
}

const ENGINE_ICON: Record<EngineType, typeof Sparkles> = {
  socratic: BookOpen, interceptor: Sparkles, citation: ShieldCheck, scaffold: ListTree,
}

export default function Editor() {
  const project = useCogdoc((s) => s.activeProject)
  const updateActiveProjectContent = useCogdoc((s) => s.updateActiveProjectContent)
  const pushPositionedIntervention = useCogdoc((s) => s.pushPositionedIntervention)
  const engineLoading = useCogdoc((s) => s.engineLoading)
  const setEngineLoading = useCogdoc((s) => s.setEngineLoading)
  const bumpAnalytics = useCogdoc((s) => s.bumpAnalytics)
  const focusMode = useCogdoc((s) => s.focusMode)

  const editorRef = useRef<HTMLDivElement>(null)
  const scrollContentRef = useRef<HTMLDivElement>(null)
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null)
  const lastFireRef = useRef<Record<EngineType, number>>({
    socratic: 0, interceptor: 0, citation: 0, scaffold: 0,
  })

  const [promptInput, setPromptInput] = useState('')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(
    project?.document?.lastSaved ?? null,
  )

  // Load initial content
  useEffect(() => {
    if (editorRef.current && project?.document?.content !== undefined) {
      editorRef.current.innerHTML = project.document.content || ''
    }
    setLastSavedAt(project?.document?.lastSaved ?? null)
  }, [project?.id])

  // Auto-save (debounced 1.5s)
  const scheduleSave = useCallback(
    (html: string) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      setSaveState('saving')
      saveTimerRef.current = setTimeout(async () => {
        if (!project) return
        try {
          const { lastSaved } = await api.saveDocument(project.id, html)
          updateActiveProjectContent(html, lastSaved)
          setLastSavedAt(lastSaved)
          setSaveState('saved')
          setTimeout(() => setSaveState('idle'), 1500)
        } catch {
          setSaveState('idle')
        }
      }, 1500)
    },
    [project, updateActiveProjectContent],
  )

  // ── Unified engine fire function ──────────────────────────────────────
  // Handles all four engines. Captures cursor position, calls the right API,
  // pushes a positioned intervention to the store.
  const fireEngine = useCallback(
    async (engine: EngineType, sentence: string, context: string, reason: string) => {
      if (!project || !editorRef.current) return

      // Per-engine cooldown check
      const now = Date.now()
      if (now - lastFireRef.current[engine] < ENGINE_COOLDOWNS[engine]) return
      lastFireRef.current[engine] = now

      // For Socratic, also respect the shorter debounce
      if (engine === 'socratic' && now - lastFireRef.current.socratic < SOCRATIC_DEBOUNCE_MS) {
        return
      }

      const position = { top: captureCursorTop(scrollContentRef.current) }
      setEngineLoading(engine, true)

      try {
        let intervention
        if (engine === 'citation') {
          const res = await api.citationSentinel(project.id, sentence)
          intervention = res.intervention
        } else if (engine === 'interceptor') {
          const res = await api.interceptor(project.id, sentence, context)
          if (res.action === 'pass') {
            // LLM says this sentence isn't actually vague/delegative — no-op
            setEngineLoading(engine, false)
            return
          }
          intervention = res.intervention
        } else if (engine === 'scaffold') {
          const res = await api.scaffold(project.id, 'Provide a structural scaffold for my next paragraph.', context)
          intervention = res.intervention
        } else {
          // socratic
          const res = await api.socraticSpacer(project.id, context, sentence)
          intervention = res.intervention
        }

        if (intervention) {
          pushPositionedIntervention(intervention, position)
          bumpAnalytics()
        }
      } catch (e) {
        // Silent fail — never block the writer
        console.error(`${engine} failed:`, e)
      } finally {
        setEngineLoading(engine, false)
      }
    },
    [project, pushPositionedIntervention, setEngineLoading, bumpAnalytics],
  )

  // Idle detector — fires Socratic Spacer after 2s of no input
  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    idleTimerRef.current = setTimeout(() => fireEngine('socratic', '', '', 'idle'), IDLE_THRESHOLD_MS)
  }, [fireEngine])

  // Cleanup
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    }
  }, [])

  // ── Handle every keystroke ────────────────────────────────────────────
  function handleInput() {
    if (!editorRef.current) return
    const html = editorRef.current.innerHTML
    scheduleSave(html)
    resetIdleTimer()

    // Sentence completion: `.`, `?`, `!` as the last typed character
    const text = htmlToText(html)
    const lastChar = text.trim().slice(-1)
    if (lastChar === '.' || lastChar === '?' || lastChar === '!') {
      const sentence = extractLastSentence(text)
      if (sentence.split(/\s+/).length >= 4) {
        const { context } = extractContext(html)
        const analysis = analyzeSentence(sentence)
        fireEngine(analysis.engine, sentence, context, analysis.reason)
      }
    }
  }

  // Handle Enter key for paragraph completion (Scaffold)
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      // Check if this creates a new paragraph (Enter on an empty line or at end of paragraph)
      setTimeout(() => {
        if (!editorRef.current) return
        const text = htmlToText(editorRef.current.innerHTML)
        const paras = text.split(/\n\s*\n/).filter((p) => p.trim())
        // If we just started a new paragraph and the previous one was substantial
        if (paras.length >= 2 && paras[paras.length - 1].length < 10 && paras[paras.length - 2].length > 50) {
          const { context } = extractContext(editorRef.current.innerHTML)
          fireEngine('scaffold', '', context, 'paragraph_complete')
        }
      }, 50)
    }
  }

  // Submit a prompt to the Interceptor (explicit prompt input at the bottom)
  async function handlePromptSubmit() {
    if (!project || !promptInput.trim() || !editorRef.current) return
    const html = editorRef.current.innerHTML
    const { context } = extractContext(html)
    const position = { top: captureCursorTop(scrollContentRef.current) }
    setEngineLoading('interceptor', true)
    try {
      const res = await api.interceptor(project.id, promptInput, context)
      if (res.action === 'pass') {
        toast('Prompt was not delegative — passed through')
      } else if (res.intervention) {
        pushPositionedIntervention(res.intervention, position)
        bumpAnalytics()
      }
      setPromptInput('')
    } catch (e) {
      toast.error('Interceptor failed', { description: (e as Error).message })
    } finally {
      setEngineLoading('interceptor', false)
    }
  }

  if (!project) return null

  const wordCount = htmlToText(editorRef.current?.innerHTML ?? '').split(/\s+/).filter(Boolean).length

  // Active engine indicators
  const activeEngines = (Object.keys(engineLoading) as EngineType[]).filter((e) => engineLoading[e])

  return (
    <div className="flex flex-col h-full" style={{ background: '#faf7f0' }}>
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
              <span className="flex items-center gap-1.5 text-amber-600">
                <Loader2 className="w-3 h-3 animate-spin" />
                {activeEngines.map((e) => {
                  const Icon = ENGINE_ICON[e]
                  return <Icon key={e} className="w-3 h-3" />
                })}
                analyzing…
              </span>
            </>
          )}
        </div>
      </div>

      {/* Scrollable writing surface + floating interventions */}
      <div className="flex-1 overflow-y-auto">
        <div ref={scrollContentRef} className="relative w-full max-w-[1000px] mx-auto px-8 py-16">
          {/* Title (inline editable) */}
          <h1
            contentEditable
            suppressContentEditableWarning
            className="text-4xl font-bold text-stone-900 mb-8 outline-none focus:outline-none text-center"
            style={{ fontFamily: 'var(--font-newsreader), Georgia, serif' }}
            data-placeholder="Untitled"
          />
          {/* Writing surface */}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            className={`outline-none focus:outline-none transition-opacity ${focusMode ? 'focus-within:[&_p:not(:last-child)]:opacity-40' : ''}`}
            style={{
              fontFamily: 'var(--font-newsreader), Georgia, serif',
              fontSize: '18px',
              lineHeight: 1.8,
              color: '#2a2520',
              maxWidth: '680px',
              margin: '0 auto',
              minHeight: '50vh',
            }}
            data-placeholder="Start writing here. Cogdoc analyzes every sentence and intervenes in the margin — questioning, challenging, and verifying."
          />
          {/* Floating interventions layer */}
          <FloatingInterventions />
        </div>
      </div>

      {/* Discreet prompt bar at the bottom */}
      <div className="border-t border-stone-200/50 px-6 py-2.5" style={{ background: '#fffefb' }}>
        <div className="max-w-[680px] mx-auto flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
          <Textarea
            value={promptInput}
            onChange={(e) => setPromptInput(e.target.value)}
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
            onClick={handlePromptSubmit}
            disabled={!promptInput.trim() || engineLoading.interceptor}
            className="bg-stone-800 hover:bg-stone-700 shrink-0 h-7 w-7"
          >
            {engineLoading.interceptor ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>
    </div>
  )
}
