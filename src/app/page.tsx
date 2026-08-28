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

function AuthConfigurationError() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#faf7f0] px-6">
      <section className="max-w-lg rounded-xl border border-amber-200 bg-white p-8 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber-700">Setup required</p>
        <h1 className="mt-3 font-serif text-2xl font-semibold text-stone-900">Authentication is not configured</h1>
        <p className="mt-3 text-sm leading-6 text-stone-600">
          Configure Supabase authentication for a shared deployment, or explicitly enable private single-user mode for a one-person installation.
        </p>
        <p className="mt-4 rounded-lg bg-stone-50 px-4 py-3 font-mono text-xs text-stone-600">
          COGDOC_SINGLE_USER_MODE=1
        </p>
      </section>
    </main>
  )
}

export default function Home() {
  const view = useCogdoc((s) => s.view)
  const activeProject = useCogdoc((s) => s.activeProject)
  const authStatus = useSessionGate()

  if (authStatus === 'loading') return null
  if (authStatus === 'misconfigured') return <AuthConfigurationError />
  if (authStatus === 'anon') return <Login />

  let content = <Dashboard />
  if (view === 'editor' && activeProject) content = <EditorShell />
  if (view === 'workspace' && activeProject) content = <WorkspaceHome />
  if (view === 'verification' && activeProject) content = <VerificationWorkspace />
  return <>{content}<OnboardingTour /></>
}
