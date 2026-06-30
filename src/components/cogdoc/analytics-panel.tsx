'use client'

import { useEffect, useState, useCallback } from 'react'
import { useCogdoc } from '@/lib/store'
import { api } from '@/lib/api-client'
import type { Analytics } from '@/lib/types'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Sparkles, ShieldCheck, ListTree, BookOpen, TrendingUp, Activity } from 'lucide-react'

const ENGINE_LABELS: Record<string, { label: string; icon: typeof Sparkles; color: string }> = {
  interceptor: { label: 'Interceptor',     icon: Sparkles,    color: 'text-amber-600' },
  socratic:    { label: 'Socratic Spacer', icon: BookOpen,   color: 'text-rose-600' },
  citation:    { label: 'Citation Sentinel', icon: ShieldCheck, color: 'text-emerald-600' },
  scaffold:    { label: 'Scaffold',         icon: ListTree,   color: 'text-sky-600' },
}

const ACTION_LABELS: Record<string, string> = {
  engaged: 'Engaged',
  dismissed: 'Dismissed',
  ignored: 'Ignored',
}

const VERDICT_LABELS: Record<string, string> = {
  supported: 'Supported',
  partially_supported: 'Partially Supported',
  unsupported: 'Unsupported',
  insufficient_evidence: 'Insufficient Evidence',
}

export default function AnalyticsPanel() {
  const project = useCogdoc((s) => s.activeProject)
  const analyticsVersion = useCogdoc((s) => s.analyticsVersion)
  const [data, setData] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!project) return
    setLoading(true)
    try {
      const a = await api.getAnalytics(project.id)
      setData(a)
    } catch (e) {
      console.error('Failed to load analytics', e)
    } finally {
      setLoading(false)
    }
  }, [project])

  useEffect(() => {
    refresh()
  }, [refresh, analyticsVersion])

  if (loading || !data) {
    return <div className="p-8 text-center text-stone-400 text-xs">Loading analytics...</div>
  }

  if (data.total === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-6 py-12">
        <div className="w-14 h-14 rounded-full bg-stone-100 flex items-center justify-center mb-4">
          <Activity className="w-7 h-7 text-stone-400" />
        </div>
        <h3 className="text-sm font-medium text-stone-700 mb-1">No data yet</h3>
        <p className="text-xs text-stone-500 max-w-xs">
          Analytics will appear here once you start triggering interventions.
        </p>
      </div>
    )
  }

  const engRate = Math.round(data.engagementRate * 100)
  const engines = Object.entries(data.byEngine).sort((a, b) => b[1] - a[1])
  const actions = Object.entries(data.byAction)
  const verdicts = Object.entries(data.byVerdict)

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-3">
        {/* Big metric: total interventions */}
        <Card className="border-stone-200 bg-gradient-to-br from-stone-50 to-amber-50/40">
          <CardContent className="pt-5">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[11px] font-medium text-stone-500 uppercase tracking-wide mb-1">
                  Total interventions
                </p>
                <p className="text-3xl font-bold text-stone-900">{data.total}</p>
              </div>
              <TrendingUp className="w-5 h-5 text-stone-400" />
            </div>
          </CardContent>
        </Card>

        {/* Engagement rate */}
        <Card className="border-stone-200">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-xs font-medium text-stone-700">Engagement rate</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-emerald-600">{engRate}%</span>
              <span className="text-xs text-stone-500">of interventions were engaged with</span>
            </div>
            <div className="mt-2 h-2 bg-stone-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${engRate}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* By engine */}
        <Card className="border-stone-200">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-xs font-medium text-stone-700">By engine</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-1.5">
            {engines.map(([k, v]) => {
              const meta = ENGINE_LABELS[k] ?? { label: k, icon: Sparkles, color: 'text-stone-600' }
              const Icon = meta.icon
              const pct = data.total > 0 ? Math.round((v / data.total) * 100) : 0
              return (
                <div key={k} className="flex items-center gap-2">
                  <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
                  <span className="text-xs text-stone-700 w-32">{meta.label}</span>
                  <div className="flex-1 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${meta.color.replace('text-', 'bg-')}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-stone-500 w-8 text-right tabular-nums">{v}</span>
                </div>
              )
            })}
          </CardContent>
        </Card>

        {/* By user action */}
        {actions.length > 0 && (
          <Card className="border-stone-200">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-xs font-medium text-stone-700">Your response</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 space-y-1.5">
              {actions.map(([k, v]) => {
                const colorMap: Record<string, string> = {
                  engaged: 'bg-emerald-500',
                  dismissed: 'bg-rose-400',
                  ignored: 'bg-stone-400',
                }
                return (
                  <div key={k} className="flex items-center gap-2">
                    <span className="text-xs text-stone-700 w-20">{ACTION_LABELS[k] ?? k}</span>
                    <div className="flex-1 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${colorMap[k] ?? 'bg-stone-400'}`}
                        style={{ width: `${(v / data.total) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-stone-500 w-8 text-right tabular-nums">{v}</span>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )}

        {/* By verdict */}
        {verdicts.length > 0 && (
          <Card className="border-stone-200">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-xs font-medium text-stone-700">Citation verdicts</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 space-y-1.5">
              {verdicts.map(([k, v]) => {
                const colorMap: Record<string, string> = {
                  supported: 'bg-emerald-500',
                  partially_supported: 'bg-amber-500',
                  unsupported: 'bg-rose-500',
                  insufficient_evidence: 'bg-stone-400',
                }
                return (
                  <div key={k} className="flex items-center gap-2">
                    <span className="text-xs text-stone-700 w-36">{VERDICT_LABELS[k] ?? k}</span>
                    <div className="flex-1 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${colorMap[k] ?? 'bg-stone-400'}`}
                        style={{ width: `${(v / verdicts.reduce((a, [, x]) => a + x, 0)) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-stone-500 w-8 text-right tabular-nums">{v}</span>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )}
      </div>
    </ScrollArea>
  )
}
