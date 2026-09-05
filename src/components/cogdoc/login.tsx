'use client'

import { useState } from 'react'
import { BookOpen, Library, Loader2, MailCheck, MessageSquareText } from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setNotice(null)
    if (mode === 'signup' && password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (mode === 'signup' && password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      if (mode === 'signin') {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) throw signInError
        window.location.reload()
        return
      }

      const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
      if (signUpError) throw signUpError
      if (data.session) {
        window.location.reload()
        return
      }
      setNotice('Check your inbox for the confirmation link, then return here to sign in.')
    } catch (authError) {
      setError((authError as Error).message || 'Authentication did not finish. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main id="main-content" className="min-h-[100dvh] bg-[var(--cogdoc-canvas,#eef0f4)] px-4 py-4 text-[var(--cogdoc-ink,#292930)] sm:px-6 sm:py-6">
      <div className="mx-auto grid min-h-[calc(100dvh-2rem)] w-full max-w-6xl overflow-hidden rounded-2xl border border-[#d5d7de] bg-[#f8f9fa] sm:min-h-[calc(100dvh-3rem)] lg:grid-cols-[minmax(0,1.05fr)_minmax(24rem,0.95fr)]">
        <section className="flex flex-col justify-between bg-[var(--cogdoc-shell,#292930)] p-7 text-[#f4f4f6] sm:p-10 lg:p-12">
          <div>
            <div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-lg bg-[#6f60ad] text-sm font-semibold" aria-hidden="true">C</span><div><p className="font-semibold">Cogdoc</p><p className="text-xs text-[#aeb0ba]">Research writing workspace</p></div></div>
            <h1 className="mt-16 max-w-xl text-balance text-4xl font-semibold leading-[1.06] tracking-[-0.045em] sm:text-5xl">Keep the document open while the research develops.</h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-[#c7c8d0]">Write first, inspect sources when needed, and ask for help using context you control.</p>
          </div>
          <div className="mt-12 space-y-4 border-t border-white/10 pt-6 text-sm text-[#c7c8d0]">
            <p className="flex items-center gap-3"><BookOpen className="size-4 text-[#a99be1]" aria-hidden="true" />A focused working document</p>
            <p className="flex items-center gap-3"><Library className="size-4 text-[#a99be1]" aria-hidden="true" />Sources and citations with provenance</p>
            <p className="flex items-center gap-3"><MessageSquareText className="size-4 text-[#a99be1]" aria-hidden="true" />A contextual research collaborator</p>
          </div>
        </section>

        <section className="flex items-center p-7 sm:p-10 lg:p-12" aria-labelledby="auth-heading">
          <div className="mx-auto w-full max-w-sm">
            <p className="text-sm font-medium text-[#6858a8]">{mode === 'signin' ? 'Welcome back' : 'Create an account'}</p>
            <h2 id="auth-heading" className="mt-2 text-3xl font-semibold tracking-[-0.035em]">{mode === 'signin' ? 'Sign in to continue' : 'Start your workspace'}</h2>
            <p className="mt-2 text-sm leading-6 text-[#686a74]">{mode === 'signin' ? 'Return to your documents, sources, and research context.' : 'Your first research document can start with only a topic.'}</p>

            <form onSubmit={handleSubmit} className="mt-7 space-y-5">
              <div className="space-y-2"><Label htmlFor="auth-email">Email</Label><Input id="auth-email" type="email" autoComplete="email" inputMode="email" placeholder="you@example.edu" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={loading} className="h-11 rounded-xl border-[#c9cbd3] bg-white placeholder:text-[#747681] focus-visible:border-[#7264a8] focus-visible:ring-[#7264a8]/20" /></div>
              <div className="space-y-2"><Label htmlFor="auth-password">Password</Label><Input id="auth-password" type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} aria-describedby={mode === 'signup' ? 'password-help' : undefined} value={password} onChange={(event) => setPassword(event.target.value)} required disabled={loading} className="h-11 rounded-xl border-[#c9cbd3] bg-white focus-visible:border-[#7264a8] focus-visible:ring-[#7264a8]/20" />{mode === 'signup' && <p id="password-help" className="text-xs text-[#686a74]">Use at least 6 characters.</p>}</div>
              {mode === 'signup' && <div className="space-y-2"><Label htmlFor="auth-confirm">Confirm password</Label><Input id="auth-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} required disabled={loading} className="h-11 rounded-xl border-[#c9cbd3] bg-white focus-visible:border-[#7264a8] focus-visible:ring-[#7264a8]/20" /></div>}
              {error && <p role="alert" className="text-sm leading-5 text-[#a13b52]">{error}</p>}
              {notice && <p role="status" className="flex items-start gap-2 text-sm leading-5 text-[#5f4e9a]"><MailCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{notice}</p>}
              <Button type="submit" disabled={loading} className="h-11 w-full rounded-xl bg-[#6858a8] text-white hover:bg-[#594a93] active:translate-y-px">{loading && <Loader2 className="mr-2 size-4 animate-spin motion-reduce:animate-none" />}{loading ? (mode === 'signin' ? 'Signing in' : 'Creating account') : (mode === 'signin' ? 'Sign in' : 'Create account')}</Button>
            </form>

            <p className="mt-5 text-center text-sm text-[#686a74]">{mode === 'signin' ? 'New to Cogdoc?' : 'Already have an account?'}{' '}<button type="button" onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')} className="font-semibold text-[#5f4e9a] underline underline-offset-4 hover:text-[#4e4081]">{mode === 'signin' ? 'Create account' : 'Sign in'}</button></p>
          </div>
        </section>
      </div>
    </main>
  )
}
