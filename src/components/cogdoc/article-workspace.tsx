'use client'

import { completeGuideAction, downloadGuideArtifact } from '@/lib/live-research-guide'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, FileText, RefreshCw, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ArticleCompositionPanel, type ArticleCandidate } from '@/components/cogdoc/article-composition-panel'

type ArticlePath = 'manual_outline' | 'generated_draft'

interface ArticleArtifact {
  id: string
  title: string | null
  path: ArticlePath
  content: string
  revision: number
  status: string
  generationStatus: string | null
  updatedAt: string
}

async function responseJson(response: Response) {
  const body = await response.json().catch(() => ({})) as { error?: string }
  if (!response.ok) throw new Error(body.error || 'The article request could not be completed.')
  return body
}

export function ArticleWorkspace({ projectId }: { projectId: string }) {
  const [candidates, setCandidates] = useState<ArticleCandidate[]>([])
  const [articles, setArticles] = useState<ArticleArtifact[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const selectedArticle = useMemo(() => articles.find((article) => article.id === selectedId) ?? null, [articles, selectedId])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [candidateBody, articleBody] = await Promise.all([
        fetch('/api/workspaces/' + projectId + '/articles/candidates').then(responseJson),
        fetch('/api/workspaces/' + projectId + '/articles').then(responseJson),
      ])
      const candidatePayload = candidateBody as { candidates?: unknown }
      const articlePayload = articleBody as { articles?: unknown }
      const nextCandidates = Array.isArray(candidatePayload.candidates) ? candidatePayload.candidates.filter((candidate): candidate is ArticleCandidate => typeof candidate === 'object' && candidate !== null && typeof (candidate as { findingRevisionId?: unknown }).findingRevisionId === 'string') : []
      const nextArticles = Array.isArray(articlePayload.articles) ? articlePayload.articles as ArticleArtifact[] : []
      setCandidates(nextCandidates)
      setArticles(nextArticles)
      setSelectedId((current) => nextArticles.some((article) => article.id === current) ? current : nextArticles[0]?.id ?? null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load article work.')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { void refresh() }, [refresh])
  useEffect(() => { setContent(selectedArticle?.content ?? '') }, [selectedArticle?.id, selectedArticle?.content])

  async function create(input: { path: ArticlePath; title: string; audience: string; purpose: string; findingRevisionIds: string[] }) {
    setPending(true)
    setError(null)
    setNotice(null)
    try {
      const body = await fetch('/api/workspaces/' + projectId + '/articles', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input),
      }).then(responseJson) as { article: ArticleArtifact; warning?: string | null }
      setNotice(body.warning || (input.path === 'generated_draft' ? 'Draft created. Review its source mappings and uncertainty.' : 'Manual outline created.'))
      await refresh()
      setSelectedId(body.article.id)
      completeGuideAction(projectId, 'article')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create the article.')
    } finally {
      setPending(false)
    }
  }

  async function save() {
    if (!selectedArticle) return
    setPending(true)
    setError(null)
    setNotice(null)
    try {
      const body = await fetch('/api/workspaces/' + projectId + '/articles/' + selectedArticle.id, {
        method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content }),
      }).then(responseJson) as { article: ArticleArtifact; warning?: string | null }
      setArticles((current) => current.map((article) => article.id === body.article.id ? { ...article, ...body.article } : article))
      setContent(body.article.content)
      setNotice(body.warning || 'Article saved for review.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save the article.')
    } finally {
      setPending(false)
    }
  }

  async function exportArticle() {
    if (!selectedArticle) return
    try { await downloadGuideArtifact(projectId, '/api/workspaces/' + projectId + '/articles/' + selectedArticle.id + '/export', 'research-article.md') }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Export failed. Retry after saving.') }
  }

  return <section className="space-y-4" aria-label="Article workspace">
    <ArticleCompositionPanel candidates={candidates} onCreate={create} generatedLabel={articles.length ? 'Regenerate from selected findings' : 'Generate review-needed draft'} />
    {loading ? <p className="text-sm text-slate-600">Loading article work…</p> : null}
    {error ? <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
    {notice ? <p role="status" className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p> : null}
    <section className="rounded-xl border border-slate-200 bg-white p-5" aria-label="Article artifacts">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-semibold uppercase tracking-[.14em] text-violet-700">Saved articles</p><h3 className="mt-1 text-lg font-semibold">Inspect, revise, and export</h3></div><Button type="button" variant="outline" size="sm" disabled={loading || pending} onClick={() => void refresh()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button></div>
      {!loading && !articles.length ? <p className="mt-4 text-sm text-slate-600">No article artifacts yet. Start with reviewed findings above.</p> : null}
      {articles.length ? <div className="mt-4 grid gap-4 lg:grid-cols-[13rem_1fr]"><div className="space-y-2" role="list" aria-label="Saved article list">{articles.map((article) => <button key={article.id} type="button" role="listitem" className={'w-full rounded-lg border p-3 text-left text-sm ' + (article.id === selectedArticle?.id ? 'border-violet-500 bg-violet-50' : 'border-slate-200')} onClick={() => setSelectedId(article.id)}><span className="flex items-center gap-2 font-medium"><FileText className="h-4 w-4" />{article.title || 'Untitled research article'}</span><span className="mt-1 block text-xs text-slate-600">{article.path === 'generated_draft' ? 'Generated draft' : 'Manual outline'} · {article.status}</span></button>)}</div>
        {selectedArticle ? <div className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-slate-600">Revision {selectedArticle.revision} · {selectedArticle.status}</p><div className="flex gap-2"><Button type="button" variant="outline" size="sm" disabled={pending} onClick={exportArticle}><Download className="mr-2 h-4 w-4" />Export Markdown</Button><Button type="button" size="sm" disabled={pending || !content.trim()} onClick={() => void save()}><Save className="mr-2 h-4 w-4" />Save edits</Button></div></div><textarea aria-label="Article content" className="min-h-72 w-full rounded-md border border-slate-300 bg-white p-3 font-mono text-sm" value={content} onChange={(event) => setContent(event.target.value)} /></div> : null}</div> : null}
    </section>
  </section>
}
