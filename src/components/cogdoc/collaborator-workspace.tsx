'use client'

import DocumentResearchDock from './document-research-dock'
import type { DocumentResearchDockProps } from '@/lib/document-collaborator-contract'

interface CollaboratorWorkspaceProps extends DocumentResearchDockProps {
  onClose: () => void
}

/**
 * Stable shell adapter for the document-first experience. The dock owns its
 * research tools; the editor and all document mutations remain mounted and
 * controlled by EditorShell.
 */
export default function CollaboratorWorkspace({ onClose, onFocusDocument, ...props }: CollaboratorWorkspaceProps) {
  return <DocumentResearchDock {...props} onFocusDocument={() => { onClose(); onFocusDocument() }} />
}
