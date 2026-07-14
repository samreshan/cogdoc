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

export interface PdfSummary {
  id: string
  filename: string
  sizeBytes: number
  parseStatus: string
  uploadedAt: string
  _count: { chunks: number }
}

export interface Project {
  id: string
  title: string
  description: string | null
  archived: boolean
  createdAt: string
  updatedAt: string
  document: { id: string; content: string; lastSaved: string } | null
  pdfs: PdfSummary[]
  interventions: Intervention[]
  _count: { pdfs: number; interventions: number }
}

export interface Analytics {
  total: number
  byEngine: Record<string, number>
  byAction: Record<string, number>
  byVerdict: Record<string, number>
  engagementRate: number
}
