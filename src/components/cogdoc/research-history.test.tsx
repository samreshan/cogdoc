// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mocks = vi.hoisted(() => ({ getResearchHistory: vi.fn() }))
vi.mock('@/lib/api-client', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/api-client')>()
  return { ...original, api: { ...original.api, getResearchHistory: mocks.getResearchHistory } }
})

import ResearchHistory from './research-history'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getResearchHistory.mockResolvedValue({
    integrity: 'verified', legacyEventCount: 0, truncated: false,
    events: [{
      id: 'audit-1', type: 'citation_inserted', actor: 'student', category: 'decision',
      payload: { summary: 'Inserted citation: A study' }, documentHash: null, modelVersion: null,
      promptVersion: null, sealed: true, createdAt: '2026-09-01T10:00:00.000Z',
    }],
    interventions: [{
      id: 'intervention-1', engineType: 'citation', promptText: 'A highlighted claim.', responseText: 'What source backs this up?',
      verdict: 'insufficient_evidence', status: 'resolved', userAction: 'engaged', evidenceCount: 2,
      createdAt: '2026-09-01T09:00:00.000Z', resolvedAt: '2026-09-01T10:00:00.000Z',
    }],
  })
})

describe('ResearchHistory', () => {
  it('shows decision history and switches to intervention history', async () => {
    const user = userEvent.setup()
    render(<ResearchHistory projectId="project-1" initialFilter="decisions" />)
    expect(await screen.findByText('Inserted citation: A study')).toBeInTheDocument()
    expect(screen.getByText('Audit chain verified.')).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: /intervention history/i }))
    expect(screen.getByText('What source backs this up?')).toBeInTheDocument()
    expect(screen.getByText('A highlighted claim.')).toBeInTheDocument()
  })
})
