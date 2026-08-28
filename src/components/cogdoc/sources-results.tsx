'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useCogdoc } from '@/lib/store'
import { api } from '@/lib/api-client'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Search, Loader2, ExternalLink, Plus, Check, AlertCircle, BookOpen, Clipboard, Unlock,
} from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

export interface FoundSource {
  title: string
  url: string
  snippet: string
  relevance: 'high' | 'medium' | 'low'
  openAccessUrl?: string | null
  isOpenAccess?: boolean
  citation?: { authors: string[]; year: string | null; venue: string | null; doi: string | null }
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

const FAMILY_PARTICLES = new Set(['da', 'de', 'del', 'der', 'di', 'du', 'la', 'le', 'van', 'von'])

function personName(author: string): { family: string; initials: string } {
  const comma = author.split(',').map((part) => part.trim()).filter(Boolean)
  if (comma.length > 1) {
    return { family: comma[0]!, initials: comma.slice(1).join(' ').split(/\s+/).filter(Boolean).map((part) => `${part[0]!.toUpperCase()}.`).join(' ') }
  }
  const parts = author.trim().split(/\s+/).filter(Boolean)
  let familyStart = Math.max(0, parts.length - 1)
  while (familyStart > 0 && FAMILY_PARTICLES.has(parts[familyStart - 1]!.toLowerCase())) familyStart -= 1
  const family = parts.slice(familyStart).join(' ') || author
  const initials = parts.slice(0, familyStart)
    .flatMap((part) => part.split(/[-–]/))
    .filter(Boolean)
    .map((part) => `${part[0]!.toUpperCase()}.`)
    .join(' ')
  return { family, initials }
}

function formattedAuthors(authors: string[], style: 'harvard' | 'apa'): string {
  const names = authors.map((author) => {
    const { family, initials } = personName(author)
    return initials ? `${family}, ${initials}` : family
  })
  if (names.length < 2) return names[0] ?? ''
  const conjunction = style === 'apa' ? '&' : 'and'
  if (names.length === 2) return `${names[0]}${style === 'apa' ? ',' : ''} ${conjunction} ${names[1]}`
  return `${names.slice(0, -1).join(', ')}, ${conjunction} ${names.at(-1)}`
}

function citationIdentifier(source: FoundSource): string {
  const doi = source.citation?.doi?.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')
  return doi ? `https://doi.org/${doi}` : source.url
}

export function formatCitationSuggestions(source: FoundSource, style: 'harvard' | 'apa' = 'harvard') {
  if (!source.citation) return null
  const { authors, year, venue, doi } = source.citation
  const yearText = year ?? 'n.d.'
  const authorText = authors.length ? formattedAuthors(authors, style) : source.title
  const venueText = venue ? ` ${venue}.` : ''
  const identifier = citationIdentifier(source)
  const reference = style === 'apa'
    ? `${authorText} (${yearText}). ${source.title}.${venueText} ${identifier}`.replace(/\s+/g, ' ').trim()
    : `${authorText} (${yearText}) ‘${source.title}’.${venueText} Available at: ${identifier}`.replace(/\s+/g, ' ').trim()

  const surnames = authors.map((author) => personName(author).family)
  const authorDate = surnames.length === 0
    ? `“${source.title}”`
    : surnames.length === 1
      ? surnames[0]
      : surnames.length === 2
        ? `${surnames[0]} & ${surnames[1]}`
        : `${surnames[0]} et al.`
  return { reference, inText: `(${authorDate}, ${yearText})`, doi: doi ?? null }
}

export default function SourcesResults({ open, onOpenChange, claim }: Props) {
  const project = useCogdoc((s) => s.activeProject)
  const bumpLibrary = useCogdoc((s) => s.bumpLibrary)
  const [loading, setLoading] = useState(false)
  const [sources, setSources] = useState<FoundSource[]>([])
  const [error, setError] = useState<string | null>(null)
  const [emptyMessage, setEmptyMessage] = useState<string | null>(null)
  const [provider, setProvider] = useState<'openalex' | 'gemini' | null>(null)
  const [addedUrls, setAddedUrls] = useState<Set<string>>(new Set())
  const [addingUrl, setAddingUrl] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const requestId = useRef(0)

  const handleSearch = useCallback(async () => {
    if (!claim || claim.trim().length < 10) return
    const currentRequest = ++requestId.current
    setLoading(true)
    setError(null)
    setEmptyMessage(null)
    setProvider(null)
    setSources([])
    setAddedUrls(new Set())
    setHasSearched(true)
    try {
      const res = await api.findSources(claim, project?.id)
      if (currentRequest !== requestId.current) return
      if (res.error) {
        setError(res.detail ? `${res.error}: ${res.detail}` : res.error)
      } else if (res.sources.length === 0) {
        setEmptyMessage(res.message ?? 'No scholarly matches were found. Try selecting a shorter, more specific claim.')
      } else {
        setSources(res.sources)
        setProvider(res.provider ?? null)
        toast.success(`Found ${res.sources.length} sources`)
      }
    } catch (e) {
      if (currentRequest !== requestId.current) return
      setError((e as Error).message)
    } finally {
      if (currentRequest === requestId.current) setLoading(false)
    }
  }, [claim, project?.id])

  // Opening source discovery is the explicit author action. Search
  // immediately so selecting text and pressing Find sources is a one-step
  // workflow rather than a modal followed by a second confirmation click.
  useEffect(() => {
    if (!open || claim.trim().length < 10) return
    void handleSearch()
  }, [open, claim, handleSearch])

  async function handleAdd(source: FoundSource) {
    if (!project) return
    setAddingUrl(source.url)
    try {
      const citation = formatCitationSuggestions(source, project.citationStyle ?? 'harvard')
      const res = await api.addReference(project.id, {
        title: source.title,
        url: source.url,
        authors: source.citation?.authors,
        year: source.citation?.year,
        venue: source.citation?.venue,
        doi: source.citation?.doi,
        rawText: citation?.reference,
        style: project.citationStyle ?? 'harvard',
        provider: provider ?? undefined,
      })
      setAddedUrls((prev) => new Set([...prev, source.url]))
      bumpLibrary()
      toast.success(res.alreadySaved ? 'Reference already saved' : 'Reference saved', {
        description: source.openAccessUrl
          ? 'Open or download the full text, then upload the PDF for passage-level checks.'
          : 'Full text is not indexed. Upload a legal copy for passage-level checks.',
      })
    } catch (e) {
      toast.error('Failed to add source', { description: (e as Error).message })
    } finally {
      setAddingUrl(null)
    }
  }

  async function copyCitation(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label} copied`, { description: 'Verify the metadata against the source before submitting.' })
    } catch {
      toast.error('Could not access the clipboard')
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
            Cogdoc searches scholarly records first, then uses grounded web
            search only as a fallback. Open the original work before relying on
            it; <Plus className="inline h-3 w-3" /> saves its metadata to your
            library. Upload a legal PDF copy for passage-level evidence checks.
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
                Searching scholarly records…
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
            {provider && sources.length > 0 && <div className="flex items-center justify-between rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-[11px] text-stone-600">
              <span>{provider === 'openalex' ? 'Scholarly records from OpenAlex' : 'Grounded web fallback results'}</span>
              <span className="font-medium text-[#28614f]">{sources.length} matches</span>
            </div>}
            {error && (
              <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-rose-700">Search failed</p>
                  <p className="text-xs text-rose-600 mt-0.5">{error}</p>
                </div>
              </div>
            )}

            {!loading && !error && emptyMessage && (
              <div className="rounded-lg border border-stone-200 bg-stone-50 p-5 text-center">
                <BookOpen className="mx-auto mb-2 h-7 w-7 text-stone-300" />
                <p className="text-sm font-medium text-stone-700">No matches yet</p>
                <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-stone-500">{emptyMessage}</p>
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
                const citation = formatCitationSuggestions(source, project?.citationStyle ?? 'harvard')
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
                    {citation && <div className="mb-2 rounded-md border border-stone-200/80 bg-white/70 p-2.5">
                      <div className="flex items-center justify-between gap-2"><p className="font-mono text-[9px] uppercase tracking-[0.14em] text-stone-500">Suggested {project?.citationStyle === 'apa' ? 'APA' : 'Harvard'} reference</p><button type="button" onClick={() => copyCitation(citation.reference, 'Reference')} className="rounded p-1 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700" aria-label="Copy suggested reference"><Clipboard className="h-3.5 w-3.5" /></button></div>
                      <p className="mt-1 text-[11px] leading-4 text-stone-700">{citation.reference}</p>
                      <button type="button" onClick={() => copyCitation(citation.inText, 'In-text citation')} className="mt-2 text-[10px] font-medium text-[#28614f] hover:underline">Copy in-text {citation.inText}</button>
                      <p className="mt-1 text-[9px] leading-4 text-stone-400">Metadata suggestion—confirm authors, date, and venue against the original.</p>
                    </div>}
                    <div className="flex items-center gap-2">
                      {source.openAccessUrl && <a href={source.openAccessUrl} target="_blank" rel="noopener noreferrer" className="flex shrink-0 items-center gap-1 text-[10px] font-medium text-[#28614f] hover:underline"><Unlock className="h-3 w-3" />Open copy</a>}
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
                        {isAdded ? 'Saved' : 'Save'}
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
