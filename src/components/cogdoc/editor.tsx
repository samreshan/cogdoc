'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { useCogdoc } from '@/lib/store'
import { api } from '@/lib/api-client'
import { analyzeSentence, extractLastSentence, ENGINE_COOLDOWNS } from '@/lib/content-analyzer'
import { getCooldown } from '@/lib/friction'
import { useDevilsAutocomplete } from '@/lib/use-devils-autocomplete'
import { consumeInterceptorStream } from '@/lib/ai-gateway'
import { highlightSentences } from '@/lib/sentence-highlight'
import type { EngineType, Intervention } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Send, Loader2, Clock, Check, Sparkles, ShieldCheck, ListTree, BookOpen,
} from 'lucide-react'
import { toast } from 'sonner'
import SentencePopover from './sentence-popover'
import RunningPets, { IdlePetBadge } from './running-pets'
import { ENGINE_CHARACTERS } from '@/lib/engine-characters'

const IDLE_THRESHOLD_MS = 2_000 // 2s idle → Socratic Spacer
const SOCRATIC_DEBOUNCE_MS = 3_000
const HIGHLIGHT_DEBOUNCE_MS = 2_500 // 2.5s after last keystroke → re-highlight (longer = fewer cursor jumps)

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

const ENGINE_ICON: Record<EngineType, typeof Sparkles> = {
  socratic: BookOpen, interceptor: Sparkles, citation: ShieldCheck, scaffold: ListTree,
}

export default function Editor() {
  const project = useCogdoc((s) => s.activeProject)
  const updateActiveProjectContent = useCogdoc((s) => s.updateActiveProjectContent)
  const pushIntervention = useCogdoc((s) => s.pushIntervention)
  const activeInterventions = useCogdoc((s) => s.activeInterventions)
  const engineLoading = useCogdoc((s) => s.engineLoading)
  const setEngineLoading = useCogdoc((s) => s.setEngineLoading)
  const bumpAnalytics = useCogdoc((s) => s.bumpAnalytics)
  const focusMode = useCogdoc((s) => s.focusMode)
  const setHovered = useCogdoc((s) => s.setHovered)
  const frictionMode = useCogdoc((s) => s.frictionMode)
  const blindspotShown = useCogdoc((s) => s.blindspotShownThisSession)
  const markBlindspotShown = useCogdoc((s) => s.markBlindspotShown)

  const editorRef = useRef<HTMLDivElement>(null)
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null)
  const highlightTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isHighlightingRef = useRef(false)
  const lastHighlightedIdsRef = useRef<string>('')
  const lastFireRef = useRef<Record<EngineType, number>>({
    socratic: 0, interceptor: 0, citation: 0, scaffold: 0,
  })

  const [promptInput, setPromptInput] = useState('')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(
    project?.document?.lastSaved ?? null,
  )

  // Devil's Autocomplete ghost-text state (§7.1). The hook is isolated so the
  // Tiptap port (Phase 5) swaps only the rendering layer (a Decoration), not
  // the commit-mechanic logic. Fetches a short continuation as the user writes.
  const autocomplete = useDevilsAutocomplete(frictionMode)

  // Load initial content
  useEffect(() => {
    if (editorRef.current && project?.document?.content !== undefined) {
      editorRef.current.innerHTML = project.document.content || ''
    }
    setLastSavedAt(project?.document?.lastSaved ?? null)
  }, [project?.id])

  // Re-highlight when active interventions change
  useEffect(() => {
    if (!editorRef.current || isHighlightingRef.current) return
    scheduleHighlight()
  }, [activeInterventions])

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

  // Schedule sentence highlighting (debounced 2.5s)
  const scheduleHighlight = useCallback(() => {
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current)
    highlightTimerRef.current = setTimeout(() => {
      if (!editorRef.current) return
      // Skip if the set of active intervention IDs hasn't changed since
      // the last highlight (avoids redundant DOM manipulation + cursor jumps)
      const currentIds = activeInterventions
        .filter((i) => i.status === 'active')
        .map((i) => i.id)
        .sort()
        .join(',')
      if (currentIds === lastHighlightedIdsRef.current) return
      lastHighlightedIdsRef.current = currentIds
      isHighlightingRef.current = true
      highlightSentences(editorRef.current, activeInterventions)
      isHighlightingRef.current = false
    }, HIGHLIGHT_DEBOUNCE_MS)
  }, [activeInterventions])

  // ── Unified engine fire function ──────────────────────────────────────
  const fireEngine = useCallback(
    async (engine: EngineType, sentence: string, context: string, reason: string) => {
      if (!project || !editorRef.current) return

      const now = Date.now()
      // Friction §9: cooldown scales with the user's chosen mode (socratic full
      // → assistant light). getCooldown multiplies the base engine cooldown by
      // the mode's COOLDOWN_SCALE. The idle-threshold default stays at the 2s
      // debug value until the Tiptap swap (Phase 5) brings the real 45s.
      // TODO(phase5): idle = getCooldown('socratic', frictionMode) at 45s base.
      if (now - lastFireRef.current[engine] < getCooldown(engine, frictionMode)) return
      lastFireRef.current[engine] = now

      if (engine === 'socratic' && now - lastFireRef.current.socratic < SOCRATIC_DEBOUNCE_MS) {
        return
      }

      // For Socratic idle trigger, use the last completed sentence so it
      // can be linked to a sentence in the editor (for underlining)
      let effectiveSentence = sentence
      if (engine === 'socratic' && !effectiveSentence) {
        const text = htmlToText(editorRef.current.innerHTML)
        effectiveSentence = extractLastSentence(text)
        if (!effectiveSentence) return
      }

      setEngineLoading(engine, true)

      try {
        let intervention: Intervention | null = null
        if (engine === 'citation') {
          const res = await api.citationSentinel(project.id, effectiveSentence, undefined, frictionMode)
          intervention = res.intervention
        } else if (engine === 'interceptor') {
          // Phase 3 (ADR-0007): stream the interceptor token-by-token from
          // FastAPI when reachable; persist the assembled text on done via the
          // existing blocking route. Falls back to the blocking path on error.
          // TODO(phase-sse): stream the other engines the same way.
          let streamed: Intervention | null = null
          try {
            const stream = await consumeInterceptorStream(
              { project_id: project.id, prompt: effectiveSentence, context, friction_mode: frictionMode },
              (partial) => {
                // live render: push a transient streaming intervention
                toast(`✦ ${partial}`, { id: 'interceptor-stream', duration: 1200 })
              },
            )
            // persist the assembled text on done (FastAPI has no DB client)
            const res = await api.interceptor(project.id, effectiveSentence, context, undefined, frictionMode)
            if (res.action === 'pass') {
              setEngineLoading(engine, false)
              return
            }
            streamed = res.intervention
            if (stream.errorCode) {
              toast.error('Interceptor response replaced (non-generation guard)')
            }
            intervention = streamed
          } catch {
            // network drop / FastAPI down → blocking fallback
            const res = await api.interceptor(project.id, effectiveSentence, context, undefined, frictionMode)
            if (res.action === 'pass') {
              setEngineLoading(engine, false)
              return
            }
            intervention = res.intervention
          }
        } else if (engine === 'scaffold') {
          const res = await api.scaffold(project.id, 'Provide a structural scaffold for my next paragraph.', context, undefined, frictionMode)
          intervention = res.intervention
        } else {
          // socratic — pass the sentence as stub so it's stored as promptText
          const res = await api.socraticSpacer(project.id, context, effectiveSentence, undefined, frictionMode)
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
    [project, pushIntervention, setEngineLoading, bumpAnalytics, frictionMode],
  )

  // ── Blindspot Monitor (§7.2) ───────────────────────────────────────────
  // Surfaces ONE overlooked library passage per session (anti-fatigue). Fires
  // after the user completes a substantial paragraph, once per project session.
  const checkBlindspot = useCallback(
    (draft: string) => {
      if (!project || blindspotShown) return
      if (draft.split(/\s+/).filter(Boolean).length < 30) return // need real draft
      api.blindspot(project.id, draft)
        .then((res) => {
          if (res.blindspot && res.intervention) {
            pushIntervention(res.intervention)
            bumpAnalytics()
            markBlindspotShown()
          }
        })
        .catch(() => {})
    },
    [project, blindspotShown, pushIntervention, bumpAnalytics, markBlindspotShown],
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
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current)
    }
  }, [])

  // ── Handle every keystroke ────────────────────────────────────────────
  function handleInput() {
    if (isHighlightingRef.current) return // ignore input events triggered by highlighting
    if (!editorRef.current) return
    const html = editorRef.current.innerHTML
    scheduleSave(html)
    resetIdleTimer()
    scheduleHighlight()

    const text = htmlToText(html)

    // Devil's Autocomplete (§7.1): if a ghost is showing, try to commit the
    // typed char; otherwise debounce-load a new suggestion as the user writes.
    const lastChar = text.slice(-1)
    if (autocomplete.suggestion && lastChar) {
      autocomplete.typeCommit(lastChar)
    } else if (project && text.length > 0 && text.length % 8 === 0) {
      // Lightweight debounce-by-growth: load a new suggestion periodically.
      autocomplete.load(project.id, text).catch(() => {})
    }

    // Sentence completion: `.`, `?`, `!` as the last typed character
    const endChar = text.trim().slice(-1)
    if (endChar === '.' || endChar === '?' || endChar === '!') {
      const sentence = extractLastSentence(text)
      if (sentence.split(/\s+/).length >= 4) {
        const { context } = extractContext(html)
        // Fire ALL matching engines — multiple can fire on the same sentence.
        // Stagger them by 500ms to avoid LLM rate-limiting (429).
        const analysis = analyzeSentence(sentence)
        analysis.engines.forEach((engine, idx) => {
          setTimeout(() => {
            fireEngine(engine, sentence, context, analysis.reasons[engine])
          }, idx * 500)
        })
      }
    }
  }

  // Handle keyboard shortcuts
  function handleKeyDown(e: React.KeyboardEvent) {
    // Enter → paragraph completion (Scaffold) + Blindspot check (one per session)
    if (e.key === 'Enter' && !e.shiftKey) {
      setTimeout(() => {
        if (!editorRef.current) return
        const text = htmlToText(editorRef.current.innerHTML)
        const paras = text.split(/\n\s*\n/).filter((p) => p.trim())
        if (paras.length >= 2 && paras[paras.length - 1].length < 10 && paras[paras.length - 2].length > 50) {
          const { context } = extractContext(editorRef.current.innerHTML)
          fireEngine('scaffold', '', context, 'paragraph_complete')
          // Blindspot: check the full draft for overlooked passages, once/session.
          checkBlindspot(text)
        }
      }, 50)
    }

    // Tab → Devil's Autocomplete accept (mode-gated; socratic/coach reject)
    if (e.key === 'Tab' && autocomplete.suggestion) {
      e.preventDefault()
      autocomplete.tabAccept()
      return
    }

    // Cmd/Ctrl+B → bold, Cmd/Ctrl+I → italic, Cmd/Ctrl+U → underline
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
      const key = e.key.toLowerCase()
      if (key === 'b' || key === 'i' || key === 'u') {
        e.preventDefault()
        document.execCommand(key === 'b' ? 'bold' : key === 'i' ? 'italic' : 'underline', false)
        if (editorRef.current) scheduleSave(editorRef.current.innerHTML)
      }
    }

    // Esc → clear selection (closes any open popover via the hover state)
    if (e.key === 'Escape') {
      window.getSelection()?.removeAllRanges()
    }
  }

  // ── Hover handling for sentence marks ─────────────────────────────────
  function handleMouseOver(e: React.MouseEvent) {
    const target = e.target as HTMLElement
    if (target.classList?.contains('cogdoc-mark')) {
      const key = target.dataset.sentenceKey
      if (!key) return
      const rect = target.getBoundingClientRect()
      setHovered(key, { top: rect.bottom, left: rect.left })
    }
  }

  function handleMouseOut(e: React.MouseEvent) {
    const target = e.target as HTMLElement
    const related = e.relatedTarget as HTMLElement | null
    if (target.classList?.contains('cogdoc-mark')) {
      // Only hide if not moving to the popover
      if (!related?.closest('[data-sentence-popover]')) {
        // Delay hide to allow moving cursor into popover
        setTimeout(() => {
          // The popover's own mouseenter will cancel this by setting hoveredKey
          // We check if the current hovered key is still this one
          // This is handled by the popover's onMouseEnter setting popoverHovered
        }, 100)
      }
    }
  }

  // Submit a prompt to the Interceptor
  async function handlePromptSubmit() {
    if (!project || !promptInput.trim() || !editorRef.current) return
    const html = editorRef.current.innerHTML
    const { context } = extractContext(html)
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

  if (!project) return null

  const wordCount = htmlToText(editorRef.current?.innerHTML ?? '').split(/\s+/).filter(Boolean).length
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
          {/* Writing surface */}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onMouseOver={handleMouseOver}
            onMouseOut={handleMouseOut}
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
            data-placeholder="Start writing here. Cogdoc analyzes every sentence — interventions appear as underlines you can hover to read."
          />
          {/* Devil's Autocomplete ghost text (§7.1). Shown inline beneath the
              caret line as greyed text. The commit mechanic is mode-gated:
              socratic/coach must type each char (Tab is rejected); assistant
              allows Tab-accept. Phase 5 ports this to a Tiptap Decoration. */}
          {autocomplete.suggestion && (
            <div
              className="max-w-[680px] mx-auto -mt-2 pointer-events-none select-none"
              style={{ fontFamily: 'var(--font-newsreader), Georgia, serif', fontSize: '18px', lineHeight: 1.8 }}
              aria-label="autocomplete suggestion"
            >
              <span style={{ color: '#b8b0a4' }}>
                {autocomplete.suggestion}
              </span>
              <span className="ml-2 text-[10px] text-stone-400 align-middle">
                {frictionMode === 'assistant' ? 'Tab to accept' : 'type to continue'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Discreet prompt bar */}
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

      {/* Hover popover (renders outside the scrollable area) */}
      <div data-sentence-popover>
        <SentencePopover />
      </div>

      {/* Running pixelated pets — animate across the screen when engines fire */}
      <RunningPets />
    </div>
  )
}
