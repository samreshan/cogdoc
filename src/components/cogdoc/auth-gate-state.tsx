import { LoaderCircle, Settings2 } from 'lucide-react'

export function AuthLoading() {
  return (
    <main
      id="main-content"
      className="flex min-h-[100dvh] items-center justify-center bg-[#faf7f0] px-6"
    >
      <div role="status" className="flex items-center gap-3 text-sm text-stone-600">
        <LoaderCircle className="size-4 animate-spin text-emerald-700 motion-reduce:animate-none" aria-hidden="true" />
        <span>Loading Cogdoc…</span>
      </div>
    </main>
  )
}

export function AuthConfigurationError() {
  return (
    <main
      id="main-content"
      className="flex min-h-[100dvh] items-center justify-center bg-[#faf7f0] px-6 py-10"
    >
      <section className="w-full max-w-lg rounded-xl border border-amber-200 bg-[#fffefb] p-8 text-center" aria-labelledby="auth-setup-heading">
        <span className="mx-auto flex size-10 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
          <Settings2 className="size-5" aria-hidden="true" />
        </span>
        <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.18em] text-amber-700">Setup required</p>
        <h1 id="auth-setup-heading" className="mt-3 font-serif text-2xl font-semibold text-stone-900">
          Authentication is not configured
        </h1>
        <p className="mt-3 text-sm leading-6 text-stone-600">
          Ask the deployment administrator to configure Supabase authentication. A private one-person installation can explicitly enable single-user mode.
        </p>
        <p className="mt-5 rounded-lg border border-stone-200 bg-white px-4 py-3 font-mono text-xs text-stone-700">
          COGDOC_SINGLE_USER_MODE=1
        </p>
      </section>
    </main>
  )
}
