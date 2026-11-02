'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { LIVE_GUIDE_EVENT, LIVE_GUIDE_STEPS, nextGuideStep, readGuideProgress, registerLiveGuide } from '@/lib/live-research-guide'

const subscribe = (notify: () => void) => {
  window.addEventListener(LIVE_GUIDE_EVENT, notify)
  window.addEventListener('storage', notify)
  return () => { window.removeEventListener(LIVE_GUIDE_EVENT, notify); window.removeEventListener('storage', notify) }
}
export default function LiveResearchGuide({ projectId, home = false }: { projectId?: string; home?: boolean }) {
  const snapshot = useSyncExternalStore(subscribe, () => JSON.stringify(projectId ? readGuideProgress(projectId) : []), () => '[]')
  const mounted = useSyncExternalStore(subscribe, () => true, () => false)
  const completed: string[] = JSON.parse(snapshot)
  const step = home ? { id: 'home', target: 'research-topic', title: 'Start with your own research question', body: 'The Java and Kubernetes topic and goal are editable starting points. Choose Start writing to create a real saved project. The document, search, AI tools, findings, and export will all work normally. This explanation disappears in eight seconds so you can try it yourself.' } : nextGuideStep(completed)
  useEffect(() => { if (projectId) registerLiveGuide(projectId) }, [projectId])
  if (!mounted) return null
  return <GuideCard key={step?.id ?? 'complete'} step={step} completed={completed.length} home={home} />
}
function GuideCard({ step, completed, home }: { step?: { id: string; target: string; title: string; body: string }; completed: number; home: boolean }) {
  const [expanded, setExpanded] = useState(true)
  const [pinned, setPinned] = useState(false)
  const [rect, setRect] = useState<DOMRect | null>(null)
  useEffect(() => {
    if (!expanded || pinned) return
    const timer = window.setTimeout(() => setExpanded(false), 8000)
    return () => window.clearTimeout(timer)
  }, [expanded, pinned, step?.id])
  useEffect(() => {
    if (!expanded || !step) return
    const measure = () => {
      const candidates = document.querySelectorAll<HTMLElement>(`[data-demo-target="${step.target}"]`)
      const target = Array.from(candidates).find((node) => node.getBoundingClientRect().width > 0)
      setRect(target?.getBoundingClientRect() ?? null)
    }
    const frame = window.requestAnimationFrame(measure)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    const observer = new MutationObserver(measure)
    // Child mounting changes the target; do not observe coach style mutations.
    observer.observe(document.getElementById('main-content') ?? document.body, { childList: true, subtree: true })
    return () => { window.cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true) }
  }, [expanded, step?.target])
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setExpanded(false) }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [])
  return createPortal(<>
    {expanded && rect ? <div aria-hidden className="pointer-events-none fixed z-[90] rounded-xl border-2 border-violet-500 shadow-[0_0_0_4px_rgba(139,92,246,0.12)]" style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }} /> : null}
    <aside aria-label="Live research guide" className="pointer-events-auto fixed bottom-16 left-3 sm:left-64 z-[100] max-h-[calc(100dvh-2rem)] max-w-[min(24rem,calc(100vw-1.5rem))] overflow-y-auto rounded-xl border border-violet-200 bg-white p-4 text-slate-800 shadow-lg">
      <div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold text-violet-800">Live research guide{!home ? ` · ${completed}/${LIVE_GUIDE_STEPS.length}` : ''}</p><Button size="sm" variant="ghost" onClick={() => setExpanded(!expanded)}>{expanded ? 'Try it myself' : 'Show guidance'}</Button></div>
      {expanded ? <><h2 className="mt-2 text-base font-semibold">{step?.title ?? 'Your guided research journey is complete'}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{step?.body ?? 'Keep researching in this saved project. All your sources, writing, findings, and AI conversations remain available.'}</p><div className="mt-3 flex gap-3"><Button size="sm" variant="outline" onClick={() => setPinned(!pinned)}>{pinned ? 'Auto-hide after 8 seconds' : 'Keep explanation open'}</Button></div><p className="mt-3 text-xs text-slate-500">Work in any order. Successful actions count even with this guide collapsed. Starter text is labelled. AI changes and finding reviews remain your decision.</p></> : <p className="mt-1 text-xs text-slate-500">{step?.title ?? 'Complete — continue working freely'}</p>}
    </aside>
  </>, document.body)
}
