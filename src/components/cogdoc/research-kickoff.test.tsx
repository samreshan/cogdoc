// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Project, ReferenceSummary } from '@/lib/types'

const mocks = vi.hoisted(() => ({
  planResearchKickoff: vi.fn(),
  createWorkspace: vi.fn(),
  draftResearchKickoff: vi.fn(),
  findSources: vi.fn(),
  addReference: vi.fn(),
  verifyReference: vi.fn(),
  saveDocument: vi.fn(),
  getWorkspace: vi.fn(),
  recordDecision: vi.fn(),
}))

vi.mock('@/lib/api-client', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/api-client')>()
  return { ...original, api: { ...original.api, ...mocks } }
})

import ResearchKickoff, { kickoffDocumentContent, RESEARCH_CONVERSATION_QUESTIONS } from './research-kickoff'

const plan = {
  title: 'AI and independent judgement',
  description: 'How routine AI use changes researchers’ independent evaluation of evidence.',
  outline: [
    { heading: 'Conceptual frame', purpose: 'Define independent judgement.' },
    { heading: 'Available evidence', purpose: 'Compare the strongest empirical findings.' },
    { heading: 'Limits and alternatives', purpose: 'Test rival explanations and boundaries.' },
  ],
  questions: RESEARCH_CONVERSATION_QUESTIONS,
}

const source = {
  title: 'Cognitive offloading and independent evaluation',
  url: 'https://example.org/study',
  openAccessUrl: 'https://example.org/study.pdf',
  snippet: 'A relevant abstract.',
  relevance: 'high' as const,
  recordProvider: 'openalex' as const,
  citation: { authors: ['M. Rai'], year: '2025', venue: 'Research Methods', doi: '10.1000/study' },
}

const unverifiedReference: ReferenceSummary = {
  id: 'reference-1', rawText: 'Rai (2025). Cognitive offloading and independent evaluation.', style: 'harvard',
  authorsJson: '["M. Rai"]', year: '2025', title: source.title, doi: '10.1000/study', url: source.url,
  metadataStatus: 'unverified', metadataConfidence: 0, metadataJson: null,
  createdAt: '2026-09-01T00:00:00.000Z', source: null,
}
const verifiedReference = { ...unverifiedReference, metadataStatus: 'matched', metadataConfidence: 0.97 }

const workspace = {
  id: 'project-1', title: plan.title, description: plan.description, archived: false,
  createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z',
  workspaceType: 'research', reviewPace: 'deep', citationStyle: 'harvard', lifecycleState: 'draft',
  document: { id: 'document-1', content: '', lastSaved: '2026-09-01T00:00:00.000Z', revision: 0 },
  pdfs: [], interventions: [], reviewItems: [], reviewRuns: [], reports: [], codeSnapshots: [], assets: [], certificates: [],
  _count: { pdfs: 0, interventions: 0, reviewItems: 0, codeSnapshots: 0 },
} as Project

const answers = [
  'I want to understand how AI changes evidence checks.',
  'I think passive reliance can weaken independent judgement.',
  'AI might also free attention for deeper comparison.',
]

beforeEach(() => {
  vi.clearAllMocks()
  mocks.planResearchKickoff.mockResolvedValue({ plan, assistantFallback: false })
  mocks.createWorkspace.mockResolvedValue({ workspace })
  mocks.findSources.mockResolvedValue({ sources: [source], provider: 'openalex' })
  mocks.addReference.mockResolvedValue({ reference: unverifiedReference, alreadySaved: false })
  mocks.verifyReference.mockResolvedValue({ reference: verifiedReference, verified: true, confidence: 0.97, metadata: {} })
  mocks.saveDocument.mockResolvedValue({ ok: true, lastSaved: '2026-09-01T00:01:00.000Z', revision: 1, contentHash: 'hash' })
  mocks.getWorkspace.mockResolvedValue({ workspace })
  mocks.recordDecision.mockResolvedValue({ event: { id: 'audit-1' } })
})

describe('research kickoff', () => {
  it('keeps long content inside a viewport-bounded scroll region', () => {
    render(<ResearchKickoff open onOpenChange={vi.fn()} onComplete={vi.fn()} />)
    const region = screen.getByTestId('research-kickoff-scroll-region')
    expect(region).toHaveClass('min-h-0', 'overflow-y-auto', 'overscroll-contain')
    expect(region.closest('[data-slot="dialog-content"]')).toHaveClass('h-[calc(100dvh-1rem)]', 'overflow-hidden')
    expect(screen.getByRole('button', { name: 'Close research kickoff' })).toBeInTheDocument()
  })

  it('builds an editable structure with researcher notes, verified citations, and source links', () => {
    const conversation = RESEARCH_CONVERSATION_QUESTIONS.map((item, index) => ({ question: item.question, answer: answers[index]! }))
    const content = JSON.parse(kickoffDocumentContent(plan.title, plan.outline, [source] as Parameters<typeof kickoffDocumentContent>[2], [verifiedReference], conversation))
    expect(content.content.filter((node: { type: string }) => node.type === 'heading').map((node: { content: Array<{ text: string }> }) => node.content[0].text)).toEqual([
      plan.title, 'Conceptual frame', 'Available evidence', 'Limits and alternatives', 'Sources to examine',
    ])
    expect(JSON.stringify(content)).toContain('Your starting note:')
    expect(JSON.stringify(content)).toContain('structuredCitation')
    expect(JSON.stringify(content)).toContain('reference-1')
    expect(JSON.stringify(content)).toContain('https://example.org/study.pdf')
  })

  it('turns a simple conversation into an editable cited research structure', async () => {
    const user = userEvent.setup()
    const onComplete = vi.fn()
    const topic = 'How does routine generative AI use affect independent evidence evaluation?'
    render(<ResearchKickoff open onOpenChange={vi.fn()} onComplete={onComplete} />)

    await user.type(screen.getByPlaceholderText(/How does routine reliance/i), topic)
    await user.click(screen.getByRole('button', { name: /start conversation/i }))
    for (const [index, answer] of answers.entries()) {
      expect(screen.getByRole('heading', { name: RESEARCH_CONVERSATION_QUESTIONS[index]!.question })).toBeInTheDocument()
      fireEvent.change(screen.getByPlaceholderText('Answer naturally…'), { target: { value: answer } })
      await user.click(screen.getByRole('button', { name: index === answers.length - 1 ? /make my outline/i : /continue/i }))
    }

    expect(await screen.findByDisplayValue('Conceptual frame')).toBeTruthy()
    expect(mocks.planResearchKickoff).toHaveBeenCalledWith(topic, RESEARCH_CONVERSATION_QUESTIONS.map((item, index) => ({
      question: item.question,
      answer: answers[index],
    })))
    await user.clear(screen.getByLabelText('Outline heading 1'))
    await user.type(screen.getByLabelText('Outline heading 1'), 'Research frame')
    await user.click(screen.getByRole('button', { name: /build cited structure/i }))

    await waitFor(() => expect(onComplete).toHaveBeenCalledWith(workspace))
    expect(mocks.createWorkspace).toHaveBeenCalledWith(expect.objectContaining({
      title: plan.title, workspaceType: 'research', reviewPace: 'deep',
    }))
    expect(mocks.draftResearchKickoff).not.toHaveBeenCalled()
    expect(mocks.findSources).toHaveBeenCalledWith(expect.stringContaining('passive reliance'), 'project-1')
    expect(mocks.addReference).toHaveBeenCalledWith('project-1', expect.objectContaining({ doi: '10.1000/study' }))
    expect(mocks.verifyReference).toHaveBeenCalledWith('project-1', 'reference-1')
    expect(mocks.saveDocument).toHaveBeenCalledWith('project-1', expect.stringContaining('structuredCitation'), 0)
    expect(mocks.saveDocument.mock.calls[0][1]).toContain('Research frame')
    expect(mocks.saveDocument.mock.calls[0][1]).toContain(answers[0])
    expect(mocks.recordDecision).toHaveBeenCalledWith('project-1', expect.objectContaining({ type: 'research_structure_accepted' }))
  })
})
