'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { useCogdoc } from '@/lib/store'
import { api } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Sparkles,
  ShieldCheck,
  ListTree,
  Send,
  Loader2,
  Quote,
  Clock,
  Check,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

// Default idle threshold (ms). The actual value is fetched from /api/settings
// on mount so the Docker wizard's IDLE_THRESHOLD env var flows through at
// runtime (NEXT_PUBLIC_* would be inlined at build time, which is too early).
const DEFAULT_IDLE_THRESHOLD_MS = 2_000 // 2 seconds — instant feedback

// Debounce: minimum gap between two Socratic Spacer fires. Prevents the
// engine from spamming when the writer is typing rapidly or finishing
// several sentences in quick succession.
const SOCRATIC_DEBOUNCE_MS = 3_000 // 3 seconds between fires

/**
 * Extract plain text from HTML for AI context.
 */
function htmlToText(html: string): string {
  const div = document.createElement('div')
  div.innerHTML = html
  return (div.textContent ?? '').trim()
}

/**
 * Get the last N paragraphs of plain text from the editor content,
 * plus the current "stub" (text after the last paragraph break in the active paragraph).
 */
function extractContext(html: string): { context: string; stub: string } {
  const text = htmlToText(html)
  // Split on double newlines (paragraph breaks in contenteditable)
  const paras = text.split(/\n\s*\n/).filter((p) => p.trim())
  if (paras.length === 0) return { context: '', stub: text }
  const last3 = paras.slice(-3).join('\n\n')
  const last = paras[paras.length - 1]
  return { context: last3, stub: last }
}

export default function Editor() {
  const project = useCogdoc((s) => s.activeProject)
  const updateActiveProjectContent = useCogdoc((s) => s.updateActiveProjectContent)
  const pushIntervention = useCogdoc((s) => s.pushIntervention)
  const socraticLoading = useCogdoc((s) => s.socraticLoading)
  const setSocraticLoading = useCogdoc((s) => s.setSocraticLoading)
  const citationLoading = useCogdoc((s) => s.citationLoading)
  const setCitationLoading = useCogdoc((s) => s.setCitationLoading)
  const interceptorLoading = useCogdoc((s) => s.interceptorLoading)
  const setInterceptorLoading = useCogdoc((s) => s.setInterceptorLoading)
  const bumpLibrary = useCogdoc((s) => s.bumpLibrary)
  const bumpAnalytics = useCogdoc((s) => s.bumpAnalytics)

  const editorRef = useRef<HTMLDivElement>(null)
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null)
  const lastIdleFireRef = useRef<number>(0)
  const [promptInput, setPromptInput] = useState('')
  const [selectedText, setSelectedText] = useState('')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(
    project?.document?.lastSaved ?? null,
  )
  // Runtime idle threshold (ms), fetched from /api/settings so the Docker
  // wizard's IDLE_THRESHOLD env var takes effect without a rebuild.
  const [idleThresholdMs, setIdleThresholdMs] = useState<number>(DEFAULT_IDLE_THRESHOLD_MS)

  // Fetch runtime settings on mount
  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.idleThresholdSeconds === 'number' && d.idleThresholdSeconds > 0) {
          setIdleThresholdMs(d.idleThresholdSeconds * 1000)
        }
      })
      .catch(() => {/* fall back to default */})
  }, [])

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
        } catch (e) {
          toast.error('Auto-save failed', { description: (e as Error).message })
          setSaveState('idle')
        }
      }, 1500)
    },
    [project, updateActiveProjectContent],
  )

  // Fire the Socratic Spacer. Shared between the idle timer and the
  // sentence-completion trigger. Returns true if it actually fired.
  const fireSocraticSpacer = useCallback(
    async (reason: 'idle' | 'sentence') => {
      if (!project || !editorRef.current) return false
      const now = Date.now()
      // Debounce: don't fire again within SOCRATIC_DEBOUNCE_MS of the last fire
      if (now - lastIdleFireRef.current < SOCRATIC_DEBOUNCE_MS) return false
      lastIdleFireRef.current = now

      const html = editorRef.current.innerHTML
      const { context, stub } = extractContext(html)
      if (!context.trim() || context.length < 30) return false // need real content

      setSocraticLoading(true)
      try {
        const res = await api.socraticSpacer(project.id, context, stub)
        pushIntervention(res.intervention)
        bumpAnalytics()
        toast('A ghost question appeared in the margin', {
          description:
            reason === 'sentence'
              ? 'Triggered by sentence completion.'
              : 'Triggered by idle pause.',
        })
        return true
      } catch (e) {
        // Silent fail — Socratic Spacer must never block the writer
        console.error('Socratic Spacer failed:', e)
        return false
      } finally {
        setSocraticLoading(false)
      }
    },
    [project, pushIntervention, setSocraticLoading, bumpAnalytics],
  )

  // Idle detector — fires Socratic Spacer after `idleThresholdMs` of no input
  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    idleTimerRef.current = setTimeout(() => fireSocraticSpacer('idle'), idleThresholdMs)
  }, [fireSocraticSpacer, idleThresholdMs])

  // Track text selection (for Citation Sentinel verify button)
  useEffect(() => {
    function onSelection() {
      const sel = window.getSelection()
      if (sel && sel.toString().trim().length > 10) {
        setSelectedText(sel.toString().trim())
      } else {
        setSelectedText('')
      }
    }
    document.addEventListener('selectionchange', onSelection)
    return () => document.removeEventListener('selectionchange', onSelection)
  }, [])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    }
  }, [])

  // Handle editor input. Fires on every keystroke.
  // 1. Schedules auto-save (debounced 1.5s)
  // 2. Resets the 2-second idle timer (fires Socratic Spacer if writer pauses mid-sentence)
  // 3. Detects sentence completion (`.`, `?`, `!` as the last typed character)
  //    and fires Socratic Spacer immediately — no idle wait required.
  function handleInput() {
    if (!editorRef.current) return
    const html = editorRef.current.innerHTML
    scheduleSave(html)
    resetIdleTimer()

    // Sentence-completion trigger: if the last non-whitespace character of the
    // editor text is a sentence-ending punctuation mark, fire the Socratic
    // Spacer immediately. The debounce inside fireSocraticSpacer prevents
    // rapid-fire when several sentences are typed in quick succession.
    const text = htmlToText(html)
    const lastChar = text.trim().slice(-1)
    if (lastChar === '.' || lastChar === '?' || lastChar === '!') {
      fireSocraticSpacer('sentence')
    }
  }

  // Submit a prompt to the Interceptor
  async function handlePromptSubmit() {
    if (!project || !promptInput.trim() || !editorRef.current) return
    const html = editorRef.current.innerHTML
    const { context } = extractContext(html)
    setInterceptorLoading(true)
    try {
      const res = await api.interceptor(project.id, promptInput, context)
      if (res.action === 'pass') {
        toast('Prompt was not delegative — passed through', {
          description: 'Cogdoc only intervenes on prompts that ask it to write content for you.',
        })
      } else if (res.intervention) {
        pushIntervention(res.intervention)
        bumpAnalytics()
        toast('Interceptor caught a delegative prompt', {
          description: 'A Socratic question has appeared in the margin.',
        })
      }
      setPromptInput('')
    } catch (e) {
      toast.error('Interceptor failed', { description: (e as Error).message })
    } finally {
      setInterceptorLoading(false)
    }
  }

  // Verify a selected claim via Citation Sentinel
  async function handleVerifyClaim() {
    if (!project || !selectedText.trim()) return
    setCitationLoading(true)
    try {
      const res = await api.citationSentinel(project.id, selectedText)
      pushIntervention(res.intervention)
      bumpAnalytics()
      bumpLibrary()
      toast(`Verdict: ${res.verdict.replace(/_/g, ' ')}`, {
        description: res.explanation.slice(0, 120),
      })
    } catch (e) {
      toast.error('Citation Sentinel failed', { description: (e as Error).message })
    } finally {
      setCitationLoading(false)
    }
  }

  // Request a structural scaffold
  async function handleScaffold() {
    if (!project || !editorRef.current) return
    const html = editorRef.current.innerHTML
    const { context } = extractContext(html)
    setInterceptorLoading(true)
    try {
      const res = await api.scaffold(
        project.id,
        'Give me a structural scaffold for this paragraph.',
        context,
      )
      pushIntervention(res.intervention)
      bumpAnalytics()
      toast('Structural scaffold added to the margin')
    } catch (e) {
      toast.error('Scaffold failed', { description: (e as Error).message })
    } finally {
      setInterceptorLoading(false)
    }
  }

  if (!project) return null

  const wordCount = htmlToText(editorRef.current?.innerHTML ?? '').split(/\s+/).filter(Boolean).length

  return (
    <div className="flex flex-col h-full bg-stone-50">
      {/* Editor toolbar */}
      <div className="border-b border-stone-200 bg-white px-6 py-2 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 text-xs text-stone-500">
          {saveState === 'saving' ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" /> Saving...
            </span>
          ) : saveState === 'saved' ? (
            <span className="flex items-center gap-1.5 text-emerald-600">
              <Check className="w-3 h-3" /> Saved
            </span>
          ) : lastSavedAt ? (
            <span className="flex items-center gap-1.5">
              <Clock className="w-3 h-3" /> Saved {new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          ) : (
            <span>Not saved yet</span>
          )}
          <Separator orientation="vertical" className="h-4" />
          <span>{wordCount} words</span>
          {socraticLoading && (
            <>
              <Separator orientation="vertical" className="h-4" />
              <span className="flex items-center gap-1.5 text-amber-600">
                <Sparkles className="w-3 h-3 animate-pulse" /> Socratic Spacer thinking...
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {selectedText && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleVerifyClaim}
              disabled={citationLoading}
              className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
            >
              {citationLoading ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
              )}
              Verify Claim
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={handleScaffold}
            disabled={interceptorLoading}
            className="border-stone-300 text-stone-700 hover:bg-stone-100"
          >
            <ListTree className="w-3.5 h-3.5 mr-1.5" />
            Scaffold
          </Button>
        </div>
      </div>

      {/* The actual editor — contenteditable */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-8 py-12">
          <h1
            contentEditable
            suppressContentEditableWarning
            className="text-3xl font-bold text-stone-900 mb-6 outline-none focus:outline-none"
            data-placeholder="Untitled"
          />
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleInput}
            className="min-h-[60vh] outline-none focus:outline-none text-stone-800 text-[17px] leading-[1.75]
                       [&_p]:mb-4
                       [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-stone-900
                       [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-stone-900
                       [&_blockquote]:border-l-4 [&_blockquote]:border-stone-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-stone-600
                       [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4
                       [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-4
                       empty:before:content-[attr(data-placeholder)] empty:before:text-stone-400"
            data-placeholder="Start writing here. The AI will only intervene — never write for you."
          />
        </div>
      </div>

      {/* Prompt input strip — the only place to talk to the AI */}
      <div className="border-t border-stone-200 bg-white px-6 py-3">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 shrink-0">
              <Sparkles className="w-3 h-3 mr-1" />
              Ask Cogdoc
            </Badge>
            <Textarea
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              placeholder="Type a prompt. If it's delegative (e.g. 'write a paragraph about X'), the Interceptor will reframe it as a Socratic question."
              rows={1}
              className="resize-none min-h-[40px] max-h-[120px] border-stone-200 focus-visible:ring-stone-400"
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
              disabled={!promptInput.trim() || interceptorLoading}
              className="bg-stone-900 hover:bg-stone-800 shrink-0"
            >
              {interceptorLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
          {selectedText && (
            <div className="mt-2 flex items-center gap-2 text-xs text-stone-500">
              <Quote className="w-3 h-3" />
              <span className="italic truncate flex-1">
                Selected: &ldquo;{selectedText.slice(0, 80)}{selectedText.length > 80 ? '...' : ''}&rdquo;
              </span>
              <button
                onClick={() => setSelectedText('')}
                className="hover:text-stone-700"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
