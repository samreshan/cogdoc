/**
 * Shared types for Cogdoc frontend.
 */

export type EngineType = 'interceptor' | 'socratic' | 'citation' | 'scaffold'

// Re-exported from friction.ts so the whole app imports FrictionMode from the
// single shared types barrel. friction.ts stays the source of truth.
export type { FrictionMode } from '@/lib/friction'

export type PetState = 'idle' | 'alert' | 'active' | 'react' | 'sleep'

export type Verdict =
  | 'supported'
  | 'partially_supported'
  | 'unsupported'
  | 'insufficient_evidence'

export type InterventionStatus = 'active' | 'faded' | 'resolved'
export type UserAction = 'engaged' | 'dismissed' | 'ignored'

export interface EvidenceItem {
  chunkId: string
  excerpt: string
  fullContent: string
  similarityScore: number
  pageApprox: number
  pdfFilename: string
  evidenceId?: string
}

export interface Intervention {
  id: string
  userId: string
  projectId: string
  paragraphId: string | null
  promptTemplateTag: string | null
  engineType: EngineType
  promptText: string | null
  responseText: string | null
  verdict: Verdict | null
  status: InterventionStatus
  userAction: UserAction | null
  createdAt: string
  resolvedAt: string | null
  evidences?: Array<{
    id: string
    similarityScore: number
    citedExcerpt: string
    chunk: { pageApprox: number; pdf: { filename: string } }
  }>
}

export interface InterventionAnswerResult {
  satisfied: boolean
  evaluator: 'ai' | 'local'
  evaluation: { satisfied: boolean; rationale: string; followUpQuestion: string | null }
  intervention: Intervention
  note: ResearchNote | null
  structuredLines: Array<{ label: string; value: string }>
  revisionProposal?: string | null
}

export interface ResearchDialogueAnswers {
  focus: string
  evidence: string
  tension: string
  contribution: string
}

export interface ResearchDialogueDraft {
  draft: string
  reflection: string
  sourceNeeds: string[]
}

export interface ResearchKickoffOutlineItem {
  heading: string
  purpose: string
}

export interface ResearchKickoffQuestion {
  id: string
  question: string
  why: string
}

export interface ResearchKickoffConversationTurn {
  question: string
  answer: string
}

export interface ResearchKickoffPlan {
  title: string
  description: string
  outline: ResearchKickoffOutlineItem[]
  questions: ResearchKickoffQuestion[]
}

export interface ResearchKickoffDraft {
  sections: Array<{ heading: string; content: string }>
  reflection: string
  sourceNeeds: string[]
}

export interface ResearchContextSummary {
  id: string
  projectId: string
  topic: string
  purpose: string | null
  existingUnderstanding: string | null
  scope: string | null
  selectedQuestionId: string | null
  lifecycleState: 'exploring' | 'paused' | 'concluded' | 'archived'
  revision: number
  createdAt: string
  updatedAt: string
}

export interface ResearchQuestionSummary {
  id: string
  projectId: string
  contextId: string
  parentId: string | null
  wording: string
  rationale: string | null
  state: 'open' | 'parked' | 'answered_for_now' | 'archived'
  sortOrder: number
  revision: number
  createdAt: string
  updatedAt: string
}

export interface ResearchFindingJourney {
  articleEnabled?: boolean
  context: ResearchContextSummary
  question: ResearchQuestionSummary | null
  workspaceSources: Array<{ id: string; source: { id: string; title: string; canonicalUrl?: string | null; parseStatus: string; metadataJson: string } }>
  resources: Array<{ id: string; workspaceSourceId: string; role: string; workspaceSource: { id: string; source: { id: string; title: string; canonicalUrl?: string | null; parseStatus: string; metadataJson: string } } }>
  exchanges: Array<{ id: string; body: string; createdAt: string }>
  findings: Array<{ id: string; disposition: string; reviewState: string; revisions: Array<{ id: string; revision: number; conclusion: string | null; researcherExplanation: string | null; uncertainty: string | null; limitations: string | null; conflicts: string | null; evidenceUnavailable: boolean; evidenceScope: string | null; reviews: Array<{ decision: string; createdAt: string }>; evidences: Array<{ id: string; workspaceSourceId: string | null; excerpt: string | null; locatorValue: string | null; locatorPrecision: string | null; role: string; workspaceSource: { source: { title: string } } | null }> }> }>
}

export interface PositionedIntervention extends Intervention {
  position: { top: number; left: number }
  fadingOut?: boolean
}

export interface PdfSummary {
  id: string
  filename: string
  sizeBytes: number
  parseStatus: string
  uploadedAt: string
  _count: { chunks: number }
}

export interface ReferenceSummary {
  id: string
  rawText: string
  style: string
  authorsJson: string
  year: string | null
  title: string | null
  doi: string | null
  url: string | null
  metadataStatus: string
  metadataConfidence: number
  metadataJson: string | null
  createdAt: string
  source: { id: string; filename: string } | null
}

export interface Project {
  id: string
  title: string
  description: string | null
  archived: boolean
  createdAt: string
  updatedAt: string
  workspaceType?: 'assignment' | 'research'
  dueAt?: string | null
  reviewPace?: 'rapid' | 'guided' | 'deep'
  citationStyle?: 'harvard' | 'apa'
  lifecycleState?: 'draft' | 'reviewing' | 'ready' | 'certified'
  briefText?: string | null
  document: { id: string; content: string; lastSaved: string; revision?: number; contentHash?: string } | null
  pdfs: PdfSummary[]
  interventions: Intervention[]
  _count: { pdfs: number; interventions: number }
}

export type Workspace = Project

export interface ReviewResponse {
  id: string
  responseText: string | null
  beforeText: string | null
  afterText: string | null
  createdAt: string
}

export interface ReviewItem {
  id: string
  projectId: string
  reviewRunId: string
  claimId?: string | null
  type: string
  severity: 'critical' | 'advisory'
  title: string
  detail: string
  evidenceJson: string
  anchorJson: string | null
  state: 'open' | 'in_progress' | 'submitted' | 'rechecking' | 'resolved' | 'dismissed' | 'unresolved'
  blocksCertification: boolean
  resolution: string | null
  createdAt: string
  resolvedAt: string | null
  responses?: ReviewResponse[]
}

export interface ReviewRun {
  id: string
  projectId: string
  documentVersionId: string
  scope: 'full' | 'changed_blocks'
  status: 'queued' | 'scanning' | 'ready' | 'failed' | 'cancelled'
  progress: number
  currentStage: string | null
  createdAt: string
  completedAt: string | null
  items?: ReviewItem[]
}

export interface VerificationReport {
  id: string
  level: 'scan_report' | 'reviewed_with_warnings' | 'process_verified'
  reportHash: string
  coverageJson: string
  createdAt: string
  payload?: Record<string, unknown>
}

export interface Analytics {
  total: number
  byEngine: Record<string, number>
  byAction: Record<string, number>
  byVerdict: Record<string, number>
  engagementRate: number
}

// Research IDE contracts. These deliberately describe project-owned views of
// private, user-owned library records; clients never receive storage keys.
export type ResearchEntityKind = 'document' | 'source' | 'note' | 'claim' | 'action' | 'reference' | 'requirement' | 'export' | 'history'

export interface IDEWorkspaceTab {
  id: string
  kind: ResearchEntityKind | 'sources' | 'notebook' | 'evidence' | 'actions' | 'requirements' | 'references' | 'exports'
  label: string
  entityId?: string
  closable?: boolean
}

export interface EditorContext {
  workspaceId: string
  activeTabId: string
  activeKind: ResearchEntityKind
  entityId?: string
  passageId?: string
  documentRange?: { from: number; to: number; quote?: string }
}

export interface LibrarySource {
  id: string
  title: string
  filename: string | null
  doi: string | null
  canonicalUrl: string | null
  contentHash: string | null
  mimeType: string | null
  sizeBytes: number
  parseStatus: string
  qualityScore: number
  qualityExplanation: string | null
  metadataJson: string
  createdAt: string
}

export interface WorkspaceSource {
  id: string
  projectId: string
  librarySourceId: string
  relevance: number
  status: 'saved' | 'reading' | 'used' | 'archived'
  notes: string | null
  citationUsageCount: number
  lastOpenedAt: string | null
  source: LibrarySource
}

export interface ResearchNote {
  id: string
  projectId: string
  workspaceSourceId: string | null
  passageId: string | null
  kind: 'note' | 'excerpt' | 'exact_excerpt' | 'intervention_resolution'
  title: string | null
  body: string
  exactExcerpt: string | null
  sourceAnchorJson: string | null
  documentAnchorJson: string | null
  stale: boolean
  createdAt: string
  updatedAt: string
}

export interface SourceAnnotation {
  id: string
  projectId: string
  workspaceSourceId: string
  passageId: string | null
  color: string
  comment: string | null
  anchorJson: string
  createdAt: string
}

export interface PriorityFactors {
  pinned: number
  blocker: number
  deadline: number
  evidence: number
  requirement: number
  citation: number
  quality: number
  centrality: number
  aiAdjustment: number
}

export interface ResearchAction {
  id: string
  projectId: string
  kind: string
  title: string
  detail: string
  state: 'open' | 'completed' | 'dismissed'
  pinned: boolean
  snoozedUntil: string | null
  priority: number
  priorityFactorsJson: string
  targetKind: ResearchEntityKind | null
  targetId: string | null
  documentAnchorJson: string | null
  createdAt: string
  updatedAt: string
}

export interface GroundedFinding {
  id: string
  text: string
  passageIds: string[]
  confidence: number
}

export interface GroundedSynthesis {
  id: string
  projectId: string
  kind: 'summary' | 'comparison' | 'research_gap' | 'counterevidence' | 'outline'
  prompt: string
  status: 'queued' | 'running' | 'ready' | 'failed'
  findings: GroundedFinding[]
  createdAt: string
}

export interface AcademicProfile {
  id: string
  projectId: string | null
  name: string
  cslStyle: string
  headingJson: string
  marginsJson: string
  spacing: number
  titlePageJson: string
  captionJson: string
  tableJson: string
  bibliographyJson: string
  isDefault: boolean
}

export interface ResearchJob {
  id: string
  projectId: string
  kind: string
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
  progress: number
  attempts: number
  maxAttempts: number
  error: string | null
  createdAt: string
  completedAt: string | null
}

export interface ResearchHistoryEvent {
  id: string
  type: string
  actor: 'student' | 'system'
  category: 'decision' | 'intervention' | 'system'
  payload: Record<string, unknown>
  documentHash: string | null
  modelVersion: string | null
  promptVersion: string | null
  sealed: boolean
  createdAt: string
}

export interface InterventionHistoryEntry {
  id: string
  engineType: EngineType
  promptText: string | null
  responseText: string | null
  verdict: Verdict | null
  status: 'active' | 'faded' | 'resolved'
  userAction: 'engaged' | 'dismissed' | 'ignored' | null
  evidenceCount: number
  createdAt: string
  resolvedAt: string | null
}

export interface ResearchHistorySnapshot {
  events: ResearchHistoryEvent[]
  interventions: InterventionHistoryEntry[]
  integrity: 'verified' | 'legacy_unsealed' | 'broken'
  legacyEventCount: number
  truncated: boolean
}

export interface ResearchWorkspaceSnapshot {
  sources: WorkspaceSource[]
  notes: ResearchNote[]
  annotations: SourceAnnotation[]
  actions: ResearchAction[]
  claims: Array<{ id: string; text: string; central: boolean; evidenceLinks: Array<{ id: string; supportStatus: string; excerpt: string | null; pdfChunkId: string | null }> }>
  references: ReferenceSummary[]
  requirements: Array<{ id: string; text: string; required: boolean; confirmed: boolean }>
  jobs: ResearchJob[]
  profile: AcademicProfile | null
  historyCounts?: { decisions: number; interventions: number }
}

export interface SourceMapPassage {
  chunkId: string
  pdfId: string
  workspaceSourceId: string | null
  referenceId: string | null
  content: string
  similarityScore: number
  pageApprox: number
  sourceTitle: string
  matchType: 'exact' | 'semantic' | 'hybrid'
}

export interface SourceMapAnswer {
  answer: string
  passageIds: string[]
  confidence: 'high' | 'medium' | 'low'
  followUpQuestion: string | null
}

export interface SourceMapResult {
  question: string
  answer: SourceMapAnswer | null
  passages: SourceMapPassage[]
  needsWebSearch: boolean
  retrieval: Array<'exact' | 'semantic'>
  answerError?: string
}
