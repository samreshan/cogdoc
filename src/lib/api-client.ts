/**
 * Typed API client for the Cogdoc frontend.
 */
import type { Project, Intervention, Analytics, PdfSummary, ReferenceSummary, ReviewItem, ReviewRun, VerificationReport } from '@/lib/types'
import type { FormattedCitation } from '@/lib/citation-format'

export interface AssistantReadiness {
  provider: 'gemini' | 'ollama' | 'groq' | 'custom'
  model: string
  configured: boolean
  local: boolean
  status: 'configured' | 'reachable' | 'missing_configuration' | 'authentication_failed' | 'quota_limited' | 'model_unavailable' | 'unreachable'
  message: string
}

export class ApiError extends Error {
  status: number
  payload: Record<string, unknown>
  constructor(status: number, payload: Record<string, unknown>) {
    super(String(payload.error ?? `Request failed: ${status}`))
    this.name = 'ApiError'
    this.status = status
    this.payload = payload
  }
}

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new ApiError(res.status, err)
  }
  return res.json()
}

export const api = {
  getUser: () => jsonFetch<{ user: {
    id: string
    email: string | null
    displayName: string | null
    dailyTokenBudget: number | null
    onboardingCompletedAt: string | null
  } }>('/api/user'),
  setOnboardingCompleted: (onboardingCompleted: boolean) =>
    jsonFetch<{ onboardingCompletedAt: string | null }>('/api/user', {
      method: 'PATCH',
      body: JSON.stringify({ onboardingCompleted }),
    }),

  // Real-world workspaces (projects remain as compatibility routes)
  listWorkspaces: () => jsonFetch<{ workspaces: Project[] }>('/api/workspaces'),
  createWorkspace: (input: {
    title: string
    workspaceType: 'assignment' | 'research'
    dueAt?: string | null
    reviewPace?: 'rapid' | 'guided' | 'deep'
    citationStyle?: 'harvard' | 'apa'
    description?: string
    briefText?: string
  }) => jsonFetch<{ workspace: Project }>('/api/workspaces', { method: 'POST', body: JSON.stringify(input) }),
  getWorkspace: (id: string) => jsonFetch<{ workspace: Project & {
    reviewItems?: ReviewItem[]
    reviewRuns?: ReviewRun[]
    reports?: VerificationReport[]
  } }>(`/api/workspaces/${id}`),
  updateWorkspace: (id: string, patch: Record<string, unknown>) =>
    jsonFetch<{ workspace: Project }>(`/api/workspaces/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteWorkspace: (id: string) => jsonFetch<{ ok: boolean }>(`/api/workspaces/${id}`, { method: 'DELETE' }),
  importWorkspaceFile: async (id: string, file: File, kind: 'docx' | 'brief' | 'source' | 'code' = 'docx') => {
    const form = new FormData()
    form.append('file', file)
    form.append('kind', kind)
    const res = await fetch(`/api/workspaces/${id}/imports`, { method: 'POST', body: form })
    const body = await res.json().catch(() => ({ error: res.statusText }))
    if (!res.ok) throw new ApiError(res.status, body)
    return body
  },
  startReview: (id: string, scope: 'full' | 'changed_blocks' = 'full') =>
    jsonFetch<{ reviewRun: ReviewRun }>(`/api/workspaces/${id}/review-runs`, {
      method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ scope }),
    }),
  listReviewItems: (id: string, reviewRunId?: string) =>
    jsonFetch<{ reviewItems: ReviewItem[]; reviewRunId: string | null; stale?: boolean }>(`/api/workspaces/${id}/review-items${reviewRunId ? `?reviewRunId=${reviewRunId}` : ''}`),
  respondToReviewItem: (id: string, body: { responseText?: string; action?: 'resolve' | 'dismiss'; resolution?: string; beforeText?: string; afterText?: string }) =>
    jsonFetch<{ reviewItem: ReviewItem; blockersRemaining: number }>(`/api/review-items/${id}/responses`, {
      method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify(body),
    }),
  recheckReviewItem: (id: string) => jsonFetch<{ reviewItem: ReviewItem; needsReviewRun: boolean }>(`/api/review-items/${id}/recheck`, { method: 'POST' }),
  getEvidenceCandidates: (claimId: string) => jsonFetch<{
    passages: Array<{ chunkId: string; content: string; similarityScore: number; pageApprox: number; pdfFilename: string }>
    code: Array<{ codeFileId: string; path: string; language: string | null; startLine: number; endLine: number; excerpt: string; score: number }>
  }>(`/api/claims/${claimId}/evidence-candidates`),
  linkEvidence: (claimId: string, evidence: Record<string, unknown>) =>
    jsonFetch<{ evidenceLink: { id: string; supportStatus: string }; resolved: boolean }>(`/api/claims/${claimId}/evidence-links`, {
      method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ ...evidence, confirmed: true }),
    }),
  generateReport: (id: string) => jsonFetch<{ report: VerificationReport; eligibleForCertificate: boolean }>(`/api/workspaces/${id}/reports`, { method: 'POST' }),
  createCertificate: (id: string) => jsonFetch<{ certificate: { id: string }; shareUrl: string; expiresAt: string; pdfUrl: string; documentUrl: string }>(`/api/workspaces/${id}/certificates`, { method: 'POST' }),
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
  saveDocument: (id: string, content: string, baseRevision?: number) =>
    jsonFetch<{ ok: boolean; lastSaved: string; revision: number; contentHash: string }>(`/api/workspaces/${id}/document`, {
      method: 'PUT',
      body: JSON.stringify({ content, baseRevision }),
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
  listReferences: (projectId: string) =>
    jsonFetch<{ references: ReferenceSummary[] }>(`/api/workspaces/${projectId}/references`),
  addReference: (projectId: string, input: {
    title: string
    url: string
    authors?: string[]
    year?: string | null
    venue?: string | null
    doi?: string | null
    rawText?: string
    style?: 'harvard' | 'apa'
    provider?: 'openalex' | 'crossref' | 'gemini'
  }) => jsonFetch<{ reference: ReferenceSummary; alreadySaved: boolean }>(`/api/workspaces/${projectId}/references`, {
    method: 'POST',
    body: JSON.stringify(input),
  }),
  verifyReference: (projectId: string, referenceId: string) =>
    jsonFetch<{
      reference: ReferenceSummary
      verified: boolean
      confidence: number
      metadata: { provider: 'crossref' | 'datacite'; doi: string; title: string | null; year: string | null; authors: string[]; url: string | null } | null
    }>(`/api/workspaces/${projectId}/references`, {
      method: 'PATCH',
      body: JSON.stringify({ referenceId, verifyMetadata: true }),
    }),
  confirmReferenceMetadata: (projectId: string, referenceId: string) =>
    jsonFetch<{ reference: ReferenceSummary }>(`/api/workspaces/${projectId}/references`, {
      method: 'PATCH',
      body: JSON.stringify({ referenceId, confirmMetadata: true }),
    }),

  // AI engines
  interceptor: (
    projectId: string, prompt: string, context: string,
    paragraphId?: string, frictionMode?: 'socratic' | 'coach' | 'assistant',
  ) =>
    jsonFetch<{
      action: 'pass' | 'reframe'
      isDelegative: boolean
      confidence: number
      socraticQuestion?: string
      intervention?: Intervention
    }>('/api/interceptor', {
      method: 'POST',
      body: JSON.stringify({ projectId, prompt, context, paragraphId, friction_mode: frictionMode }),
    }),

  socraticSpacer: (
    projectId: string, context: string, stub?: string,
    paragraphId?: string, frictionMode?: 'socratic' | 'coach' | 'assistant',
  ) =>
    jsonFetch<{ ghostQuestion: string; intervention: Intervention }>('/api/socratic-spacer', {
      method: 'POST',
      body: JSON.stringify({ projectId, context, stub, paragraphId, friction_mode: frictionMode }),
    }),

  citationSentinel: (
    projectId: string, claim: string,
    paragraphId?: string, frictionMode?: 'socratic' | 'coach' | 'assistant',
  ) =>
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
      body: JSON.stringify({ projectId, claim, paragraphId, friction_mode: frictionMode }),
    }),

  scaffold: (
    projectId: string, prompt: string, context: string,
    paragraphId?: string, frictionMode?: 'socratic' | 'coach' | 'assistant',
  ) =>
    jsonFetch<{ scaffold: string; intervention: Intervention }>('/api/scaffold', {
      method: 'POST',
      body: JSON.stringify({ projectId, prompt, context, paragraphId, friction_mode: frictionMode }),
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

  // Find sources (scholarly index, with grounded-web fallback)
  findSources: (claim: string, projectId?: string) =>
    jsonFetch<{
      sources: Array<{
        title: string
        url: string
        snippet: string
        relevance: 'high' | 'medium' | 'low'
        recordProvider: 'openalex' | 'crossref' | 'gemini'
        openAccessUrl?: string | null
        isOpenAccess?: boolean
        openAccessProvider?: 'openalex' | 'unpaywall' | null
        openAccessHostType?: string | null
        openAccessVersion?: string | null
        openAccessLicense?: string | null
        citation?: {
          authors: string[]
          year: string | null
          venue: string | null
          doi: string | null
          volume?: string | null
          issue?: string | null
          pages?: string | null
          publisher?: string | null
          formatted?: FormattedCitation
        }
      }>
      query?: string
      totalFound?: number
      provider?: 'openalex' | 'crossref' | 'gemini'
      providersTried?: Array<'openalex' | 'crossref' | 'gemini'>
      accessResolver?: 'unpaywall' | null
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

  // Settings + friction calibration (PRODUCT.md §9)
  getSettings: () =>
    jsonFetch<{
      idleThresholdSeconds: number
      dailyTokenBudget: number
      frictionMode: 'socratic' | 'coach' | 'assistant'
      assistant: AssistantReadiness
    }>('/api/settings'),
  checkAssistant: () =>
    jsonFetch<{ assistant: AssistantReadiness }>('/api/settings?checkAssistant=1')
      .then(({ assistant }) => assistant),
  setFrictionMode: (frictionMode: 'socratic' | 'coach' | 'assistant') =>
    jsonFetch<{ frictionMode: string }>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify({ frictionMode }),
    }),

  // Experimental engines (§7)
  autocomplete: (
    projectId: string, draft: string,
    paragraphId?: string, frictionMode?: 'socratic' | 'coach' | 'assistant',
  ) =>
    jsonFetch<{ suggestion: ''; cue: string; insertable: false; intervention?: Intervention }>('/api/autocomplete', {
      method: 'POST',
      body: JSON.stringify({ projectId, draft, paragraphId, friction_mode: frictionMode }),
    }),
  blindspot: (projectId: string, draft: string) =>
    jsonFetch<{
      blindspot: { chunkId: string; text: string; relevance: number } | null
      intervention?: Intervention
    }>('/api/blindspot', {
      method: 'POST',
      body: JSON.stringify({ projectId, draft }),
    }),
}
