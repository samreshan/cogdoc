'use client'

import { useCogdoc } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, BookOpen, Sparkles, BarChart3, PanelRightClose, PanelRight } from 'lucide-react'
import Editor from './editor'
import LivingMargin from './living-margin'
import ResearchLibrary from './research-library'
import AnalyticsPanel from './analytics-panel'

export default function EditorShell() {
  const project = useCogdoc((s) => s.activeProject)
  const setView = useCogdoc((s) => s.setView)
  const rightTab = useCogdoc((s) => s.rightTab)
  const setRightTab = useCogdoc((s) => s.setRightTab)
  const leftPanelCollapsed = useCogdoc((s) => s.leftPanelCollapsed)
  const toggleLeftPanel = useCogdoc((s) => s.toggleLeftPanel)
  const interventions = useCogdoc((s) => s.activeInterventions)
  const setActiveProject = useCogdoc((s) => s.setActiveProject)

  function handleBack() {
    setActiveProject(null)
    setView('dashboard')
  }

  if (!project) return null

  const activeInterventionCount = interventions.length

  return (
    <div className="h-screen flex flex-col bg-stone-100">
      {/* Top bar */}
      <header className="border-b border-stone-200 bg-white px-4 py-2.5 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="sm" onClick={handleBack} className="text-stone-600 hover:text-stone-900">
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Projects
          </Button>
          <Separator orientation="vertical" className="h-5" />
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-stone-900 truncate max-w-md">{project.title}</h1>
            {project.description && (
              <p className="text-[11px] text-stone-500 truncate max-w-md">{project.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleLeftPanel}
            className="text-stone-500 hover:text-stone-900"
            title={leftPanelCollapsed ? 'Show right panel' : 'Hide right panel'}
          >
            {leftPanelCollapsed ? <PanelRight className="w-4 h-4" /> : <PanelRightClose className="w-4 h-4" />}
          </Button>
        </div>
      </header>

      {/* Main content — editor + right panel */}
      <div className="flex-1 flex min-h-0">
        <div className="flex-1 min-w-0 bg-white">
          <Editor />
        </div>

        {!leftPanelCollapsed && (
          <>
            <Separator orientation="vertical" />
            <aside className="w-[380px] shrink-0 bg-stone-50 flex flex-col">
              <Tabs value={rightTab} onValueChange={(v) => setRightTab(v as typeof rightTab)} className="w-full">
                <div className="border-b border-stone-200 bg-white px-2 pt-2">
                  <TabsList className="grid grid-cols-3 w-full h-9 bg-stone-100">
                    <TabsTrigger value="margin" className="text-xs gap-1.5 data-[state=active]:bg-white">
                      <Sparkles className="w-3 h-3" />
                      Margin
                      {activeInterventionCount > 0 && (
                        <span className="ml-0.5 bg-amber-100 text-amber-700 text-[10px] font-medium rounded-full px-1.5 py-0 leading-4">
                          {activeInterventionCount}
                        </span>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="library" className="text-xs gap-1.5 data-[state=active]:bg-white">
                      <BookOpen className="w-3 h-3" />
                      Library
                    </TabsTrigger>
                    <TabsTrigger value="analytics" className="text-xs gap-1.5 data-[state=active]:bg-white">
                      <BarChart3 className="w-3 h-3" />
                      Stats
                    </TabsTrigger>
                  </TabsList>
                </div>

                {rightTab === 'margin' && <LivingMargin />}
                {rightTab === 'library' && <ResearchLibrary />}
                {rightTab === 'analytics' && <AnalyticsPanel />}
              </Tabs>
            </aside>
          </>
        )}
      </div>
    </div>
  )
}
