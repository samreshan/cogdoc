'use client'

/**
 * Login screen (Phase 6, §8.7) — email + password auth via Supabase.
 *
 * Shown by the app shell when no session is present. Supports both sign-in
 * and sign-up (supabase.auth.signUp). On sign-up, Supabase either returns a
 * session immediately (email confirmation disabled) or sends a confirmation
 * email — the notice state covers the latter. On success the middleware
 * refresh path picks up the session cookie and the app loads.
 */
import { useState } from 'react'
import { supabase } from '@/lib/supabase-browser'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { BookOpenCheck, MailCheck, SearchCheck, ShieldCheck } from 'lucide-react'

type Mode = 'signin' | 'signup'

export default function Login() {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setNotice(null)
    setConfirm('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)

    if (mode === 'signup') {
      if (password.length < 6) {
        setError('Password must be at least 6 characters.')
        return
      }
      if (password !== confirm) {
        setError('Passwords do not match.')
        return
      }
    }

    setLoading(true)
    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message)
        setLoading(false)
      } else {
        // session cookie is set by @supabase/ssr; reload to hydrate the app.
        window.location.reload()
      }
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setError(error.message)
        setLoading(false)
      } else if (data.session) {
        // Email confirmation disabled — signed in immediately.
        window.location.reload()
      } else {
        // Confirmation email sent; the user signs in after confirming.
        setNotice('Check your inbox. We sent a confirmation link. Sign in after confirming.')
        setLoading(false)
      }
    }
  }

  return (
    <main
      id="main-content"
      className="flex min-h-[100dvh] items-center bg-[#faf7f0] px-5 py-10 sm:px-8 lg:px-12"
    >
      <div className="mx-auto grid w-full max-w-5xl overflow-hidden rounded-xl border border-stone-200 bg-[#fffefb] lg:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)]">
        <section className="flex flex-col justify-between border-b border-stone-200 p-7 sm:p-10 lg:min-h-[38rem] lg:border-b-0 lg:border-r lg:p-12">
          <div>
            <div className="mb-12 flex items-center gap-2.5">
              <span className="size-4 shrink-0 rounded-full bg-black" aria-hidden="true" />
              <span
                className="text-xl font-semibold text-stone-900"
                style={{ fontFamily: 'var(--font-newsreader), Georgia, serif' }}
              >
                Cogdoc
              </span>
            </div>

            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-800">
              Research without cognitive autopilot
            </p>
            <h1
              className="mt-4 max-w-xl text-4xl font-medium leading-[1.08] tracking-[-0.025em] text-stone-900 sm:text-5xl"
              style={{ fontFamily: 'var(--font-newsreader), Georgia, serif' }}
            >
              Understand more than the words you produce.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-stone-600">
              Explore competing perspectives, inspect scholarly evidence, and draft only after you have worked through the idea.
            </p>

            <div className="mt-8 grid gap-3 text-sm text-stone-700 sm:grid-cols-3 lg:grid-cols-1">
              <p className="flex items-center gap-3">
                <SearchCheck className="size-4 shrink-0 text-emerald-700" aria-hidden="true" />
                Find and inspect sources
              </p>
              <p className="flex items-center gap-3">
                <BookOpenCheck className="size-4 shrink-0 text-emerald-700" aria-hidden="true" />
                Review evidence and citations
              </p>
              <p className="flex items-center gap-3">
                <ShieldCheck className="size-4 shrink-0 text-emerald-700" aria-hidden="true" />
                Preserve researcher understanding
              </p>
            </div>
          </div>

          <div className="mt-12 border-t border-stone-200 pt-5 text-xs leading-5 text-stone-500">
            <p>Designed to strengthen research literacy in support of SDG 4: Quality Education.</p>
            <p className="mt-2">Cogdoc introduces productive friction so AI support strengthens your judgement instead of replacing it.</p>
          </div>
        </section>

        <section className="flex items-center p-7 sm:p-10 lg:p-12" aria-labelledby="auth-heading">
          <div className="w-full">
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-stone-500">
              {mode === 'signin' ? 'Welcome back' : 'Start a workspace'}
            </p>
            <h2
              id="auth-heading"
              className="mt-3 text-3xl font-medium tracking-[-0.015em] text-stone-900"
              style={{ fontFamily: 'var(--font-newsreader), Georgia, serif' }}
            >
              {mode === 'signin' ? 'Sign in to Cogdoc' : 'Create your account'}
            </h2>
            <p className="mt-2 text-sm leading-6 text-stone-500">
              {mode === 'signin'
                ? 'Continue to your projects, sources, and research questions.'
                : 'Create a private workspace for your research and writing.'}
            </p>

            <form onSubmit={handleSubmit} className="mt-7 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="auth-email">Email</Label>
                <Input
                  id="auth-email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  placeholder="you@example.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="h-11 bg-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="auth-password">Password</Label>
                <Input
                  id="auth-password"
                  type="password"
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  aria-describedby={mode === 'signup' ? 'password-help' : undefined}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="h-11 bg-white"
                />
                {mode === 'signup' && (
                  <p id="password-help" className="text-xs text-stone-500">Use at least 6 characters.</p>
                )}
              </div>
              {mode === 'signup' && (
                <div className="space-y-2">
                  <Label htmlFor="auth-confirm">Confirm password</Label>
                  <Input
                    id="auth-confirm"
                    type="password"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    disabled={loading}
                    className="h-11 bg-white"
                  />
                </div>
              )}
              {error && <p role="alert" className="text-sm leading-5 text-rose-700">{error}</p>}
              {notice && (
                <p role="status" className="flex items-start gap-2 text-sm leading-5 text-emerald-800">
                  <MailCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  {notice}
                </p>
              )}
              <Button type="submit" disabled={loading} className="h-11 w-full bg-[#173f35] hover:bg-[#28614f]">
                {loading
                  ? mode === 'signin' ? 'Signing in…' : 'Creating account…'
                  : mode === 'signin' ? 'Sign in' : 'Create account'}
              </Button>
            </form>
            <p className="mt-5 text-center text-xs text-stone-500">
              {mode === 'signin' ? (
                <>
                  No account yet?{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('signup')}
                    className="font-medium text-stone-900 underline underline-offset-4 hover:text-emerald-800"
                  >
                    Sign up
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('signin')}
                    className="font-medium text-stone-900 underline underline-offset-4 hover:text-emerald-800"
                  >
                    Sign in
                  </button>
                </>
              )}
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}
