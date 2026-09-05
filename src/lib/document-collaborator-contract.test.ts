import { describe, expect, it } from 'vitest'
import { createSelectionId, selectionIsSelfConsistent } from '@/lib/document-collaborator-contract'

describe('document collaborator selection identity', () => {
  const selection = {
    projectId: 'project-1', documentId: 'document-1', documentRevision: 4,
    from: 8, to: 24, exactText: 'Selected passage', textFingerprint: 'sha256-value',
  }

  it('binds the identity to project, document, revision, range, and text fingerprint', () => {
    const selectionId = createSelectionId(selection)
    expect(selectionId).toBe('project-1:document-1:4:8:24:sha256-value')
    expect(selectionIsSelfConsistent({ ...selection, selectionId })).toBe(true)
    expect(selectionIsSelfConsistent({ ...selection, documentRevision: 5, selectionId })).toBe(false)
  })

  it('rejects empty and zero-length selections', () => {
    expect(selectionIsSelfConsistent({ ...selection, exactText: '', to: 8, selectionId: createSelectionId({ ...selection, exactText: '', to: 8 }) })).toBe(false)
  })
})
