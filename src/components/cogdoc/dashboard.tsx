'use client'

import { useEffect, useRef, useState } from 'react'
import { useCogdoc } from '@/lib/store'
import { api } from '@/lib/api-client'
import type { Project } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { ArrowRight, BookOpen, CalendarClock, FileInput, FlaskConical, Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

type WorkspaceWithStatus = Project & {
  reviewRuns?: Array<{ status: string; createdAt: string }>
  certificates?: Array<{ status: string }>
  _count: Project['_count'] & { reviewItems?: number; codeSnapshots?: number }
}

export default function Dashboard() {
  const setView = useCogdoc((state) => state.setView)
  const setActiveProject = useCogdoc((state) => state.setActiveProject)
  const [workspaces, setWorkspaces] = useState<WorkspaceWithStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [createType, setCreateType] = useState<'assignment' | 'research' | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [creating, setCreating] = useState(false)
  const [importing, setImporting] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const importRef = useRef<HTMLInputElement>(null)

  async function refresh() {
    setLoading(true)
    try {
      const { workspaces: rows } = await api.listWorkspaces()
      setWorkspaces(rows as WorkspaceWithStatus[])
    } catch (error) {
      toast.error('Could not load your workspaces', { description: (error as Error).message })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [])

  async function openWorkspace(id: string) {
    try {
      const { workspace } = await api.getWorkspace(id)
      setActiveProject(workspace)
      setView('workspace')
    } catch (error) {
      toast.error('Could not open this workspace', { description: (error as Error).message })
    }
  }

  async function createWorkspace() {
    if (!createType || !title.trim()) return
    setCreating(true)
    try {
      const { workspace } = await api.createWorkspace({
        title: title.trim(), workspaceType: createType, description,
        dueAt: createType === 'assignment' && dueAt ? new Date(dueAt).toISOString() : null,
        reviewPace: createType === 'assignment' ? 'guided' : 'deep', citationStyle: 'harvard',
      })
      setCreateType(null)
      setTitle('')
      setDescription('')
      setDueAt('')
      setActiveProject(workspace)
      setView('workspace')
    } catch (error) {
      toast.error('Could not create the workspace', { description: (error as Error).message })
    } finally {
      setCreating(false)
    }
  }

  async function importDocx(file: File) {
    if (!file.name.toLowerCase().endsWith('.docx')) {
      toast.error('Choose a DOCX file')
      return
    }
    setImporting(true)
    try {
      const { workspace } = await api.createWorkspace({
        title: file.name.replace(/\.docx$/i, ''), workspaceType: 'assignment',
        reviewPace: 'rapid', citationStyle: 'harvard',
      })
      const imported = await api.importWorkspaceFile(workspace.id, file, 'docx') as { compatibility?: { warnings?: string[] } }
      const { workspace: hydrated } = await api.getWorkspace(workspace.id)
      setActiveProject(hydrated)
      setView('workspace')
      toast.success('Document imported', { description: imported.compatibility?.warnings?.[0] ?? 'Review the compatibility notes before editing.' })
    } catch (error) {
      toast.error('DOCX import failed', { description: (error as Error).message })
      refresh()
    } finally {
      setImporting(false)
      if (importRef.current) importRef.current.value = ''
    }
  }

  async function deleteWorkspace() {
    if (!deleteId) return
    try {
      await api.deleteWorkspace(deleteId)
      setWorkspaces((rows) => rows.filter((workspace) => workspace.id !== deleteId))
      setDeleteId(null)
      toast.success('Workspace moved to 30-day recovery')
    } catch (error) {
      toast.error('Could not remove the workspace', { description: (error as Error).message })
    }
  }

  return (
    <main id="main-content" className="min-h-screen bg-[#f4f1e9] text-stone-900">
      <header className="border-b border-stone-300/70 bg-[#f8f6f0]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-[10px] bg-[#173f35] font-mono text-xs font-semibold text-white">CD</div>
            <div><p className="font-serif text-lg font-semibold tracking-tight">Cogdoc</p><p className="text-xs text-stone-500">Academic work you can account for</p></div>
          </div>
          <span className="text-sm text-stone-500">Private by default</span>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 pb-12 pt-14">
        <div className="grid items-end gap-10 border-b border-stone-300 pb-12 lg:grid-cols-[1.2fr_.8fr]">
          <div>
            <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.2em] text-[#386c5c]">Assignment and research workspace</p>
            <h1 className="max-w-3xl text-balance font-serif text-5xl font-semibold leading-[1.02] tracking-[-0.035em] md:text-6xl">Bring the draft. Leave with evidence.</h1>
            <p className="mt-6 max-w-2xl text-pretty text-lg leading-8 text-stone-600">Import an AI-assisted assignment or write from the beginning. Cogdoc checks the claims, citations, sources, and reasoning—without pretending to prove who wrote it.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <Button onClick={() => setCreateType('assignment')} className="h-12 justify-between rounded-[10px] bg-[#173f35] px-4 text-sm hover:bg-[#245548] active:translate-y-px"><span className="flex items-center"><Plus className="mr-2 h-4 w-4" />New assignment</span><ArrowRight className="h-4 w-4" /></Button>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" onClick={() => setCreateType('research')} className="h-11 rounded-[10px] border-stone-300 bg-transparent hover:bg-white/60 active:translate-y-px"><FlaskConical className="mr-2 h-4 w-4" />Research</Button>
              <Button variant="outline" onClick={() => importRef.current?.click()} disabled={importing} className="h-11 rounded-[10px] border-stone-300 bg-transparent hover:bg-white/60 active:translate-y-px">{importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileInput className="mr-2 h-4 w-4" />}Import DOCX</Button>
              <input ref={importRef} type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" onChange={(event) => event.target.files?.[0] && importDocx(event.target.files[0])} />
            </div>
          </div>
        </div>

        <div className="mb-5 mt-10 flex items-end justify-between">
          <div><p className="font-serif text-2xl font-semibold">Your workspaces</p><p className="mt-1 text-sm text-stone-500">Nothing is shared until you create a private verification link.</p></div>
          <span className="font-mono text-xs tabular-nums text-stone-500">{workspaces.length} active</span>
        </div>

        {loading ? (
          <div className="grid gap-px overflow-hidden rounded-xl border border-stone-300 bg-stone-300 md:grid-cols-2">{[0, 1, 2, 3].map((index) => <div key={index} className="h-40 animate-pulse bg-[#f8f6f0] p-5"><div className="h-4 w-1/2 rounded bg-stone-200" /><div className="mt-4 h-3 w-4/5 rounded bg-stone-200" /></div>)}</div>
        ) : workspaces.length === 0 ? (
          <div className="grid min-h-64 place-items-center rounded-xl border border-dashed border-stone-400 bg-[#f8f6f0]/50 p-8 text-center"><div><BookOpen className="mx-auto mb-4 h-8 w-8 text-[#386c5c]" /><p className="font-serif text-xl font-semibold">Start with what you already have</p><p className="mt-2 max-w-md text-sm leading-6 text-stone-500">A rough draft, an AI-assisted DOCX, or a blank page all work. Setup details can wait.</p></div></div>
        ) : (
          <div className="grid gap-px overflow-hidden rounded-xl border border-stone-300 bg-stone-300 md:grid-cols-2">
            {workspaces.map((workspace) => {
              const certified = workspace.certificates?.[0]?.status === 'valid'
              return (
                <article key={workspace.id} className="group relative bg-[#f8f6f0] p-5 transition-colors hover:bg-white">
                  <button onClick={() => openWorkspace(workspace.id)} className="block w-full text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#386c5c]">
                    <div className="mb-6 flex items-center justify-between gap-4"><span className="font-mono text-[10px] uppercase tracking-[0.18em] text-stone-500">{workspace.workspaceType === 'assignment' ? 'Assignment' : 'Research'}</span><span className={`text-xs ${certified ? 'text-[#28614f]' : 'text-stone-500'}`}>{certified ? 'Process verified' : workspace.lifecycleState === 'reviewing' ? 'Review in progress' : 'Draft'}</span></div>
                    <h2 className="text-pretty font-serif text-2xl font-semibold leading-tight">{workspace.title}</h2>
                    <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-stone-500">{workspace.dueAt && <span className="flex items-center"><CalendarClock className="mr-1.5 h-3.5 w-3.5" />Due {new Date(workspace.dueAt).toLocaleDateString()}</span>}<span>{workspace._count?.pdfs ?? 0} sources</span><span>{workspace._count?.reviewItems ?? 0} review actions</span></div>
                  </button>
                  <button onClick={() => setDeleteId(workspace.id)} className="absolute bottom-4 right-4 rounded-md p-2 text-stone-400 opacity-0 transition hover:bg-rose-50 hover:text-rose-700 focus:opacity-100 group-hover:opacity-100" aria-label={`Remove ${workspace.title}`}><Trash2 className="h-4 w-4" /></button>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <footer className="mx-auto flex max-w-7xl justify-between border-t border-stone-300 px-6 py-6 text-xs text-stone-500"><span>Cogdoc verifies a process, not authorship.</span><span>Private by default</span></footer>

      <Dialog open={createType !== null} onOpenChange={(open) => !open && setCreateType(null)}>
        <DialogContent className="rounded-xl sm:max-w-lg">
          <DialogHeader><DialogTitle className="font-serif text-2xl">New {createType} workspace</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><label className="mb-1.5 block text-sm font-medium" htmlFor="workspace-title">Title</label><Input id="workspace-title" autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder={createType === 'assignment' ? 'e.g. Software engineering assignment' : 'e.g. Cognitive offloading literature review'} /></div>
            {createType === 'assignment' && <div><label className="mb-1.5 block text-sm font-medium" htmlFor="due-at">Deadline</label><Input id="due-at" type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /><p className="mt-1 text-xs text-stone-500">Optional. It changes prioritization, never verification standards.</p></div>}
            <div><label className="mb-1.5 block text-sm font-medium" htmlFor="workspace-description">Context <span className="font-normal text-stone-400">optional</span></label><Textarea id="workspace-description" rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Brief, research question, or what you need to finish" /></div>
          </div>
          <DialogFooter><Button variant="ghost" onClick={() => setCreateType(null)}>Cancel</Button><Button onClick={createWorkspace} disabled={creating || !title.trim()} className="bg-[#173f35] hover:bg-[#245548]">{creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create workspace</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Move this workspace to recovery?</AlertDialogTitle><AlertDialogDescription>It will be hidden immediately, private links will be revoked, and its content will remain recoverable for 30 days.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep workspace</AlertDialogCancel><AlertDialogAction onClick={deleteWorkspace} className="bg-rose-700 hover:bg-rose-800">Move to recovery</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </main>
  )
}
