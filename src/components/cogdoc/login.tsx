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
import { Sparkles, MailCheck } from 'lucide-react'

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
        setNotice('Check your inbox — we sent a confirmation link. Sign in after confirming.')
        setLoading(false)
      }
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#faf7f0' }}>
      <div className="w-full max-w-sm p-8 bg-white rounded-xl border border-stone-200">
        <div className="flex items-center gap-2 mb-6">
          <Sparkles className="w-5 h-5 text-amber-500" />
          <h1
            className="text-xl font-semibold text-stone-900"
            style={{ fontFamily: 'var(--font-newsreader), Georgia, serif' }}
          >
            Cogdoc
          </h1>
        </div>
        <p className="text-sm text-stone-500 mb-6">
          {mode === 'signin'
            ? 'Sign in to your research-assisted writing IDE.'
            : 'Create an account to start writing with productive friction.'}
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            type="email"
            aria-label="Email"
            autoComplete="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="h-10"
          />
          <Input
            type="password"
            aria-label="Password"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="h-10"
          />
          {mode === 'signup' && (
            <Input
              type="password"
              aria-label="Confirm password"
              autoComplete="new-password"
              placeholder="Confirm password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              className="h-10"
            />
          )}
          {error && <p className="text-xs text-rose-600">{error}</p>}
          {notice && (
            <p className="text-xs text-emerald-700 flex items-start gap-1.5">
              <MailCheck className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              {notice}
            </p>
          )}
          <Button type="submit" disabled={loading} className="w-full h-10">
            {loading
              ? mode === 'signin' ? 'Signing in…' : 'Creating account…'
              : mode === 'signin' ? 'Sign in' : 'Create account'}
          </Button>
        </form>
        <p className="text-xs text-stone-500 mt-4 text-center">
          {mode === 'signin' ? (
            <>
              No account yet?{' '}
              <button
                type="button"
                onClick={() => switchMode('signup')}
                className="text-stone-900 font-medium underline underline-offset-2 hover:text-stone-600"
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
                className="text-stone-900 font-medium underline underline-offset-2 hover:text-stone-600"
              >
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  )
}
