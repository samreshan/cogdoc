'use client'

import { useState } from 'react'
import { Gauge, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useCogdoc } from '@/lib/store'
import { api } from '@/lib/api-client'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export default function ReviewPaceSelector() {
  const workspace = useCogdoc((state) => state.activeProject)
  const setActive = useCogdoc((state) => state.setActiveProject)
  const [saving, setSaving] = useState(false)
  if (!workspace) return null

  async function change(value: 'rapid' | 'guided' | 'deep') {
    setSaving(true)
    try {
      const { workspace: updated } = await api.updateWorkspace(workspace!.id, { reviewPace: value })
      setActive({ ...workspace!, ...updated })
    } catch (error) {
      toast.error('Could not change review pace', { description: (error as Error).message })
    } finally {
      setSaving(false)
    }
  }

  return <Select value={workspace.reviewPace ?? 'deep'} onValueChange={(value) => change(value as 'rapid' | 'guided' | 'deep')}><SelectTrigger aria-label="Guidance level" className="h-8 w-[132px] border-stone-300 bg-transparent text-xs">{saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin motion-reduce:animate-none" /> : <Gauge className="mr-1 h-3 w-3" />}<SelectValue /></SelectTrigger><SelectContent><SelectItem value="rapid">Light guidance</SelectItem><SelectItem value="guided">Balanced</SelectItem><SelectItem value="deep">Deep inquiry</SelectItem></SelectContent></Select>
}
