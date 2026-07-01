/**
 * Typed API client for the Cogdoc frontend.
 */
import type { Project, Intervention, Analytics, PdfSummary } from '@/lib/types'

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error ?? `Request failed: ${res.status}`)
  }
  return res.json()
}

export const api = {
  // Projects
  listProjects: () => jsonFetch<{ projects: Project[] }>('/api/projects'),
  createProject: (title: string, description?: string) =>
    jsonFetch<{ project: Project }>('/api/projects', {
      method: 'POST',
      body: JSON.stringify({ title, description }),
    }),
  getProject: (id: string) => jsonFetch<{ project: Project }>(`/api/projects/${id}`),
  deleteProject: (id: string) =>
    jsonFetch<{ ok: boolean }>(`/api/projects/${id}`, { method: 'DELETE' }),
  saveDocument: (id: string, content: string) =>
    jsonFetch<{ ok: boolean; lastSaved: string }>(`/api/projects/${id}/document`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    }),

  // PDFs
  listPdfs: (projectId: string) =>
    jsonFetch<{ pdfs: PdfSummary[] }>(`/api/projects/${projectId}/pdfs`),
  uploadPdfFile: async (projectId: string, file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch(`/api/projects/${projectId}/pdfs`, { method: 'POST', body: fd })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }))
      throw new Error(err.error ?? 'Upload failed')
    }
    return res.json()
  },
  uploadPdfText: (projectId: string, filename: string, text: string) =>
    jsonFetch(`/api/projects/${projectId}/pdfs`, {
      method: 'POST',
      body: JSON.stringify({ filename, text }),
    }),
  deletePdf: (id: string) => jsonFetch<{ ok: boolean }>(`/api/pdfs/${id}`, { method: 'DELETE' }),

  // AI engines
  interceptor: (projectId: string, prompt: string, context: string, paragraphId?: string) =>
    jsonFetch<{
      action: 'pass' | 'reframe'
      isDelegative: boolean
      confidence: number
      socraticQuestion?: string
      intervention?: Intervention
    }>('/api/interceptor', {
      method: 'POST',
      body: JSON.stringify({ projectId, prompt, context, paragraphId }),
    }),

  socraticSpacer: (projectId: string, context: string, stub?: string, paragraphId?: string) =>
    jsonFetch<{ ghostQuestion: string; intervention: Intervention }>('/api/socratic-spacer', {
      method: 'POST',
      body: JSON.stringify({ projectId, context, stub, paragraphId }),
    }),

  citationSentinel: (projectId: string, claim: string, paragraphId?: string) =>
    jsonFetch<{
      verdict: string
      explanation: string
      supportedClaims: string[]
      unsupportedClaims: string[]
      evidence: Array<{
        chunkId: string
        excerpt: string
        fullContent: string
        similarityScore: number
        pageApprox: number
        pdfFilename: string
        evidenceId?: string
      }>
      intervention: Intervention
    }>('/api/citation-sentinel', {
      method: 'POST',
      body: JSON.stringify({ projectId, claim, paragraphId }),
    }),

  scaffold: (projectId: string, prompt: string, context: string, paragraphId?: string) =>
    jsonFetch<{ scaffold: string; intervention: Intervention }>('/api/scaffold', {
      method: 'POST',
      body: JSON.stringify({ projectId, prompt, context, paragraphId }),
    }),

  // Interventions
  listInterventions: (projectId: string) =>
    jsonFetch<{ interventions: Intervention[] }>(`/api/interventions?projectId=${projectId}`),
  patchIntervention: (id: string, patch: { userAction?: string; status?: string }) =>
    jsonFetch<{ intervention: Intervention }>(`/api/interventions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  // Analytics
  getAnalytics: (projectId: string) =>
    jsonFetch<Analytics>(`/api/analytics?projectId=${projectId}`),

  // Find sources (web search)
  findSources: (claim: string, projectId?: string) =>
    jsonFetch<{
      sources: Array<{
        title: string
        url: string
        snippet: string
        relevance: 'high' | 'medium' | 'low'
      }>
      query?: string
      totalFound?: number
      message?: string
      error?: string
      detail?: string
    }>('/api/find-sources', {
      method: 'POST',
      body: JSON.stringify({ claim, projectId }),
    }),

  // Add a web source to the project library
  addSource: (projectId: string, url: string, title?: string) =>
    jsonFetch<{
      ok: boolean
      source?: { id: string; filename: string; url: string; chunkCount: number; sizeBytes: number }
      error?: string
      detail?: string
    }>(`/api/projects/${projectId}/add-source`, {
      method: 'POST',
      body: JSON.stringify({ url, title }),
    }),
}
