import { observeGuideSuccess } from '@/lib/live-research-guide'
/**
 * Typed API client for the Cogdoc frontend.
 */
import type { Project, Intervention, InterventionAnswerResult, Analytics, PdfSummary, ReferenceSummary, ReviewItem, ReviewRun, VerificationReport, ResearchWorkspaceSnapshot, ResearchNote, ResearchAction, AcademicProfile, SourceMapResult, ResearchDialogueAnswers, ResearchDialogueDraft, ResearchKickoffDraft, ResearchKickoffOutlineItem, ResearchKickoffPlan, ResearchHistorySnapshot, ResearchContextSummary, ResearchFindingJourney, ResearchQuestionSummary } from '@/lib/types'
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
  const data = await res.json()
  observeGuideSuccess(url, init, data)
  return data
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
    jsonFetch<{ workspace: Project; referencesReformatted?: number; referencesNeedingReview?: number }>(`/api/workspaces/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteWorkspace: (id: string) => jsonFetch<{ ok: boolean }>(`/api/workspaces/${id}`, { method: 'DELETE' }),
  getResearchWorkspace: (id: string) => jsonFetch<ResearchWorkspaceSnapshot>(`/api/workspaces/${id}/research`),
  getInvestigation: (id: string) => jsonFetch<{ context: ResearchContextSummary | null; questions: ResearchQuestionSummary[] }>(`/api/workspaces/${id}/investigation`),
  saveInvestigation: (id: string, input: Partial<Pick<ResearchContextSummary, 'topic' | 'purpose' | 'existingUnderstanding' | 'scope' | 'selectedQuestionId'>> & { expectedRevision?: number }) =>
    jsonFetch<{ context: ResearchContextSummary }>(`/api/workspaces/${id}/investigation`, { method: 'POST', body: JSON.stringify(input) }),
  proposeInvestigationPlan: (id: string, input: { topic: string; purpose?: string }) =>
    jsonFetch<{ proposal: Array<{ wording: string; rationale: string }>; source: 'manual_template' }>(`/api/workspaces/${id}/investigation`, { method: 'POST', body: JSON.stringify({ action: 'propose', ...input }) }),
  createResearchQuestion: (id: string, input: { wording: string; rationale?: string; parentId?: string | null }) =>
    jsonFetch<{ question: ResearchQuestionSummary; context: ResearchContextSummary }>(`/api/workspaces/${id}/questions`, { method: 'POST', body: JSON.stringify(input) }),
  updateResearchQuestion: (id: string, input: Record<string, unknown>) =>
    jsonFetch<{ question?: ResearchQuestionSummary; context?: ResearchContextSummary; ok?: boolean }>(`/api/workspaces/${id}/questions`, { method: 'PATCH', body: JSON.stringify(input) }),
  getFindingJourney: (id: string) => jsonFetch<ResearchFindingJourney>(`/api/workspaces/${id}/findings`),
  researchFindingAction: (id: string, input: Record<string, unknown>) =>
    jsonFetch<Record<string, unknown>>(`/api/workspaces/${id}/findings`, { method: 'POST', body: JSON.stringify(input) }),
  requestContextualHelp: (id: string, input: { questionId: string; explanation: string; kind?: 'help' | 'hint' | 'example' | 'alternative' | 'next' | 'proposal'; passageId?: string; requested?: boolean }) =>
    jsonFetch<{ help?: { kind: string; title: string; body: string; basis: string; action: string; hypothetical: boolean; noUsefulGap?: boolean; proposal?: { conclusion: string; uncertainty: string; limitations: string; conflicts: string } }; exchange?: { id: string }; contextKey?: string; providerStatus?: 'configured' | 'deterministic_fallback'; suppressed?: boolean; message?: string }>(`/api/workspaces/${id}/research-help`, { method: 'POST', body: JSON.stringify(input) }),
  controlContextualHelp: (id: string, input: { questionId: string; contextKey: string; action: 'dismiss' | 'snooze' }) =>
    jsonFetch<Record<string, unknown>>(`/api/workspaces/${id}/research-help`, { method: 'PATCH', body: JSON.stringify(input) }),
  reviewFindingRevision: (workspaceId: string, findingId: string, input: { findingRevisionId: string; expectedRevision: number; decision: string; note?: string }) =>
    jsonFetch<Record<string, unknown>>(`/api/workspaces/${workspaceId}/findings/${findingId}/review`, { method: 'POST', body: JSON.stringify(input) }),
  createResearchArticle: (workspaceId: string, input: { path: 'manual_outline' | 'generated_draft'; title: string; audience: string; purpose: string; findingRevisionIds: string[] }) =>
    jsonFetch<{ article: { id: string; path: string; status: string }; warning?: string | null }>(`/api/workspaces/${workspaceId}/articles`, { method: 'POST', body: JSON.stringify(input) }),
  getResearchHistory: (id: string) => jsonFetch<ResearchHistorySnapshot>(`/api/workspaces/${id}/history`),
  recordDecision: (id: string, input: { type: string; summary: string; entityType?: string; entityId?: string; detail?: Record<string, unknown> }) =>
    jsonFetch<{ event: { id: string; type: string; createdAt: string } }>(`/api/workspaces/${id}/history`, {
      method: 'POST', body: JSON.stringify(input),
    }),
  mapSources: (id: string, question: string) => jsonFetch<SourceMapResult>(`/api/workspaces/${id}/source-map`, {
    method: 'POST', body: JSON.stringify({ question }),
  }),
  draftFromResearchDialogue: (projectId: string, answers: ResearchDialogueAnswers) =>
    jsonFetch<ResearchDialogueDraft>('/api/research-dialogue', {
      method: 'POST', body: JSON.stringify({ projectId, answers }),
    }),
  planResearchKickoff: (topic: string, conversation: Array<{ question: string; answer: string }> = []) => jsonFetch<{ plan: ResearchKickoffPlan; assistantFallback: boolean }>('/api/research-kickoff', {
    method: 'POST', body: JSON.stringify({ action: 'plan', topic, conversation }),
  }),
  draftResearchKickoff: (input: {
    projectId: string
    topic: string
    outline: ResearchKickoffOutlineItem[]
    responses: Array<{ question: string; answer: string }>
  }) => jsonFetch<{ draft: ResearchKickoffDraft }>('/api/research-kickoff', {
    method: 'POST', body: JSON.stringify({ action: 'draft', ...input }),
  }),
  getResearchSource: (projectId: string, sourceId: string) => jsonFetch<{
    workspaceSource: ResearchWorkspaceSnapshot['sources'][number]
    passages: Array<{ id: string; chunkIndex: number; pageApprox: number; content: string }>
    hasPrivateFile: boolean
  }>(`/api/workspaces/${projectId}/sources/${sourceId}`),
  saveWorkspaceSource: (projectId: string, input: {
    title: string
    url?: string
    canonicalUrl?: string
    doi?: string | null
    metadata?: Record<string, unknown>
  }) => jsonFetch<{ workspaceSource: { id: string }; alreadySaved: boolean }>(`/api/workspaces/${projectId}/sources`, {
    method: 'POST', body: JSON.stringify(input),
  }),
  createResearchNote: (projectId: string, input: Record<string, unknown>) =>
    jsonFetch<{ note: ResearchNote }>(`/api/workspaces/${projectId}/notebook`, { method: 'POST', body: JSON.stringify(input) }),
  updateResearchAction: (projectId: string, actionId: string, patch: Record<string, unknown>) =>
    jsonFetch<{ action: ResearchAction }>(`/api/workspaces/${projectId}/actions`, { method: 'PATCH', body: JSON.stringify({ actionId, ...patch }) }),
  requestSynthesis: (projectId: string, input: { kind: string; prompt: string; passageIds: string[] }) =>
    jsonFetch<{ synthesis: { id: string; status: string } }>(`/api/workspaces/${projectId}/syntheses`, { method: 'POST', body: JSON.stringify({ ...input, confirmedByAuthor: true }) }),
  saveAcademicProfile: (projectId: string, input: Record<string, unknown> & { profileId?: string }) =>
    jsonFetch<{ profile: AcademicProfile }>(`/api/workspaces/${projectId}/profiles`, { method: input.profileId ? 'PATCH' : 'POST', body: JSON.stringify(input) }),
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
    volume?: string | null
    issue?: string | null
    pages?: string | null
    publisher?: string | null
    provider?: 'openalex' | 'crossref' | 'semantic_scholar' | 'gemini'
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
    jsonFetch<{
      ghostQuestion: string
      intervention: Intervention
      assistantFallback: boolean
      assistantMessage?: string
    }>('/api/socratic-spacer', {
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
  answerIntervention: (id: string, answer: string) =>
    jsonFetch<InterventionAnswerResult>(`/api/interventions/${id}/responses`, {
      method: 'POST',
      body: JSON.stringify({ answer }),
    }),

  // Analytics
  getAnalytics: (projectId: string) =>
    jsonFetch<Analytics>(`/api/analytics?projectId=${projectId}`),

  // Find sources (scholarly index, with grounded-web fallback)
  findSources: (claim: string, projectId?: string, context?: { purpose?: string | null; uncertainty?: string | null; questionId?: string }) =>
    jsonFetch<{
      sources: Array<{
        title: string
        url: string
        snippet: string
        relevance: 'high' | 'medium' | 'low'
        recordProvider: 'openalex' | 'crossref' | 'semantic_scholar' | 'gemini'
        openAccessUrl?: string | null
        isOpenAccess?: boolean
        openAccessProvider?: 'openalex' | 'semantic_scholar' | 'unpaywall' | null
        openAccessHostType?: string | null
        openAccessVersion?: string | null
        openAccessLicense?: string | null
        role?: 'orientation' | 'evidence_candidate'
        relevanceExplanation?: string
        rationaleBasis?: 'metadata' | 'abstract'
        relevanceBasis?: string
        accessState?: 'full_text_accessible' | 'abstract_only' | 'metadata_only'
        authoritySignals?: string[]
        authorityLimitations?: string
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
      provider?: 'openalex' | 'crossref' | 'semantic_scholar' | 'gemini'
      providersTried?: Array<'openalex' | 'crossref' | 'semantic_scholar' | 'gemini'>
      providerStatus?: Record<string, 'available' | 'unavailable'>
      accessResolver?: 'unpaywall' | null
      message?: string
      error?: string
      detail?: string
    }>('/api/find-sources', {
      method: 'POST',
      body: JSON.stringify(context?.questionId ? { question: claim, projectId, purpose: context.purpose, uncertainty: context.uncertainty } : { claim, projectId }),
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
