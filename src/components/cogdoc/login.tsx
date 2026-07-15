'use client'

/**
 * Login screen (Phase 6, §8.7) — email + password auth via Supabase.
 *
 * Shown by the app shell when no session is present. On success the middleware
 * refresh path picks up the session cookie and the app loads. OAuth (Google/
 * GitHub) is available via Supabase's provider config; the email form is the
 * default.
 */
import { useState } from 'react'
import { supabase } from '@/lib/supabase-browser'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sparkles } from 'lucide-react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      // session cookie is set by @supabase/ssr; reload to hydrate the app.
      window.location.reload()
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
          Sign in to your research-assisted writing IDE.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="h-10"
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="h-10"
          />
          {error && <p className="text-xs text-rose-600">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full h-10">
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  )
}
