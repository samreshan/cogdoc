// @vitest-environment happy-dom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FindingReviewPanel } from './finding-review-panel'

describe('FindingReviewPanel', () => {
  it('shows retained uncertainty truthfully and submits the explicit current revision action', async () => {
    const onReview = vi.fn(async () => {})
    render(<FindingReviewPanel
      findingRevisionId="revision-2"
      revision={2}
      reviewState="reviewed"
      latestDecision="retain_uncertainty"
      onReview={onReview}
    />)

    expect(screen.getByText(/Uncertainty retained by the researcher/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Investigate further' }))
    await waitFor(() => expect(onReview).toHaveBeenCalledWith({
      findingRevisionId: 'revision-2',
      expectedRevision: 2,
      decision: 'request_more_evidence',
    }))
  })
})
