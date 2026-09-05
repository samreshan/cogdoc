'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowRight, FileInput, Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useCogdoc } from '@/lib/store'
import { api } from '@/lib/api-client'
import type { Project } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import ResearchKickoff from '@/components/cogdoc/research-kickoff'

export default function Dashboard() {
  const setView = useCogdoc((state) => state.setView)
  const setActiveProject = useCogdoc((state) => state.setActiveProject)
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const importRef = useRef<HTMLInputElement>(null)

  async function refresh() {
    setLoading(true)
    try {
      const { workspaces } = await api.listWorkspaces()
      setProjects(workspaces)
    } catch (error) {
      toast.error('Could not load your projects', { description: (error as Error).message })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [])

  async function enterProject(id: string) {
    try {
      const { workspace } = await api.getWorkspace(id)
      setActiveProject(workspace)
      setView('editor')
    } catch (error) {
      toast.error('Could not open this project', { description: (error as Error).message })
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
        title: file.name.replace(/\.docx$/i, ''),
        description: 'Imported research document',
        workspaceType: 'research',
        reviewPace: 'deep',
        citationStyle: 'harvard',
      })
      await api.importWorkspaceFile(workspace.id, file, 'docx')
      const { workspace: hydrated } = await api.getWorkspace(workspace.id)
      setActiveProject(hydrated)
      setView('editor')
      toast.success('Research document imported')
    } catch (error) {
      toast.error('DOCX import failed', { description: (error as Error).message })
      void refresh()
    } finally {
      setImporting(false)
      if (importRef.current) importRef.current.value = ''
    }
  }

  async function deleteProject() {
    if (!deleteId) return
    try {
      await api.deleteWorkspace(deleteId)
      setProjects((rows) => rows.filter((project) => project.id !== deleteId))
      setDeleteId(null)
      toast.success('Project moved to 30-day recovery')
    } catch (error) {
      toast.error('Could not remove the project', { description: (error as Error).message })
    }
  }

  return (
    <main id="main-content" className="min-h-[100dvh] bg-[#f4f1e9] text-stone-900">
      <header className="border-b border-stone-300/70 bg-[#f8f6f0]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <span className="size-4 shrink-0 rounded-full bg-black" aria-hidden="true" />
            <div><p className="font-serif text-lg font-semibold tracking-tight">Cogdoc</p><p className="text-xs text-stone-500">Research that keeps you thinking</p></div>
          </div>
          <span className="hidden text-xs text-stone-500 sm:block">Private research library</span>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-5 pb-16 pt-12 sm:px-8 sm:pt-16">
        <div className="flex flex-col gap-7 border-b border-stone-300 pb-10 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#386c5c]">Your research</p>
            <h1 className="mt-3 max-w-2xl text-balance font-serif text-4xl font-semibold leading-[1.05] tracking-[-0.035em] sm:text-5xl">Explore the question. Understand the answer.</h1>
            <p className="mt-4 max-w-xl text-pretty text-base leading-7 text-stone-600">Cogdoc helps you find evidence, test your reasoning, and turn what you understand into a working draft.</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" onClick={() => importRef.current?.click()} disabled={importing} className="h-10 border-stone-300 bg-transparent hover:bg-white/70">
              {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" /> : <FileInput className="mr-2 h-4 w-4" />}Import document
            </Button>
            <Button onClick={() => setCreateOpen(true)} className="h-10 bg-[#173f35] hover:bg-[#245548] active:translate-y-px"><Plus className="mr-2 h-4 w-4" />New project</Button>
            <input ref={importRef} type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" onChange={(event) => event.target.files?.[0] && void importDocx(event.target.files[0])} />
          </div>
        </div>

        <div className="mb-4 mt-9 flex items-baseline justify-between">
          <h2 className="font-serif text-xl font-semibold">Projects</h2>
          {!loading && <span className="font-mono text-[10px] tabular-nums text-stone-500">{projects.length}</span>}
        </div>

        {loading ? (
          <div className="divide-y divide-stone-200 border-y border-stone-300">{[0, 1, 2].map((index) => <div key={index} className="animate-pulse py-5"><div className="h-4 w-52 rounded bg-stone-200" /><div className="mt-2 h-3 w-80 max-w-full rounded bg-stone-200" /></div>)}</div>
        ) : projects.length === 0 ? (
          <button onClick={() => setCreateOpen(true)} className="group flex w-full items-center justify-between border-y border-stone-300 py-8 text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#386c5c]">
            <div><p className="font-serif text-xl font-semibold">Begin with a research question</p><p className="mt-1 text-sm text-stone-500">Create a project, then bring in sources as your thinking develops.</p></div><ArrowRight className="h-5 w-5 text-[#386c5c] transition-transform group-hover:translate-x-1 motion-reduce:transition-none" />
          </button>
        ) : (
          <div className="divide-y divide-stone-300 border-y border-stone-300">
            {projects.map((project) => (
              <article key={project.id} className="group relative transition-colors hover:bg-[#f8f6f0]">
                <button onClick={() => void enterProject(project.id)} className="flex w-full items-center gap-4 py-5 pr-12 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#386c5c] sm:px-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-serif text-xl font-semibold text-stone-900">{project.title}</span>
                    <span className="mt-1 block line-clamp-2 max-w-2xl text-sm leading-5 text-stone-500">{project.description || 'No description yet.'}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-stone-400 transition-transform group-hover:translate-x-1 group-hover:text-[#386c5c] motion-reduce:transition-none" aria-hidden="true" />
                </button>
                <button onClick={() => setDeleteId(project.id)} className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-2 text-stone-400 opacity-0 transition hover:bg-rose-50 hover:text-rose-700 focus:opacity-100 group-hover:opacity-100" aria-label={`Remove ${project.title}`}><Trash2 className="h-4 w-4" /></button>
              </article>
            ))}
          </div>
        )}
      </section>

      <ResearchKickoff open={createOpen} onOpenChange={setCreateOpen} onComplete={(project) => { setActiveProject(project); setView('editor') }} />

      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Move this project to recovery?</AlertDialogTitle><AlertDialogDescription>It will be hidden now and remain recoverable for 30 days.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep project</AlertDialogCancel><AlertDialogAction onClick={() => void deleteProject()} className="bg-rose-700 hover:bg-rose-800">Move to recovery</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </main>
  )
}
