'use client'

import type { Editor } from '@tiptap/core'
import { useEffect, useState } from 'react'
import { AlertCircle, Check, FileText, MousePointer2, RefreshCw, ScanSearch, TextCursorInput, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { reviewNaturalStyle, type StyleReviewResult, type StyleReviewScope, type StyleSuggestion } from '@/lib/style-review'
import { styleReviewBlocksForScope } from '@/lib/style-review-editor'

interface StyleReviewPanelProps {
  editor: Editor
  open: boolean
  onOpenChange: (open: boolean) => void
}

const scopeMeta: Array<{ scope: StyleReviewScope; label: string; icon: typeof MousePointer2 }> = [
  { scope: 'selection', label: 'Selection', icon: MousePointer2 },
  { scope: 'paragraph', label: 'Paragraph', icon: TextCursorInput },
  { scope: 'document', label: 'Document', icon: FileText },
]

function suggestionTone(suggestion: StyleSuggestion): string {
  return suggestion.severity === 'consider'
    ? 'border-amber-300 bg-amber-50/70'
    : 'border-stone-200 bg-white'
}

export default function StyleReviewPanel({ editor, open, onOpenChange }: StyleReviewPanelProps) {
  const [result, setResult] = useState<StyleReviewResult | null>(null)
  const [stale, setStale] = useState(false)
  const [selectionEmpty, setSelectionEmpty] = useState(editor.state.selection.empty)
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    const selectionUpdate = () => setSelectionEmpty(editor.state.selection.empty)
    const update = () => {
      if (result) setStale(true)
    }
    editor.on('selectionUpdate', selectionUpdate)
    editor.on('update', update)
    return () => {
      editor.off('selectionUpdate', selectionUpdate)
      editor.off('update', update)
    }
  }, [editor, result])

  function runReview(scope: StyleReviewScope) {
    const blocks = styleReviewBlocksForScope(editor.state.doc, editor.state.selection, scope)
    setResult(reviewNaturalStyle({ scope, blocks }))
    setDismissed(new Set())
    setStale(false)
  }

  function focusSuggestion(suggestion: StyleSuggestion) {
    editor.chain().focus().setTextSelection({ from: suggestion.from, to: suggestion.to }).scrollIntoView().run()
  }

  const visibleSuggestions = result?.suggestions.filter((suggestion) => !dismissed.has(suggestion.id)) ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[82vh] max-w-2xl overflow-hidden p-0">
        <DialogHeader className="border-b border-stone-200 px-6 pb-4 pt-6">
          <DialogTitle className="flex items-center gap-2 font-serif text-xl">
            <ScanSearch className="h-5 w-5 text-[#386c5c]" /> Natural style review
          </DialogTitle>
          <DialogDescription className="max-w-xl text-xs leading-5 text-stone-500">
            Local, rule-based suggestions for clarity and cadence. Cogdoc does not change your document, score authorship, or assess detector outcomes.
          </DialogDescription>
        </DialogHeader>

        <div className="border-b border-stone-200 bg-[#f8f6f0] px-6 py-3">
          <div className="flex flex-wrap gap-2">
            {scopeMeta.map(({ scope, label, icon: Icon }) => (
              <Button
                key={scope}
                type="button"
                size="sm"
                variant={result?.scope === scope ? 'default' : 'outline'}
                disabled={scope === 'selection' && selectionEmpty}
                onClick={() => runReview(scope)}
                className={result?.scope === scope ? 'bg-[#173f35] hover:bg-[#245548]' : 'border-stone-300 bg-white'}
              >
                <Icon className="mr-1.5 h-3.5 w-3.5" /> Review {label.toLowerCase()}
              </Button>
            ))}
          </div>
          {stale && result && (
            <div className="mt-3 flex items-center justify-between gap-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900" role="status">
              <span>Your draft changed after this review. Refresh before relying on these suggestions.</span>
              <Button size="sm" variant="outline" onClick={() => runReview(result.scope)} className="h-7 border-amber-300 bg-white text-[11px]">
                <RefreshCw className="mr-1 h-3 w-3" /> Refresh
              </Button>
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {!result ? (
            <div className="py-10 text-center">
              <ScanSearch className="mx-auto h-8 w-8 text-[#386c5c]" />
              <p className="mt-4 text-sm font-medium text-stone-800">Choose a scope to begin</p>
              <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-stone-500">Each suggestion explains a visible writing pattern and gives you a question to guide your own revision.</p>
            </div>
          ) : visibleSuggestions.length === 0 ? (
            <div className="py-10 text-center">
              <Check className="mx-auto h-8 w-8 text-[#386c5c]" />
              <p className="mt-4 text-sm font-medium text-stone-800">No patterns need attention in this scope</p>
              <p className="mt-2 text-xs text-stone-500">This is a focused style review, not a judgment of quality or authorship.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-[11px] text-stone-500">
                <span>{visibleSuggestions.length} suggestion{visibleSuggestions.length === 1 ? '' : 's'} across {result.reviewedWordCount} reviewed words</span>
                <span>Click one to select the passage</span>
              </div>
              {visibleSuggestions.map((suggestion) => (
                <article key={suggestion.id} className={`rounded-lg border p-4 ${suggestionTone(suggestion)}`}>
                  <div className="flex items-start gap-3">
                    <AlertCircle className={`mt-0.5 h-4 w-4 shrink-0 ${suggestion.severity === 'consider' ? 'text-amber-700' : 'text-stone-500'}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-sm font-medium text-stone-800">{suggestion.title}</h3>
                        <button onClick={() => setDismissed((items) => new Set([...items, suggestion.id]))} className="text-stone-400 hover:text-stone-700" aria-label={`Dismiss ${suggestion.title}`}>
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <button onClick={() => focusSuggestion(suggestion)} className="mt-2 block w-full rounded border border-stone-200 bg-white px-3 py-2 text-left text-xs italic leading-5 text-stone-700 hover:border-[#386c5c] focus-visible:outline-[#386c5c]">
                        “{suggestion.excerpt}”
                      </button>
                      <p className="mt-2 text-xs leading-5 text-stone-600">{suggestion.detail}</p>
                      <p className="mt-2 text-xs font-medium leading-5 text-[#28614f]">Try: {suggestion.authorPrompt}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
