'use client'

import { useCogdoc } from '@/lib/store'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { BookOpen, BarChart3, History, ArrowLeft, Focus, Eye, EyeOff } from 'lucide-react'
import Editor from './editor'
import ResearchLibrary from './research-library'
import AnalyticsPanel from './analytics-panel'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import type { Intervention } from '@/lib/types'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'

const ENGINE_LABELS: Record<string, string> = {
  interceptor: 'Interceptor',
  socratic: 'Socratic Spacer',
  citation: 'Citation Sentinel',
  scaffold: 'Scaffold',
}

const VERDICT_COLORS: Record<string, string> = {
  supported: 'text-emerald-700 bg-emerald-50',
  partially_supported: 'text-amber-700 bg-amber-50',
  unsupported: 'text-rose-700 bg-rose-50',
  insufficient_evidence: 'text-stone-600 bg-stone-50',
}

export default function EditorShell() {
  const project = useCogdoc((s) => s.activeProject)
  const setView = useCogdoc((s) => s.setView)
  const setActiveProject = useCogdoc((s) => s.setActiveProject)
  const activeModal = useCogdoc((s) => s.activeModal)
  const setActiveModal = useCogdoc((s) => s.setActiveModal)
  const focusMode = useCogdoc((s) => s.focusMode)
  const toggleFocusMode = useCogdoc((s) => s.toggleFocusMode)
  const analyticsVersion = useCogdoc((s) => s.analyticsVersion)

  const [history, setHistory] = useState<Intervention[]>([])

  function handleBack() {
    setActiveProject(null)
    setView('dashboard')
  }

  // Fetch history when the history modal opens
  useEffect(() => {
    if (activeModal === 'history' && project) {
      api.listInterventions(project.id).then(({ interventions }) => setHistory(interventions)).catch(() => {})
    }
  }, [activeModal, project, analyticsVersion])

  if (!project) return null

  return (
    <div className="h-screen flex flex-col" style={{ background: '#faf7f0' }}>
      {/* Minimal top bar */}
      <header className="border-b border-stone-200/50 px-6 py-2.5 flex items-center justify-between gap-4 shrink-0" style={{ background: '#fffefb' }}>
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="sm" onClick={handleBack} className="text-stone-500 hover:text-stone-900 h-8 px-2">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="min-w-0">
            <h1
              className="text-sm font-semibold text-stone-900 truncate max-w-xs"
              style={{ fontFamily: 'var(--font-newsreader), Georgia, serif' }}
            >
              {project.title}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost" size="sm"
            onClick={toggleFocusMode}
            className={`h-8 px-2.5 text-xs ${focusMode ? 'text-amber-700 bg-amber-50' : 'text-stone-500 hover:text-stone-900'}`}
            title="Focus mode — dims other paragraphs"
          >
            {focusMode ? <EyeOff className="w-3.5 h-3.5 mr-1" /> : <Focus className="w-3.5 h-3.5 mr-1" />}
            Focus
          </Button>
          <Button
            variant="ghost" size="sm"
            onClick={() => setActiveModal('library')}
            className="h-8 px-2.5 text-xs text-stone-500 hover:text-stone-900"
          >
            <BookOpen className="w-3.5 h-3.5 mr-1" /> Library
          </Button>
          <Button
            variant="ghost" size="sm"
            onClick={() => setActiveModal('stats')}
            className="h-8 px-2.5 text-xs text-stone-500 hover:text-stone-900"
          >
            <BarChart3 className="w-3.5 h-3.5 mr-1" /> Stats
          </Button>
          <Button
            variant="ghost" size="sm"
            onClick={() => setActiveModal('history')}
            className="h-8 px-2.5 text-xs text-stone-500 hover:text-stone-900"
          >
            <History className="w-3.5 h-3.5 mr-1" /> History
          </Button>
        </div>
      </header>

      {/* Editor fills the rest */}
      <div className="flex-1 min-h-0">
        <Editor />
      </div>

      {/* Library modal */}
      <Dialog open={activeModal === 'library'} onOpenChange={(o) => !o && setActiveModal('none')}>
        <DialogContent className="max-w-2xl max-h-[80vh] p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-stone-600" /> Research Library
            </DialogTitle>
          </DialogHeader>
          <div className="h-[60vh]">
            <ResearchLibrary />
          </div>
        </DialogContent>
      </Dialog>

      {/* Stats modal */}
      <Dialog open={activeModal === 'stats'} onOpenChange={(o) => !o && setActiveModal('none')}>
        <DialogContent className="max-w-md max-h-[80vh] p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-stone-600" /> Analytics
            </DialogTitle>
          </DialogHeader>
          <div className="h-[60vh]">
            <AnalyticsPanel />
          </div>
        </DialogContent>
      </Dialog>

      {/* History modal */}
      <Dialog open={activeModal === 'history'} onOpenChange={(o) => !o && setActiveModal('none')}>
        <DialogContent className="max-w-2xl max-h-[80vh] p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-stone-600" /> Intervention History
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh]">
            <div className="p-4 space-y-2">
              {history.length === 0 ? (
                <p className="text-sm text-stone-500 text-center py-8">No interventions yet.</p>
              ) : (
                history.map((i) => (
                  <div key={i.id} className="border border-stone-200 rounded-lg p-3 bg-white">
                    <div className="flex items-center justify-between mb-1.5">
                      <Badge variant="secondary" className="text-[10px]">
                        {ENGINE_LABELS[i.engineType] ?? i.engineType}
                      </Badge>
                      <div className="flex items-center gap-2">
                        {i.verdict && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${VERDICT_COLORS[i.verdict] ?? ''}`}>
                            {i.verdict.replace(/_/g, ' ')}
                          </span>
                        )}
                        {i.userAction && (
                          <span className="text-[10px] text-stone-400">{i.userAction}</span>
                        )}
                        <span className="text-[10px] text-stone-400">
                          {new Date(i.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                    {i.promptText && (
                      <p className="text-[11px] text-stone-500 italic mb-1 line-clamp-1">
                        &ldquo;{i.promptText.slice(0, 100)}&rdquo;
                      </p>
                    )}
                    <p className="text-sm text-stone-800 line-clamp-3">{i.responseText}</p>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  )
}
