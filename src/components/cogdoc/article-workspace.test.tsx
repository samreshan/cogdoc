// @vitest-environment happy-dom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ArticleWorkspace } from './article-workspace'

function json(body: unknown, ok = true) { return { ok, json: async () => body } as Response }

afterEach(() => { vi.unstubAllGlobals() })

describe('ArticleWorkspace', () => {
  it('loads cross-question candidates and lets the researcher inspect and save a separate article artifact', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(json({ candidates: [{ findingRevisionId: 'rev-1', label: 'First finding', uncertainty: null, eligible: true }, { findingRevisionId: 'rev-2', label: 'Second finding', uncertainty: 'Limited.', eligible: true }] }))
      .mockResolvedValueOnce(json({ articles: [{ id: 'article-1', title: 'Draft', path: 'generated_draft', content: '# Initial', revision: 1, status: 'review_needed', generationStatus: 'completed', updatedAt: '2026-01-01' }] }))
      .mockResolvedValueOnce(json({ article: { id: 'article-1', content: '# Revised', revision: 2, status: 'review_needed' }, warning: 'Review mappings.' }))
    vi.stubGlobal('fetch', fetch)
    render(<ArticleWorkspace projectId="workspace-1" />)
    await waitFor(() => expect(screen.getByText('Second finding')).toBeInTheDocument())
    expect(await screen.findByDisplayValue('# Initial')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Article content'), { target: { value: '# Revised' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save edits' }))
    await waitFor(() => expect(fetch).toHaveBeenLastCalledWith('/api/workspaces/workspace-1/articles/article-1', expect.objectContaining({ method: 'PATCH' })))
    expect(await screen.findByText('Review mappings.')).toBeInTheDocument()
  })
})
