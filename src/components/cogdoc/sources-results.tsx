'use client'

import { useState } from 'react'
import { useCogdoc } from '@/lib/store'
import { api } from '@/lib/api-client'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Search, Loader2, ExternalLink, Plus, Check, X, AlertCircle, BookOpen,
} from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

export interface FoundSource {
  title: string
  url: string
  snippet: string
  relevance: 'high' | 'medium' | 'low'
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  claim: string
}

const RELEVANCE_META = {
  high:   { label: 'High relevance',   color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  medium: { label: 'Medium relevance', color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200' },
  low:    { label: 'Low relevance',    color: 'text-stone-600',   bg: 'bg-stone-50',   border: 'border-stone-200' },
}

export default function SourcesResults({ open, onOpenChange, claim }: Props) {
  const project = useCogdoc((s) => s.activeProject)
  const bumpLibrary = useCogdoc((s) => s.bumpLibrary)
  const [loading, setLoading] = useState(false)
  const [sources, setSources] = useState<FoundSource[]>([])
  const [error, setError] = useState<string | null>(null)
  const [addedUrls, setAddedUrls] = useState<Set<string>>(new Set())
  const [addingUrl, setAddingUrl] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)

  async function handleSearch() {
    if (!claim || claim.trim().length < 10) return
    setLoading(true)
    setError(null)
    setSources([])
    setAddedUrls(new Set())
    setHasSearched(true)
    try {
      const res = await api.findSources(claim, project?.id)
      if (res.error) {
        setError(res.detail ? `${res.error}: ${res.detail}` : res.error)
      } else if (res.sources.length === 0) {
        setError(res.message ?? 'No sources found.')
      } else {
        setSources(res.sources)
        toast.success(`Found ${res.sources.length} sources`)
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function handleAdd(source: FoundSource) {
    if (!project) return
    setAddingUrl(source.url)
    try {
      const res = await api.addSource(project.id, source.url, source.title)
      if (res.error) {
        toast.error('Could not add source', { description: res.detail ?? res.error })
      } else {
        setAddedUrls((prev) => new Set([...prev, source.url]))
        bumpLibrary()
        toast.success('Added to library', {
          description: `${source.title.slice(0, 60)}... is now indexed.`,
        })
      }
    } catch (e) {
      toast.error('Failed to add source', { description: (e as Error).message })
    } finally {
      setAddingUrl(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <Search className="w-5 h-5 text-stone-600" />
            Find Sources
          </DialogTitle>
          <p className="text-sm text-stone-500 mt-1">
            Cogdoc searches the web for evidence related to your claim and
            assesses each source's relevance. Click <Plus className="inline w-3 h-3" /> to
            add a source to your library — the Citation Sentinel will then verify
            claims against it.
          </p>
          <div className="mt-3 p-3 rounded-lg bg-stone-50 border border-stone-200">
            <p className="text-[11px] uppercase tracking-wide text-stone-400 font-medium mb-1">Your claim</p>
            <p className="text-sm text-stone-700 italic">&ldquo;{claim}&rdquo;</p>
          </div>
        </DialogHeader>

        <div className="px-6 py-3 border-b border-stone-100">
          <Button
            onClick={handleSearch}
            disabled={loading || !claim}
            className="bg-stone-900 hover:bg-stone-800"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Searching the web…
              </>
            ) : (
              <>
                <Search className="w-4 h-4 mr-2" />
                {hasSearched ? 'Search again' : 'Find sources'}
              </>
            )}
          </Button>
        </div>

        <ScrollArea className="h-[50vh]">
          <div className="p-4 space-y-2">
            {error && (
              <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-rose-700">Search failed</p>
                  <p className="text-xs text-rose-600 mt-0.5">{error}</p>
                </div>
              </div>
            )}

            {!loading && !error && sources.length === 0 && !hasSearched && (
              <div className="text-center py-12">
                <BookOpen className="w-10 h-10 mx-auto text-stone-300 mb-3" />
                <p className="text-sm text-stone-600 font-medium mb-1">No search yet</p>
                <p className="text-xs text-stone-500 max-w-xs mx-auto">
                  Click &ldquo;Find sources&rdquo; to search the web for academic
                  articles, studies, and reports related to your claim.
                </p>
              </div>
            )}

            <AnimatePresence>
              {sources.map((source, idx) => {
                const meta = RELEVANCE_META[source.relevance]
                const isAdded = addedUrls.has(source.url)
                const isAdding = addingUrl === source.url
                return (
                  <motion.div
                    key={source.url}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className={`border rounded-lg p-3 ${meta.border} ${meta.bg}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-stone-800 hover:text-stone-900 hover:underline line-clamp-2 flex-1"
                      >
                        {source.title}
                      </a>
                      <Badge variant="secondary" className={`${meta.bg} ${meta.color} text-[10px] shrink-0`}>
                        {meta.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-stone-600 leading-relaxed mb-2">
                      {source.snippet}
                    </p>
                    <div className="flex items-center gap-2">
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-stone-400 hover:text-stone-600 flex items-center gap-1 truncate flex-1"
                      >
                        <ExternalLink className="w-3 h-3 shrink-0" />
                        <span className="truncate">{source.url}</span>
                      </a>
                      <Button
                        size="sm"
                        variant={isAdded ? 'outline' : 'default'}
                        onClick={() => handleAdd(source)}
                        disabled={isAdding || isAdded}
                        className={`h-7 text-xs shrink-0 ${isAdded ? 'text-emerald-700 border-emerald-300' : 'bg-stone-900 hover:bg-stone-800'}`}
                      >
                        {isAdding ? (
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        ) : isAdded ? (
                          <Check className="w-3 h-3 mr-1" />
                        ) : (
                          <Plus className="w-3 h-3 mr-1" />
                        )}
                        {isAdded ? 'Added' : 'Add'}
                      </Button>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
