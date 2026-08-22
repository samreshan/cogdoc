'use client'

import { useEffect, useState } from 'react'
import { useCogdoc } from '@/lib/store'
import { supabase } from '@/lib/supabase-browser'
import Dashboard from '@/components/cogdoc/dashboard'
import EditorShell from '@/components/cogdoc/editor-shell'
import Login from '@/components/cogdoc/login'
import WorkspaceHome from '@/components/cogdoc/workspace-home'
import VerificationWorkspace from '@/components/cogdoc/verification-workspace'

// Auth gate: when Supabase is configured, show Login until a session exists.
// In local dev with COGDOC_DEV_FALLBACK the route layer falls back to the
// default user; this client gate mirrors that (no session UI needed there).
function useSessionGate() {
  const [status, setStatus] = useState<'loading' | 'authed' | 'anon'>('loading')
  useEffect(() => {
    // If Supabase isn't configured (local dev without env), skip the gate.
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      setStatus('authed')
      return
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      setStatus(session ? 'authed' : 'anon')
    })
  }, [])
  return status
}

export default function Home() {
  const view = useCogdoc((s) => s.view)
  const activeProject = useCogdoc((s) => s.activeProject)
  const authStatus = useSessionGate()

  if (authStatus === 'loading') return null
  if (authStatus === 'anon') return <Login />

  if (view === 'editor' && activeProject) {
    return <EditorShell />
  }
  if (view === 'workspace' && activeProject) return <WorkspaceHome />
  if (view === 'verification' && activeProject) return <VerificationWorkspace />
  return <Dashboard />
}
