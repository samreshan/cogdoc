// @vitest-environment happy-dom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import InteractiveDemoTour, { INTERACTIVE_DEMO_STEPS } from './interactive-demo-tour'
import { INTERACTIVE_DEMO_EDITOR_START_STEP, INTERACTIVE_DEMO_PROJECT_ID, INTERACTIVE_DEMO_VERSION } from '@/lib/interactive-demo'

const storage = new Map<string, string>()

beforeEach(() => {
  storage.clear()
  Object.defineProperty(window, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key), clear: () => storage.clear(),
  } })
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ x: 40, y: 50, top: 50, left: 40, right: 440, bottom: 250, width: 400, height: 200, toJSON: () => ({}) } as DOMRect)
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
})

describe('InteractiveDemoTour', () => {
  it('highlights a real target and advances after a controlled writing action', async () => {
    const storageKey = `cogdoc:interactive-demo:${INTERACTIVE_DEMO_VERSION}:${INTERACTIVE_DEMO_PROJECT_ID}`
    storage.set(storageKey, String(INTERACTIVE_DEMO_EDITOR_START_STEP))
    const onCommand = vi.fn(async (command: string) => {
      expect(command).toBe('write')
      window.dispatchEvent(new CustomEvent('cogdoc:demo-action', { detail: { action: 'writing-complete' } }))
    })
    render(<><div data-demo-target="document-surface">Editor</div><InteractiveDemoTour projectId={INTERACTIVE_DEMO_PROJECT_ID} onCommand={onCommand} onRestore={vi.fn()} onExit={vi.fn()} /></>)
    expect(screen.getByText('The document stays at the center')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Next/ }))
    expect(await screen.findByText('Watch the explanation take shape')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Show me/ }))
    await waitFor(() => expect(onCommand).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByText('Plan shows the route through the topic')).toBeInTheDocument())
  })

  it('exits on Escape and remains resumable', () => {
    render(<><div data-demo-target="research-topic">Topic</div><InteractiveDemoTour projectId={INTERACTIVE_DEMO_PROJECT_ID} onCommand={vi.fn()} onRestore={vi.fn()} onExit={vi.fn()} /></>)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.getByRole('button', { name: 'Resume demo' })).toBeInTheDocument()
  })

  it('never triggers the final download through Show me', async () => {
    const storageKey = `cogdoc:interactive-demo:${INTERACTIVE_DEMO_VERSION}:${INTERACTIVE_DEMO_PROJECT_ID}`
    storage.set(storageKey, String(INTERACTIVE_DEMO_STEPS.length - 1))
    const onCommand = vi.fn()
    const onRestore = vi.fn()
    render(<><button data-demo-target="demo-export-markdown" onClick={() => window.dispatchEvent(new CustomEvent('cogdoc:demo-action', { detail: { action: 'exported' } }))}>Download</button><InteractiveDemoTour projectId={INTERACTIVE_DEMO_PROJECT_ID} onCommand={onCommand} onRestore={onRestore} onExit={vi.fn()} /></>)
    expect(await screen.findByText('Export requires your click')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Show me/ })).not.toBeInTheDocument()
    expect(onCommand).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Download' }))
    expect(await screen.findByText('You completed the Java and Kubernetes journey')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Replay' }))
    expect(screen.getByText('Begin with one answerable question')).toBeInTheDocument()
    expect(onRestore).toHaveBeenLastCalledWith(0)
  })

  it('does not leave the source reader step pointing at a non-actionable passage', async () => {
    const storageKey = `cogdoc:interactive-demo:${INTERACTIVE_DEMO_VERSION}:${INTERACTIVE_DEMO_PROJECT_ID}`
    const readerStep = INTERACTIVE_DEMO_STEPS.findIndex((step) => step.target === 'demo-source-reader')
    storage.set(storageKey, String(readerStep))
    render(<><div data-demo-target="demo-source-reader">Labelled demonstration paraphrase</div><button data-demo-target="demo-use-evidence" onClick={() => window.dispatchEvent(new CustomEvent('cogdoc:demo-action', { detail: { action: 'evidence-chosen' } }))}>Use passage</button><InteractiveDemoTour projectId={INTERACTIVE_DEMO_PROJECT_ID} onCommand={vi.fn()} onRestore={vi.fn()} onExit={vi.fn()} /></>)
    expect(screen.getByText('Read the evidence boundary')).toBeInTheDocument()
    expect(screen.getByText(/This step explains the highlighted area/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Next/ }))
    expect(await screen.findByText('Choose this passage on purpose')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Show me/ }))
    expect(await screen.findByText('Return support to the document')).toBeInTheDocument()
  })

  it('keeps the coach pointer-enabled while a source modal locks outside content', () => {
    const storageKey = `cogdoc:interactive-demo:${INTERACTIVE_DEMO_VERSION}:${INTERACTIVE_DEMO_PROJECT_ID}`
    const readerStep = INTERACTIVE_DEMO_STEPS.findIndex((step) => step.target === 'demo-source-reader')
    storage.set(storageKey, String(readerStep))
    document.body.style.pointerEvents = 'none'
    try {
      render(<><div data-demo-target="demo-source-reader">Labelled demonstration paraphrase</div><InteractiveDemoTour projectId={INTERACTIVE_DEMO_PROJECT_ID} onCommand={vi.fn()} onRestore={vi.fn()} onExit={vi.fn()} /></>)
      expect(screen.getByRole('complementary', { name: 'Interactive demo coach' })).toHaveClass('pointer-events-auto')
    } finally {
      document.body.style.pointerEvents = ''
    }
  })

  it('lets a passive reader step recover to the evidence action when its target disappeared', async () => {
    const storageKey = `cogdoc:interactive-demo:${INTERACTIVE_DEMO_VERSION}:${INTERACTIVE_DEMO_PROJECT_ID}`
    const readerStep = INTERACTIVE_DEMO_STEPS.findIndex((step) => step.target === 'demo-source-reader')
    storage.set(storageKey, String(readerStep))
    const onRestore = vi.fn()
    render(<><button data-demo-target="demo-use-evidence">Use passage</button><InteractiveDemoTour projectId={INTERACTIVE_DEMO_PROJECT_ID} onCommand={vi.fn()} onRestore={onRestore} onExit={vi.fn()} /></>)

    expect(await screen.findByRole('status', {}, { timeout: 3_000 })).toHaveTextContent('Choose Next')
    const next = screen.getByRole('button', { name: /Next/ })
    expect(next).toBeEnabled()
    fireEvent.click(next)

    expect(await screen.findByText('Choose this passage on purpose')).toBeInTheDocument()
    expect(onRestore).toHaveBeenLastCalledWith(readerStep + 1)
  })

  it('resumes at the first editor step after the Home start action', () => {
    const storageKey = `cogdoc:interactive-demo:${INTERACTIVE_DEMO_VERSION}:${INTERACTIVE_DEMO_PROJECT_ID}`
    storage.set(storageKey, String(INTERACTIVE_DEMO_EDITOR_START_STEP - 1))
    const first = render(<><button data-demo-target="demo-start-research" onClick={() => storage.set(storageKey, String(INTERACTIVE_DEMO_EDITOR_START_STEP))}>Start writing</button><InteractiveDemoTour projectId={INTERACTIVE_DEMO_PROJECT_ID} onCommand={vi.fn()} onRestore={vi.fn()} onExit={vi.fn()} /></>)
    fireEvent.click(screen.getByRole('button', { name: 'Start writing' }))
    first.unmount()
    render(<><div data-demo-target="document-surface">Editor</div><InteractiveDemoTour projectId={INTERACTIVE_DEMO_PROJECT_ID} onCommand={vi.fn()} onRestore={vi.fn()} onExit={vi.fn()} /></>)
    expect(screen.getByText('The document stays at the center')).toBeInTheDocument()
  })

  it('waits for an asynchronously mounted target instead of making Show me a no-op', async () => {
    const storageKey = `cogdoc:interactive-demo:${INTERACTIVE_DEMO_VERSION}:${INTERACTIVE_DEMO_PROJECT_ID}`
    const planStep = INTERACTIVE_DEMO_STEPS.findIndex((step) => step.target === 'nav-plan')
    storage.set(storageKey, String(planStep))
    render(<InteractiveDemoTour projectId={INTERACTIVE_DEMO_PROJECT_ID} onCommand={vi.fn()} onRestore={vi.fn()} onExit={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /Show me/ }))
    const target = document.createElement('button')
    target.dataset.demoTarget = 'nav-plan'
    target.addEventListener('click', () => window.dispatchEvent(new CustomEvent('cogdoc:demo-action', { detail: { action: 'plan-opened' } })))
    window.setTimeout(() => document.body.append(target), 100)
    expect(await screen.findByText('Three questions divide the work')).toBeInTheDocument()
    target.remove()
  })

  it('cancels a pending expected-action advance when Back changes the step', async () => {
    const storageKey = `cogdoc:interactive-demo:${INTERACTIVE_DEMO_VERSION}:${INTERACTIVE_DEMO_PROJECT_ID}`
    const planStep = INTERACTIVE_DEMO_STEPS.findIndex((step) => step.target === 'nav-plan')
    storage.set(storageKey, String(planStep))
    render(<><button data-demo-target="nav-plan" onClick={() => window.dispatchEvent(new CustomEvent('cogdoc:demo-action', { detail: { action: 'plan-opened' } }))}>Plan</button><InteractiveDemoTour projectId={INTERACTIVE_DEMO_PROJECT_ID} onCommand={vi.fn()} onRestore={vi.fn()} onExit={vi.fn()} /></>)
    fireEvent.click(screen.getByRole('button', { name: /Show me/ }))
    fireEvent.click(screen.getByRole('button', { name: /Back/ }))
    await new Promise((resolve) => window.setTimeout(resolve, 250))
    expect(screen.getByText('Watch the explanation take shape')).toBeInTheDocument()
  })

  it('does not advance from a queued or new action while the coach is hidden', async () => {
    const storageKey = `cogdoc:interactive-demo:${INTERACTIVE_DEMO_VERSION}:${INTERACTIVE_DEMO_PROJECT_ID}`
    const planStep = INTERACTIVE_DEMO_STEPS.findIndex((step) => step.target === 'nav-plan')
    storage.set(storageKey, String(planStep))
    render(<><button data-demo-target="nav-plan" onClick={() => window.dispatchEvent(new CustomEvent('cogdoc:demo-action', { detail: { action: 'plan-opened' } }))}>Plan</button><InteractiveDemoTour projectId={INTERACTIVE_DEMO_PROJECT_ID} onCommand={vi.fn()} onRestore={vi.fn()} onExit={vi.fn()} /></>)
    fireEvent.click(screen.getByRole('button', { name: /Show me/ }))
    fireEvent.keyDown(window, { key: 'Escape' })
    window.dispatchEvent(new CustomEvent('cogdoc:demo-action', { detail: { action: 'plan-opened' } }))
    await new Promise((resolve) => window.setTimeout(resolve, 250))
    expect(storage.get(storageKey)).toBe(String(planStep))
    fireEvent.click(screen.getByRole('button', { name: 'Resume demo' }))
    expect(screen.getByText('Plan shows the route through the topic')).toBeInTheDocument()
  })

  it('blocks a queued advance synchronously when Escape arrives before effect cleanup', () => {
    vi.useFakeTimers()
    try {
      const storageKey = `cogdoc:interactive-demo:${INTERACTIVE_DEMO_VERSION}:${INTERACTIVE_DEMO_PROJECT_ID}`
      const planStep = INTERACTIVE_DEMO_STEPS.findIndex((step) => step.target === 'nav-plan')
      storage.set(storageKey, String(planStep))
      render(<><button data-demo-target="nav-plan" onClick={() => window.dispatchEvent(new CustomEvent('cogdoc:demo-action', { detail: { action: 'plan-opened' } }))}>Plan</button><InteractiveDemoTour projectId={INTERACTIVE_DEMO_PROJECT_ID} onCommand={vi.fn()} onRestore={vi.fn()} onExit={vi.fn()} /></>)

      fireEvent.click(screen.getByRole('button', { name: /Show me/ }))
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      vi.runAllTimers()

      expect(storage.get(storageKey)).toBe(String(planStep))
    } finally {
      vi.useRealTimers()
    }
  })
})
