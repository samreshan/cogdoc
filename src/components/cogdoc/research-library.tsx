'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useCogdoc } from '@/lib/store'
import { api } from '@/lib/api-client'
import type { PdfSummary, ReferenceSummary } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
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
import { FileText, Upload, Trash2, Loader2, FilePlus, BookOpen, Check, AlertCircle, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'

export default function ResearchLibrary() {
  const project = useCogdoc((s) => s.activeProject)
  const libraryVersion = useCogdoc((s) => s.libraryVersion)
  const bumpLibrary = useCogdoc((s) => s.bumpLibrary)
  const [pdfs, setPdfs] = useState<PdfSummary[]>([])
  const [references, setReferences] = useState<ReferenceSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [pasteFilename, setPasteFilename] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!project) return
    setLoading(true)
    try {
      const [pdfResult, referenceResult] = await Promise.all([
        api.listPdfs(project.id),
        api.listReferences(project.id),
      ])
      setPdfs(pdfResult.pdfs)
      setReferences(referenceResult.references)
    } catch (e) {
      toast.error('Failed to load library', { description: (e as Error).message })
    } finally {
      setLoading(false)
    }
  }, [project])

  useEffect(() => {
    refresh()
  }, [refresh, libraryVersion])

  async function handleUploadFile(file: File) {
    if (!project) return
    setUploading(true)
    try {
      await api.uploadPdfFile(project.id, file)
      toast.success('PDF uploaded', { description: `${file.name} has been chunked and indexed.` })
      setUploadOpen(false)
      bumpLibrary()
      refresh()
    } catch (e) {
      toast.error('Upload failed', { description: (e as Error).message })
    } finally {
      setUploading(false)
    }
  }

  async function handlePasteText() {
    if (!project) return
    if (!pasteText.trim()) {
      toast.error('Please paste some text first')
      return
    }
    setUploading(true)
    try {
      const filename = pasteFilename.trim() || 'Pasted Text.txt'
      await api.uploadPdfText(project.id, filename, pasteText)
      toast.success('Text indexed', { description: `${filename} has been chunked and added to your library.` })
      setPasteOpen(false)
      setPasteText('')
      setPasteFilename('')
      bumpLibrary()
      refresh()
    } catch (e) {
      toast.error('Failed to index text', { description: (e as Error).message })
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete() {
    if (!deleteId) return
    try {
      await api.deletePdf(deleteId)
      toast.success('Source deleted')
      setDeleteId(null)
      bumpLibrary()
      refresh()
    } catch (e) {
      toast.error('Failed to delete', { description: (e as Error).message })
    }
  }

  if (!project) return null

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-stone-200 bg-white">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-stone-900">Research Library</h3>
            <p className="text-[11px] text-stone-500">{references.length} saved reference{references.length === 1 ? '' : 's'} · {pdfs.length} full text{pdfs.length === 1 ? '' : 's'} indexed</p>
          </div>
          <div className="flex items-center gap-1.5">
            <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="h-7 text-xs">
                  <Upload className="w-3 h-3 mr-1" />
                  Upload PDF
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Upload a research PDF</DialogTitle>
                  <DialogDescription>
                    The PDF will be parsed, chunked into ~500-token passages, and indexed for the Citation Sentinel to retrieve when verifying your claims.
                  </DialogDescription>
                </DialogHeader>
                <FileUploader onFile={handleUploadFile} uploading={uploading} />
              </DialogContent>
            </Dialog>
            <Dialog open={pasteOpen} onOpenChange={setPasteOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="ghost" className="h-7 text-xs">
                  <FilePlus className="w-3 h-3 mr-1" />
                  Paste text
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Paste text as a source</DialogTitle>
                  <DialogDescription>
                    Useful when you have article text from a webpage, an e-book, or notes. The text is chunked and indexed just like a PDF.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-2">
                  <Input
                    placeholder="Source name (e.g. Gerlich 2025 - AI Tools in Society)"
                    value={pasteFilename}
                    onChange={(e) => setPasteFilename(e.target.value)}
                  />
                  <Textarea
                    placeholder="Paste the full text of the source here..."
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    rows={10}
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setPasteOpen(false)}>Cancel</Button>
                  <Button onClick={handlePasteText} disabled={uploading} className="bg-stone-900 hover:bg-stone-800">
                    {uploading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
                    Index text
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {loading ? (
            <div className="text-center py-8 text-stone-400 text-xs">Loading library...</div>
          ) : pdfs.length === 0 && references.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="w-10 h-10 mx-auto text-stone-300 mb-3" />
              <p className="text-sm text-stone-600 font-medium mb-1">No sources yet</p>
              <p className="text-xs text-stone-500 max-w-xs mx-auto">
                Upload research PDFs or paste article text. The Citation Sentinel will retrieve relevant passages when you verify a claim.
              </p>
            </div>
          ) : pdfs.length === 0 ? (
            <div className="rounded-lg border border-dashed border-stone-300 bg-stone-50 p-4 text-center">
              <p className="text-xs font-medium text-stone-700">No full text indexed yet</p>
              <p className="mt-1 text-[11px] leading-4 text-stone-500">Saved references provide citation metadata. Upload a legal PDF copy when you want passage-level evidence checks.</p>
            </div>
          ) : (
            pdfs.map((pdf) => (
              <div
                key={pdf.id}
                className="group border border-stone-200 rounded-lg p-3 bg-white hover:bg-stone-50 transition-colors"
              >
                <div className="flex items-start gap-2">
                  <FileText className="w-4 h-4 text-stone-400 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-stone-800 truncate">{pdf.filename}</p>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-stone-500">
                      <span>{(pdf.sizeBytes / 1024).toFixed(0)} KB</span>
                      <span>·</span>
                      <span>{pdf._count.chunks} chunks</span>
                      <span>·</span>
                      <span>{new Date(pdf.uploadedAt).toLocaleDateString()}</span>
                    </div>
                    <div className="mt-1.5">
                      {pdf.parseStatus === 'ready' && (
                        <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] py-0 h-5">
                          <Check className="w-2.5 h-2.5 mr-1" />
                          Indexed
                        </Badge>
                      )}
                      {pdf.parseStatus === 'chunking' && (
                        <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] py-0 h-5">
                          <Loader2 className="w-2.5 h-2.5 mr-1 animate-spin" />
                          Indexing
                        </Badge>
                      )}
                      {pdf.parseStatus === 'failed' && (
                        <Badge variant="secondary" className="bg-rose-50 text-rose-700 border-rose-200 text-[10px] py-0 h-5">
                          <AlertCircle className="w-2.5 h-2.5 mr-1" />
                          Failed
                        </Badge>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setDeleteId(pdf.id)}
                    className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity p-1 hover:bg-rose-50 rounded text-stone-400 hover:text-rose-600"
                    aria-label="Delete source"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}

          {!loading && references.length > 0 && <section className="pt-4" aria-label="Saved references">
            <div className="mb-2 flex items-center justify-between"><h4 className="font-mono text-[10px] uppercase tracking-[0.15em] text-stone-500">Saved references</h4><span className="text-[10px] text-stone-400">Verify before submitting</span></div>
            <div className="space-y-2">
              {references.map((reference) => <article key={reference.id} className="rounded-lg border border-stone-200 bg-white p-3">
                <div className="flex items-start gap-2">
                  <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-[#386c5c]" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-5 text-stone-800">{reference.title ?? reference.rawText}</p>
                    <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-stone-500">{reference.rawText}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px]">
                      <span className={reference.metadataStatus === 'confirmed' || reference.metadataStatus === 'matched' ? 'text-emerald-700' : 'text-amber-700'}>{reference.metadataStatus === 'confirmed' || reference.metadataStatus === 'matched' ? 'Metadata verified' : 'Metadata needs verification'}</span>
                      {reference.source && <span className="text-[#28614f]">Linked to {reference.source.filename}</span>}
                      {reference.url && <a href={reference.url} target="_blank" rel="noopener noreferrer" className="ml-auto flex items-center gap-1 text-stone-500 hover:text-stone-800"><ExternalLink className="h-3 w-3" />Original</a>}
                    </div>
                  </div>
                </div>
              </article>)}
            </div>
          </section>}
        </div>
      </ScrollArea>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this source?</AlertDialogTitle>
            <AlertDialogDescription>
              The source and all its indexed chunks will be permanently removed from your library. Existing citation verdicts that referenced these chunks will be preserved but will no longer link to source text.
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

function FileUploader({ onFile, uploading }: { onFile: (f: File) => void; uploading: boolean }) {
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        const f = e.dataTransfer.files?.[0]
        if (f && f.type === 'application/pdf') onFile(f)
        else toast.error('Please drop a PDF file')
      }}
      className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
        dragOver ? 'border-stone-400 bg-stone-50' : 'border-stone-300'
      }`}
    >
      {uploading ? (
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-8 h-8 text-stone-400 animate-spin" />
          <p className="text-sm text-stone-600">Uploading and indexing...</p>
        </div>
      ) : (
        <>
          <Upload className="w-8 h-8 mx-auto text-stone-400 mb-3" />
          <p className="text-sm text-stone-700 mb-1">Drag and drop a PDF here</p>
          <p className="text-xs text-stone-500 mb-4">or</p>
          <Button
            variant="outline"
            onClick={() => inputRef.current?.click()}
            className="border-stone-300"
          >
            Choose a file
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onFile(f)
            }}
          />
        </>
      )}
    </div>
  )
}
