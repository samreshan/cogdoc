export type DocumentDockSection = 'collaborator' | 'sources' | 'findings' | 'plan' | 'share'

export type SourceAccessBasis = 'metadata' | 'abstract' | 'manual_excerpt' | 'extracted_text' | 'transcript'

export interface DocumentSelectionContext {
  projectId: string
  documentId: string
  documentRevision: number
  from: number
  to: number
  exactText: string
  /** Lowercase hex SHA-256 of exactText encoded as UTF-8. */
  textFingerprint: string
  /** Stable identity created from project, document, revision, range and text fingerprint. */
  selectionId: string
}

export interface DockQuestionContext {
  id: string
  wording: string
  revision: number
}

export interface DockSourceContext {
  workspaceSourceId: string
  passageId?: string
  title: string
  excerpt?: string
  locator?: string
  accessBasis: SourceAccessBasis
}

export interface DocumentCollaboratorContext {
  topic?: string
  activeQuestion: DockQuestionContext | null
  selection: DocumentSelectionContext | null
  /** Only sources the researcher explicitly chose are sent to the collaborator. */
  sources: DockSourceContext[]
}

export type CollaboratorIntent = 'ask' | 'explain' | 'find_evidence' | 'challenge' | 'plan' | 'revise_selection' | 'draft_finding'

export interface DocumentRevisionProposal {
  kind: 'document_revision'
  id: string
  replacement: string
  reason: string
  selection: DocumentSelectionContext
  sourceIds: string[]
  model?: string
}

export interface DocumentInsertionProposal {
  kind: 'document_insertion'
  id: string
  content: string
  reason: string
  documentId: string
  expectedDocumentRevision: number
  sourceIds: string[]
  findingRevisionId?: string
}

export interface FindingDraftProposal {
  kind: 'finding_draft'
  id: string
  conclusion: string
  rationale: string
  uncertainty: string
  limitations: string
  conflicts: string
  sourceIds: string[]
}

export interface InvestigationPlanProposal {
  kind: 'plan'
  id: string
  questions: Array<{ wording: string; rationale: string }>
}

export type DocumentEditProposal = DocumentRevisionProposal | DocumentInsertionProposal
export type DockProposal = DocumentEditProposal | FindingDraftProposal | InvestigationPlanProposal

export type CollaboratorProviderStatus = 'configured' | 'deterministic_fallback' | 'unavailable'

export interface CollaboratorTurn {
  id: string
  role: 'researcher' | 'assistant'
  content: string
  createdAt: string
  intent?: CollaboratorIntent
  providerStatus?: CollaboratorProviderStatus
  modelVersion?: string | null
  context: {
    questionId?: string
    selectionId?: string
    sourceIds: string[]
  }
  proposal?: DockProposal
  nextStep?: string | null
  hypothetical?: boolean
}

export interface CollaboratorResponse {
  answer: string
  nextStep: string | null
  hypothetical: boolean
  proposal?: DockProposal
  modelVersion: string
}

export interface DocumentResearchDockProps {
  projectId: string
  projectTitle?: string
  /** When supplied, the workspace rail controls the visible dock section. */
  activeSection?: DocumentDockSection
  initialSection?: DocumentDockSection
  documentSelection?: DocumentSelectionContext | null
  documentState?: { documentId: string; documentRevision: number }
  selectedQuestion?: DockQuestionContext | null
  selectedSources?: DockSourceContext[]
  onRequestPreview: (proposal: DocumentEditProposal) => void
  onApplyProposal: (request: {
    proposal: DocumentEditProposal
    expectedDocumentRevision: number
    expectedSelectionId?: string
  }) => Promise<{ applied: boolean; reason?: 'stale_selection' | 'stale_revision' | 'rejected' }>
  onOpenSource: (source: DockSourceContext) => void
  onFocusDocument: () => void
  onOpenShare?: () => void
  onSelectedSourcesChange?: (sources: DockSourceContext[]) => void
  onSectionChange?: (section: DocumentDockSection) => void
  onRefresh?: () => void
}

export function createSelectionId(selection: Omit<DocumentSelectionContext, 'selectionId'>): string {
  return [
    selection.projectId,
    selection.documentId,
    selection.documentRevision,
    selection.from,
    selection.to,
    selection.textFingerprint,
  ].join(':')
}

export function selectionIsSelfConsistent(selection: DocumentSelectionContext): boolean {
  return selection.selectionId === createSelectionId(selection)
    && selection.from >= 0
    && selection.to > selection.from
    && Boolean(selection.exactText.trim())
    && Boolean(selection.textFingerprint)
}
