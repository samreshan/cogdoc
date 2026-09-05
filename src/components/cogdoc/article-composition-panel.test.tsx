// @vitest-environment happy-dom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ArticleCompositionPanel } from './article-composition-panel'

describe('ArticleCompositionPanel', () => {
  it('keeps unreviewed findings unavailable and sends selected reviewed revisions to the manual path', async () => {
    const onCreate = vi.fn(async () => {})
    render(<ArticleCompositionPanel candidates={[
      { findingRevisionId: 'reviewed-1', label: 'Bounded finding', uncertainty: 'One source.', eligible: true },
      { findingRevisionId: 'stale-2', label: 'Stale finding', uncertainty: null, eligible: false, reason: 'Needs current review.' },
    ]} onCreate={onCreate} />)
    expect(screen.getByText('Needs current review.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('checkbox', { name: /Bounded finding/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Create manual outline' }))
    await waitFor(() => expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ path: 'manual_outline', findingRevisionIds: ['reviewed-1'] })))
  })
})
