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
