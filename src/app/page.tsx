'use client'

import { useCogdoc } from '@/lib/store'
import Dashboard from '@/components/cogdoc/dashboard'
import EditorShell from '@/components/cogdoc/editor-shell'

export default function Home() {
  const view = useCogdoc((s) => s.view)
  const activeProject = useCogdoc((s) => s.activeProject)

  if (view === 'editor' && activeProject) {
    return <EditorShell />
  }
  return <Dashboard />
}
