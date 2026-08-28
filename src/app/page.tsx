'use client'

import { useEffect, useState } from 'react'
import { useCogdoc } from '@/lib/store'
import { configureSupabaseBrowser, supabase } from '@/lib/supabase-browser'
import Dashboard from '@/components/cogdoc/dashboard'
import EditorShell from '@/components/cogdoc/editor-shell'
import Login from '@/components/cogdoc/login'
import WorkspaceHome from '@/components/cogdoc/workspace-home'
import VerificationWorkspace from '@/components/cogdoc/verification-workspace'
import OnboardingTour from '@/components/cogdoc/onboarding-tour'
import { AuthConfigurationError, AuthLoading } from '@/components/cogdoc/auth-gate-state'

// Auth gate: when Supabase is configured, show Login until a session exists.
// In local dev with COGDOC_DEV_FALLBACK the route layer falls back to the
// default user; this client gate mirrors that (no session UI needed there).
type SessionGateStatus = 'loading' | 'authed' | 'anon' | 'misconfigured'

function useSessionGate() {
  const [status, setStatus] = useState<SessionGateStatus>('loading')
  useEffect(() => {
    let active = true
    fetch('/api/auth/config', { cache: 'no-store' })
      .then(async (response) => {
        const configuration = await response.json() as {
          mode?: string
          supabase?: { url?: string; publishableKey?: string }
        }
        if (!active) return
        if (!response.ok || configuration.mode === 'misconfigured') {
          setStatus('misconfigured')
          return
        }
        if (configuration.mode !== 'supabase') {
          setStatus('authed')
          return
        }
        const url = configuration.supabase?.url
        const key = configuration.supabase?.publishableKey
        if (!url || !key) {
          setStatus('misconfigured')
          return
        }
        configureSupabaseBrowser(url, key)
        const { data: { session } } = await supabase.auth.getSession()
        if (active) setStatus(session ? 'authed' : 'anon')
      })
      .catch(() => {
        if (active) setStatus('misconfigured')
      })
    return () => { active = false }
  }, [])
  return status
}

export default function Home() {
  const view = useCogdoc((s) => s.view)
  const activeProject = useCogdoc((s) => s.activeProject)
  const authStatus = useSessionGate()

  if (authStatus === 'loading') return <AuthLoading />
  if (authStatus === 'misconfigured') return <AuthConfigurationError />
  if (authStatus === 'anon') return <Login />

  let content = <Dashboard />
  if (view === 'editor' && activeProject) content = <EditorShell />
  if (view === 'workspace' && activeProject) content = <WorkspaceHome />
  if (view === 'verification' && activeProject) content = <VerificationWorkspace />
  return <>{content}<OnboardingTour /></>
}
