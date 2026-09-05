import type { Project, ResearchQuestionSummary, ResearchWorkspaceSnapshot } from '@/lib/types'

export type DocumentDockSection = 'collaborator' | 'sources' | 'findings' | 'plan' | 'share'

export interface DocumentSelectionIdentity {
  projectId: string
  documentId: string
  documentRevision: number
  from: number
  to: number
  exactText: string
  textFingerprint: string
}

export interface ExplicitSourceContext {
  workspaceSourceId: string
  passageId?: string
  label: string
  accessBasis: 'metadata' | 'abstract' | 'manual_excerpt' | 'extracted_text' | 'transcript'
  locator?: string
}

export interface DocumentWorkspaceContext {
  projectId: string
  topic?: string
  activeQuestion: ResearchQuestionSummary | null
  selection: DocumentSelectionIdentity | null
  sources: ExplicitSourceContext[]
}

export interface DocumentChangeProvenance {
  kind: 'collaborator' | 'finding' | 'source' | 'manual'
  label: string
  findingRevisionId?: string
  sourceIds?: string[]
  model?: string
}

export interface DocumentChangeProposal {
  id: string
  projectId: string
  selection: DocumentSelectionIdentity | null
  replacement: string
  reason: string
  provenance: DocumentChangeProvenance
}

export type DocumentChangeResult =
  | { status: 'applied' }
  | { status: 'cancelled' }
  | { status: 'stale-selection'; message: string }
  | { status: 'invalid'; message: string }

export interface DocumentDockProps {
  project: Project
  projectId: string
  snapshot: ResearchWorkspaceSnapshot | null
  activeSection: DocumentDockSection
  context: DocumentWorkspaceContext
  onSectionChange: (section: DocumentDockSection) => void
  onContextChange: (context: DocumentWorkspaceContext) => void
  onPreviewDocumentChange: (proposal: DocumentChangeProposal) => void
  onApplyDocumentChange: (proposal: DocumentChangeProposal) => Promise<DocumentChangeResult>
  onClose: () => void
  onRefresh: () => void
}

export type OpenWorkspaceHandler = (project: Project) => void

