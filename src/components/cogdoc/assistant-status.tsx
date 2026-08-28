'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Cpu, Loader2, RefreshCw } from 'lucide-react'
import { api, type AssistantReadiness } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

type VisualState = 'checking' | 'connected' | 'attention'

export default function AssistantStatus() {
  const [readiness, setReadiness] = useState<AssistantReadiness | null>(null)
  const [checking, setChecking] = useState(true)

  const check = useCallback(async () => {
    setChecking(true)
    try {
      setReadiness(await api.checkAssistant())
    } catch (error) {
      setReadiness({
        provider: 'custom', model: 'unknown', configured: false, local: false,
        status: 'unreachable', message: (error as Error).message,
      })
    } finally {
      setChecking(false)
    }
  }, [])

  useEffect(() => { void check() }, [check])

  const visual: VisualState = checking ? 'checking' : readiness?.status === 'reachable' ? 'connected' : 'attention'
  const ariaLabel = visual === 'checking'
    ? 'Checking assistant availability'
    : visual === 'connected'
      ? 'Assistant connected'
      : 'Assistant needs attention'

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={ariaLabel}
          className="h-8 gap-1.5 px-2.5 text-xs text-stone-500 hover:text-stone-900"
        >
          {visual === 'checking'
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : visual === 'connected'
              ? <span className="relative"><Cpu className="h-3.5 w-3.5" /><span className="absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full bg-emerald-500 ring-2 ring-[#fffefb]" /></span>
              : <AlertCircle className="h-3.5 w-3.5 text-amber-600" />}
          <span className="hidden xl:inline">Assistant</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 border-stone-200 bg-[#fffefb] p-0 shadow-[0_18px_50px_rgba(45,40,30,0.16)]">
        <div className="border-b border-stone-200 p-4">
          <div className="flex items-start gap-3">
            <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${visual === 'connected' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
              {visual === 'connected' ? <CheckCircle2 className="h-4 w-4" /> : <Cpu className="h-4 w-4" />}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-stone-900">{readinessTitle(readiness, checking)}</p>
              {readiness && <p className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-[0.12em] text-stone-500">{providerName(readiness.provider)} · {readiness.model}</p>}
            </div>
          </div>
          <p className="mt-3 text-xs leading-5 text-stone-600">{checking ? 'Checking the configured model without generating content…' : readiness?.message}</p>
        </div>
        <div className="space-y-3 p-4">
          {readiness && readiness.status !== 'reachable' && <div className="rounded-md border border-stone-200 bg-stone-50 p-3 text-[11px] leading-5 text-stone-600">
            {setupGuidance(readiness)}
          </div>}
          <p className="text-[10px] leading-4 text-stone-500">Source search still works through OpenAlex, Crossref, and Semantic Scholar even when model-backed guidance is unavailable.</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void check()} disabled={checking} className="h-8 w-full border-stone-300 text-xs">
            {checking ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
            Check again
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function readinessTitle(readiness: AssistantReadiness | null, checking: boolean): string {
  if (checking) return 'Checking assistant'
  if (!readiness) return 'Assistant unavailable'
  if (readiness.status === 'reachable') return readiness.local ? 'Local assistant connected' : 'Assistant connected'
  if (readiness.status === 'quota_limited') return 'Assistant quota limited'
  if (readiness.status === 'model_unavailable') return 'Model not available'
  if (readiness.status === 'authentication_failed') return 'Assistant sign-in failed'
  if (readiness.status === 'missing_configuration') return 'Assistant setup needed'
  return 'Assistant unreachable'
}

function providerName(provider: AssistantReadiness['provider']): string {
  if (provider === 'ollama') return 'Ollama'
  if (provider === 'groq') return 'Groq'
  if (provider === 'custom') return 'Custom'
  return 'Gemini'
}

function setupGuidance(readiness: AssistantReadiness): string {
  if (readiness.provider === 'ollama') {
    return readiness.status === 'model_unavailable'
      ? `Run “ollama pull ${readiness.model}”, then check again.`
      : 'Start Ollama and confirm that Cogdoc can reach it. Docker deployments normally use host.docker.internal.'
  }
  if (readiness.status === 'quota_limited') return 'Wait for the provider quota to reset or switch AI_PROVIDER to Ollama for local guidance.'
  if (readiness.status === 'authentication_failed') return 'Check the configured API key, restart Cogdoc, then check again.'
  return 'Add the provider settings shown in .env.example, restart Cogdoc, then check again.'
}
