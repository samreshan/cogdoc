import { LoaderCircle, Settings2 } from 'lucide-react'

export function AuthLoading() {
  return (
    <main
      id="main-content"
      className="flex min-h-[100dvh] items-center justify-center bg-[var(--cogdoc-canvas,#eef0f4)] px-6"
    >
      <div role="status" className="flex items-center gap-3 rounded-xl border border-[#d7d9e0] bg-[#f8f9fa] px-4 py-3 text-sm text-[#5f616b] shadow-sm">
        <LoaderCircle className="size-4 animate-spin text-[#6858a8] motion-reduce:animate-none" aria-hidden="true" />
        <span>Loading Cogdoc...</span>
      </div>
    </main>
  )
}

export function AuthConfigurationError() {
  return (
    <main
      id="main-content"
      className="flex min-h-[100dvh] items-center justify-center bg-[var(--cogdoc-canvas,#eef0f4)] px-6 py-10"
    >
      <section className="w-full max-w-lg rounded-2xl border border-[#d9dbe2] bg-[#f8f9fa] p-8 text-center shadow-[0_18px_60px_rgba(38,38,46,0.08)]" aria-labelledby="auth-setup-heading">
        <span className="mx-auto flex size-10 items-center justify-center rounded-xl bg-[#ebe8f4] text-[#6858a8]">
          <Settings2 className="size-5" aria-hidden="true" />
        </span>
        <p className="mt-5 text-sm font-medium text-[#6858a8]">Setup required</p>
        <h1 id="auth-setup-heading" className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-[#292930]">
          Authentication is not configured
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#62646e]">
          Ask the deployment administrator to configure Supabase authentication. A private one-person installation can explicitly enable single-user mode.
        </p>
        <p className="mt-5 rounded-xl border border-[#d9dbe2] bg-white px-4 py-3 font-mono text-xs text-[#4f515b]">
          COGDOC_SINGLE_USER_MODE=1
        </p>
      </section>
    </main>
  )
}
