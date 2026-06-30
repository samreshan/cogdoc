'use client'

import { useEffect, useState } from 'react'
import { useCogdoc } from '@/lib/store'
import { api } from '@/lib/api-client'
import type { Project } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { FileText, Plus, Trash2, Sparkles, ArrowRight, BookOpen, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'

export default function Dashboard() {
  const setView = useCogdoc((s) => s.setView)
  const setActiveProject = useCogdoc((s) => s.setActiveProject)

  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [creating, setCreating] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  useEffect(() => {
    refresh()
  }, [])

  async function refresh() {
    setLoading(true)
    try {
      const { projects } = await api.listProjects()
      setProjects(projects)
    } catch (e) {
      toast.error('Failed to load projects', { description: (e as Error).message })
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate() {
    if (!newTitle.trim()) {
      toast.error('Please enter a title')
      return
    }
    setCreating(true)
    try {
      const { project } = await api.createProject(newTitle, newDesc)
      // Fetch the full project (with all relations) before opening the editor
      const { project: fullProject } = await api.getProject(project.id)
      setCreateOpen(false)
      setNewTitle('')
      setNewDesc('')
      setActiveProject(fullProject)
      setView('editor')
      toast.success('Project created', { description: project.title })
    } catch (e) {
      toast.error('Failed to create project', { description: (e as Error).message })
    } finally {
      setCreating(false)
    }
  }

  async function handleOpen(p: Project) {
    try {
      const { project } = await api.getProject(p.id)
      setActiveProject(project)
      setView('editor')
    } catch (e) {
      toast.error('Failed to open project', { description: (e as Error).message })
    }
  }

  async function handleDelete() {
    if (!deleteId) return
    try {
      await api.deleteProject(deleteId)
      toast.success('Project deleted')
      setDeleteId(null)
      refresh()
    } catch (e) {
      toast.error('Failed to delete', { description: (e as Error).message })
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-stone-50 via-stone-100 to-amber-50/30">
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-stone-900 text-amber-100 flex items-center justify-center font-bold text-lg">
              C
            </div>
            <div>
              <h1 className="text-xl font-semibold text-stone-900 tracking-tight">Cogdoc</h1>
              <p className="text-xs text-stone-500 -mt-0.5">A research-assisted writing IDE</p>
            </div>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-stone-900 hover:bg-stone-800">
                <Plus className="w-4 h-4 mr-1.5" />
                New Project
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create a new project</DialogTitle>
                <DialogDescription>
                  A project is one writing piece — a literature review chapter, an essay draft, a research proposal. Each project gets its own research library and intervention history.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-stone-700">Title</label>
                  <Input
                    autoFocus
                    placeholder="e.g. Literature Review — AI and Cognitive Offloading"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-stone-700">Description (optional)</label>
                  <Textarea
                    placeholder="What is this piece about?"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button onClick={handleCreate} disabled={creating} className="bg-stone-900 hover:bg-stone-800">
                  {creating ? 'Creating...' : 'Create project'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <section className="max-w-6xl w-full mx-auto px-6 pt-12 pb-8">
        <div className="grid md:grid-cols-3 gap-4 mb-10">
          <Card className="border-stone-200 bg-white/70">
            <CardHeader className="pb-3">
              <div className="w-9 h-9 rounded-md bg-amber-100 text-amber-700 flex items-center justify-center mb-1">
                <Sparkles className="w-5 h-5" />
              </div>
              <CardTitle className="text-base">Productive Friction</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-stone-600">
                AI never writes your prose. It interrupts, questions, and challenges — preserving your cognitive responsibility.
              </p>
            </CardContent>
          </Card>
          <Card className="border-stone-200 bg-white/70">
            <CardHeader className="pb-3">
              <div className="w-9 h-9 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center mb-1">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <CardTitle className="text-base">Citation Sentinel</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-stone-600">
                Verify any claim against your uploaded research library. Get supported, partially supported, or unsupported verdicts with cited passages.
              </p>
            </CardContent>
          </Card>
          <Card className="border-stone-200 bg-white/70">
            <CardHeader className="pb-3">
              <div className="w-9 h-9 rounded-md bg-rose-100 text-rose-700 flex items-center justify-center mb-1">
                <BookOpen className="w-5 h-5" />
              </div>
              <CardTitle className="text-base">Living Margin</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-stone-600">
                Every AI intervention appears beside your text — never inside it. Dismiss, engage, or ignore — your call.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-lg font-semibold text-stone-900">Your projects</h2>
          <p className="text-sm text-stone-500">{projects.length} {projects.length === 1 ? 'project' : 'projects'}</p>
        </div>

        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="border-stone-200 bg-white/70 animate-pulse h-40" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <Card className="border-dashed border-stone-300 bg-white/50">
            <CardContent className="py-16 text-center">
              <FileText className="w-12 h-12 mx-auto text-stone-400 mb-4" />
              <p className="text-stone-700 font-medium mb-1">No projects yet</p>
              <p className="text-sm text-stone-500 mb-6 max-w-md mx-auto">
                Create your first project to start writing with productive friction. Each project gets its own editor, research library, and intervention history.
              </p>
              <Button onClick={() => setCreateOpen(true)} className="bg-stone-900 hover:bg-stone-800">
                <Plus className="w-4 h-4 mr-1.5" />
                Create your first project
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p) => (
              <Card
                key={p.id}
                className="border-stone-200 bg-white/80 hover:bg-white hover:shadow-md transition-all cursor-pointer group"
                onClick={() => handleOpen(p)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base group-hover:text-stone-900 line-clamp-2 leading-snug">
                      {p.title}
                    </CardTitle>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleteId(p.id)
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-rose-50 rounded text-stone-400 hover:text-rose-600"
                      aria-label="Delete project"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  {p.description && (
                    <CardDescription className="line-clamp-2">{p.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 flex-wrap mb-3">
                    <Badge variant="secondary" className="bg-stone-100 text-stone-600">
                      <FileText className="w-3 h-3 mr-1" />
                      {p._count.pdfs} PDFs
                    </Badge>
                    <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200">
                      <Sparkles className="w-3 h-3 mr-1" />
                      {p._count.interventions} interventions
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-stone-500">
                    <span>Updated {new Date(p.updatedAt).toLocaleDateString()}</span>
                    <span className="flex items-center gap-1 group-hover:text-stone-900 transition-colors">
                      Open <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <footer className="mt-auto border-t border-stone-200 bg-white/70">
        <div className="max-w-6xl mx-auto px-6 py-4 text-xs text-stone-500 flex items-center justify-between">
          <span>Cogdoc — Final Year Project · BSc (Hons) IT · 2026</span>
          <span>SDG 4 · Quality Education</span>
        </div>
      </footer>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this project?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the project, its document, all uploaded PDFs, all chunks, and the full intervention history. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-rose-600 hover:bg-rose-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
