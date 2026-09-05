'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, BookOpen, FileInput, Loader2, MessageSquareText, RefreshCw, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useCogdoc } from '@/lib/store'
import { api } from '@/lib/api-client'
import type { Project } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import ResearchKickoff from '@/components/cogdoc/research-kickoff'

function updatedLabel(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return 'Recently updated'
  return `Updated ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)}`
}

export default function Dashboard() {
  const setView = useCogdoc((state) => state.setView)
  const setActiveProject = useCogdoc((state) => state.setActiveProject)
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [query, setQuery] = useState('')
  const [importing, setImporting] = useState(false)
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const importRef = useRef<HTMLInputElement>(null)

  const visibleProjects = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    if (!normalized) return projects
    return projects.filter((project) => `${project.title} ${project.description ?? ''}`.toLocaleLowerCase().includes(normalized))
  }, [projects, query])

  async function refresh() {
    setLoading(true)
    setLoadError('')
    try {
      const { workspaces } = await api.listWorkspaces()
      setProjects(workspaces)
    } catch (error) {
      setLoadError((error as Error).message || 'Could not load your projects.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [])

  async function enterProject(id: string) {
    setOpeningId(id)
    try {
      const { workspace } = await api.getWorkspace(id)
      setActiveProject(workspace)
      setView('editor')
    } catch (error) {
      toast.error('Could not open this document', { description: (error as Error).message })
    } finally {
      setOpeningId(null)
    }
  }

  async function importDocx(file: File) {
    if (!file.name.toLowerCase().endsWith('.docx')) {
      toast.error('Choose a DOCX file')
      return
    }
    setImporting(true)
    let workspace: Project | null = null
    try {
      const created = await api.createWorkspace({
        title: file.name.replace(/\.docx$/i, ''),
        description: 'Imported research document',
        workspaceType: 'research',
        reviewPace: 'deep',
        citationStyle: 'harvard',
      })
      workspace = created.workspace
      await api.importWorkspaceFile(workspace.id, file, 'docx')
      const { workspace: hydrated } = await api.getWorkspace(workspace.id)
      setActiveProject(hydrated)
      setView('editor')
      toast.success('Document imported')
    } catch (error) {
      toast.error('DOCX import did not finish', {
        description: workspace
          ? 'The new project was kept so nothing from a completed upload is discarded. Open it or retry the import from the document workspace.'
          : (error as Error).message,
      })
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
      toast.error('Could not move the project', { description: (error as Error).message })
    }
  }

  return (
    <main id="main-content" className="min-h-[100dvh] bg-[var(--cogdoc-canvas,#eef0f4)] text-[var(--cogdoc-ink,#27272f)]">
      <header className="bg-[var(--cogdoc-shell,#292930)] text-[#f4f4f6]">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-3">
            <span className="grid size-8 place-items-center rounded-lg bg-[#6f60ad] text-sm font-semibold" aria-hidden="true">C</span>
            <div><p className="text-sm font-semibold tracking-[-0.01em]">Cogdoc</p><p className="text-xs text-[#aeb0ba]">Research writing workspace</p></div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => importRef.current?.click()} disabled={importing} className="text-[#d8d9df] hover:bg-white/10 hover:text-white">
            {importing ? <Loader2 className="mr-2 size-4 animate-spin motion-reduce:animate-none" /> : <FileInput className="mr-2 size-4" />}Import document
          </Button>
          <input ref={importRef} type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" onChange={(event) => event.target.files?.[0] && void importDocx(event.target.files[0])} />
        </div>
      </header>

      <section className="border-b border-[#d7d9df] bg-[#f6f7f9]">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-10 sm:px-8 sm:py-14 lg:grid-cols-[minmax(0,0.9fr)_minmax(26rem,1.1fr)] lg:items-center">
          <div>
            <p className="text-sm font-medium text-[#6858a8]">Your writing comes first</p>
            <h1 className="mt-3 max-w-xl text-balance text-4xl font-semibold leading-[1.05] tracking-[-0.045em] sm:text-5xl">Develop an explanation you can support.</h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-[#5d5f69]">Write while you research. Bring sources and a contextual collaborator into view only when they help.</p>
            <div className="mt-7 space-y-3 text-sm text-[#4e505a]">
              <p className="flex items-center gap-3"><BookOpen className="size-4 text-[#6858a8]" aria-hidden="true" />A readable document stays at the center.</p>
              <p className="flex items-center gap-3"><Search className="size-4 text-[#6858a8]" aria-hidden="true" />Sources retain access details and citation provenance.</p>
              <p className="flex items-center gap-3"><MessageSquareText className="size-4 text-[#6858a8]" aria-hidden="true" />The collaborator works from context you choose.</p>
            </div>
          </div>
          <ResearchKickoff onComplete={(project) => { setActiveProject(project); setView('editor') }} />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-12" aria-labelledby="recent-projects-heading">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><h2 id="recent-projects-heading" className="text-xl font-semibold tracking-[-0.02em]">Recent documents</h2><p className="mt-1 text-sm text-[#676973]">Resume the real working document, with its sources and findings intact.</p></div>
          {projects.length > 3 && (
            <label className="relative block sm:w-72"><span className="sr-only">Search documents</span><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#737580]" aria-hidden="true" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search documents" className="h-10 w-full rounded-xl border border-[#cdd0d8] bg-white pl-9 pr-3 text-sm outline-none placeholder:text-[#747681] focus:border-[#7264a8] focus:ring-2 focus:ring-[#7264a8]/20" /></label>
          )}
        </div>

        {loading ? (
          <div className="mt-6 space-y-3" role="status" aria-label="Loading recent documents">{[0, 1, 2].map((index) => <div key={index} className="animate-pulse rounded-xl border border-[#d9dbe1] bg-[#f7f8fa] px-5 py-5 motion-reduce:animate-none"><div className="h-4 w-52 rounded bg-[#dfe1e6]" /><div className="mt-3 h-3 w-80 max-w-full rounded bg-[#e5e7eb]" /></div>)}</div>
        ) : loadError ? (
          <div className="mt-6 flex flex-col items-start gap-4 rounded-xl border border-[#e2c8ce] bg-[#fbf5f6] p-5"><div><p className="font-medium text-[#742d40]">Recent documents are unavailable</p><p className="mt-1 text-sm text-[#7a5660]">{loadError}</p></div><Button variant="outline" size="sm" onClick={() => void refresh()} className="border-[#d5b5be] bg-white text-[#742d40]"><RefreshCw className="mr-2 size-4" />Retry</Button></div>
        ) : projects.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-[#c8cbd3] px-5 py-8"><p className="font-medium">Your first document will appear here.</p><p className="mt-1 text-sm text-[#676973]">Add a topic above or import an existing DOCX.</p></div>
        ) : visibleProjects.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-[#c8cbd3] px-5 py-8"><p className="font-medium">No documents match “{query}”.</p><button type="button" onClick={() => setQuery('')} className="mt-2 text-sm font-medium text-[#6858a8] underline underline-offset-4">Clear search</button></div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-xl border border-[#d6d8df] bg-[#f8f9fa]">
            {visibleProjects.map((project, index) => (
              <article key={project.id} className={`group relative ${index > 0 ? 'border-t border-[#dfe1e6]' : ''}`}>
                <button onClick={() => void enterProject(project.id)} disabled={openingId === project.id} className="flex w-full items-center gap-4 px-5 py-5 pr-14 text-left outline-none transition-colors hover:bg-white focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#7264a8] disabled:cursor-wait">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#ebe8f4] text-[#6858a8]"><BookOpen className="size-4" aria-hidden="true" /></span>
                  <span className="min-w-0 flex-1"><span className="block truncate font-medium">{project.title}</span><span className="mt-1 block truncate text-sm text-[#696b75]">{project.description || 'Working document'} <span className="text-[#989aa3]">• {updatedLabel(project.updatedAt)}</span></span></span>
                  {openingId === project.id ? <Loader2 className="size-4 shrink-0 animate-spin text-[#6858a8] motion-reduce:animate-none" /> : <ArrowRight className="size-4 shrink-0 text-[#777985] transition-transform group-hover:translate-x-1 motion-reduce:transition-none" aria-hidden="true" />}
                </button>
                <button onClick={() => setDeleteId(project.id)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-[#777985] opacity-100 outline-none transition hover:bg-[#f8e9ed] hover:text-[#9d314d] focus:opacity-100 focus-visible:ring-2 focus-visible:ring-[#7264a8] sm:opacity-0 sm:group-hover:opacity-100" aria-label={`Move ${project.title} to recovery`}><Trash2 className="size-4" /></button>
              </article>
            ))}
          </div>
        )}
      </section>

      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl border-[#d9dbe2] bg-[#f8f9fa]"><AlertDialogHeader><AlertDialogTitle>Move this project to recovery?</AlertDialogTitle><AlertDialogDescription>It will be hidden now and remain recoverable for 30 days.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep project</AlertDialogCancel><AlertDialogAction onClick={() => void deleteProject()} className="bg-[#a13b52] text-white hover:bg-[#8c3046]">Move to recovery</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </main>
  )
}
