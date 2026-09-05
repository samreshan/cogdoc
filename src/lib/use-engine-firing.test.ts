// @vitest-environment happy-dom
/**
 * Tests for useEngineFiring — the shared engine-firing orchestration hook.
 *
 * This hook is the single home for the firing policy both the editor surface
 * and any future caller rely on: friction-scaled cooldowns, per-engine API
 * dispatch (with the Interceptor stream-then-persist path), the Socratic
 * idle fallback to the last completed sentence, and the once-per-session
 * Blindspot check.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useEngineFiring } from '@/lib/use-engine-firing'
import { useCogdoc } from '@/lib/store'
import { api } from '@/lib/api-client'
import { consumeInterceptorStream } from '@/lib/ai-gateway'
import type { Intervention, Project } from '@/lib/types'

vi.mock('@/lib/api-client', () => ({
  api: {
    citationSentinel: vi.fn(),
    interceptor: vi.fn(),
    scaffold: vi.fn(),
    socraticSpacer: vi.fn(),
    blindspot: vi.fn(),
  },
}))
vi.mock('@/lib/ai-gateway', () => ({
  consumeInterceptorStream: vi.fn(),
}))
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}))

const mockedApi = vi.mocked(api)
const mockedStream = vi.mocked(consumeInterceptorStream)

function intervention(id: string): Intervention {
  return { id, engineType: 'citation', promptText: 'A verifiable claim here.', responseText: 'x', status: 'active', createdAt: new Date().toISOString() } as unknown as Intervention
}

const project = { id: 'proj-1', title: 'T' } as unknown as Project

const initialState = useCogdoc.getState()

beforeEach(() => {
  useCogdoc.setState({
    ...initialState,
    activeProject: project,
    activeInterventions: [],
    frictionMode: 'socratic',
    blindspotShownThisSession: false,
  })
  mockedApi.citationSentinel.mockResolvedValue({ intervention: intervention('iv-cit') } as never)
  mockedApi.interceptor.mockResolvedValue({ action: 'intervene', intervention: intervention('iv-int') } as never)
  mockedApi.scaffold.mockResolvedValue({ intervention: intervention('iv-sca') } as never)
  mockedApi.socraticSpacer.mockResolvedValue({ intervention: intervention('iv-soc') } as never)
  mockedApi.blindspot.mockResolvedValue({ blindspot: true, intervention: intervention('iv-bli') } as never)
  mockedStream.mockResolvedValue({ text: 'q', tag: null, engine: null, frictionMode: null, interventionId: null, errorCode: null })
})

afterEach(() => {
  vi.clearAllMocks()
  useCogdoc.setState(initialState, true)
})

describe('useEngineFiring / fireEngine', () => {
  it('fires the citation engine and pushes the intervention', async () => {
    const { result } = renderHook(() => useEngineFiring(() => 'Some draft text.'))
    await act(async () => {
      await result.current.fireEngine('citation', 'A verifiable claim here.', 'ctx')
    })
    expect(mockedApi.citationSentinel).toHaveBeenCalledWith('proj-1', 'A verifiable claim here.', undefined, 'socratic')
    expect(useCogdoc.getState().activeInterventions.map((i) => i.id)).toContain('iv-cit')
  })

  it('respects the friction-scaled cooldown (second immediate fire is a no-op)', async () => {
    const { result } = renderHook(() => useEngineFiring(() => ''))
    await act(async () => {
      await result.current.fireEngine('citation', 'First claim sentence.', '')
      await result.current.fireEngine('citation', 'Second claim sentence.', '')
    })
    expect(mockedApi.citationSentinel).toHaveBeenCalledTimes(1)
  })

  it('allows only one engine request to claim the same phrase at a time', async () => {
    let release: (() => void) | undefined
    mockedApi.citationSentinel.mockImplementation(() => new Promise((resolve) => {
      release = () => resolve({ intervention: intervention('iv-cit') } as never)
    }))
    const { result } = renderHook(() => useEngineFiring(() => ''))
    let citationRequest!: Promise<void>
    await act(async () => {
      citationRequest = result.current.fireEngine('citation', 'Shared research phrase.', 'ctx')
      await result.current.fireEngine('socratic', 'Shared research phrase.', 'ctx')
    })
    expect(mockedApi.citationSentinel).toHaveBeenCalledTimes(1)
    expect(mockedApi.socraticSpacer).not.toHaveBeenCalled()
    release?.()
    await act(async () => citationRequest)
  })

  it('socratic idle trigger falls back to the last completed sentence from getText', async () => {
    const { result } = renderHook(() =>
      useEngineFiring(() => 'An earlier sentence. The final full sentence is here.'),
    )
    await act(async () => {
      await result.current.fireEngine('socratic', '', 'ctx')
    })
    expect(mockedApi.socraticSpacer).toHaveBeenCalledTimes(1)
    const sentenceArg = mockedApi.socraticSpacer.mock.calls[0][2]
    expect(sentenceArg).toContain('final full sentence')
  })

  it('socratic idle trigger with an empty document does not call the API', async () => {
    const { result } = renderHook(() => useEngineFiring(() => ''))
    await act(async () => {
      await result.current.fireEngine('socratic', '', '')
    })
    expect(mockedApi.socraticSpacer).not.toHaveBeenCalled()
  })

  it('interceptor streams first, then persists via the blocking route (ADR-0007)', async () => {
    const { result } = renderHook(() => useEngineFiring(() => ''))
    await act(async () => {
      await result.current.fireEngine('interceptor', 'Write my conclusion for me.', 'ctx')
    })
    expect(mockedStream).toHaveBeenCalledTimes(1)
    expect(mockedApi.interceptor).toHaveBeenCalledTimes(1)
    expect(useCogdoc.getState().activeInterventions.map((i) => i.id)).toContain('iv-int')
  })

  it('interceptor pass-through pushes nothing', async () => {
    mockedApi.interceptor.mockResolvedValue({ action: 'pass' } as never)
    const { result } = renderHook(() => useEngineFiring(() => ''))
    await act(async () => {
      await result.current.fireEngine('interceptor', 'A neutral non-delegative sentence.', '')
    })
    expect(useCogdoc.getState().activeInterventions).toHaveLength(0)
  })

  it('falls back to the blocking route when the stream rejects', async () => {
    mockedStream.mockRejectedValue(new Error('network down'))
    const { result } = renderHook(() => useEngineFiring(() => ''))
    await act(async () => {
      await result.current.fireEngine('interceptor', 'Write it all for me now.', '')
    })
    expect(mockedApi.interceptor).toHaveBeenCalledTimes(1)
    expect(useCogdoc.getState().activeInterventions.map((i) => i.id)).toContain('iv-int')
  })

  it('does nothing without an active project', async () => {
    useCogdoc.setState({ activeProject: null })
    const { result } = renderHook(() => useEngineFiring(() => ''))
    await act(async () => {
      await result.current.fireEngine('citation', 'A claim.', '')
    })
    expect(mockedApi.citationSentinel).not.toHaveBeenCalled()
  })
})

describe('useEngineFiring / checkBlindspot', () => {
  const longDraft = Array.from({ length: 35 }, (_, i) => `word${i}`).join(' ')

  it('skips drafts under 30 words', () => {
    const { result } = renderHook(() => useEngineFiring(() => ''))
    act(() => result.current.checkBlindspot('too short a draft'))
    expect(mockedApi.blindspot).not.toHaveBeenCalled()
  })

  it('fires once per session on a substantial draft, then marks shown', async () => {
    const { result } = renderHook(() => useEngineFiring(() => ''))
    act(() => result.current.checkBlindspot(longDraft))
    await waitFor(() => {
      expect(useCogdoc.getState().blindspotShownThisSession).toBe(true)
    })
    expect(useCogdoc.getState().activeInterventions.map((i) => i.id)).toContain('iv-bli')
    // second call in the same session is a no-op
    act(() => result.current.checkBlindspot(longDraft))
    expect(mockedApi.blindspot).toHaveBeenCalledTimes(1)
  })
})
