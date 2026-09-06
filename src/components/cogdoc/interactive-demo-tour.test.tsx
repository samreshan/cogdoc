// @vitest-environment happy-dom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import InteractiveDemoTour, { INTERACTIVE_DEMO_STEPS } from './interactive-demo-tour'
import { INTERACTIVE_DEMO_PROJECT_ID, INTERACTIVE_DEMO_VERSION } from '@/lib/interactive-demo'

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
    const onCommand = vi.fn(async (command: string) => {
      expect(command).toBe('write')
      window.dispatchEvent(new CustomEvent('cogdoc:demo-action', { detail: { action: 'writing-complete' } }))
    })
    render(<><div data-demo-target="document-surface">Editor</div><InteractiveDemoTour projectId={INTERACTIVE_DEMO_PROJECT_ID} onCommand={onCommand} onRestore={vi.fn()} onExit={vi.fn()} /></>)
    expect(screen.getByText('Your document is the workspace')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }))
    expect(await screen.findByText('Watch the argument take shape')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Show me/ }))
    await waitFor(() => expect(onCommand).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByText('Plan keeps the question visible')).toBeInTheDocument())
  })

  it('exits on Escape and remains resumable', () => {
    render(<><div data-demo-target="document-surface">Editor</div><InteractiveDemoTour projectId={INTERACTIVE_DEMO_PROJECT_ID} onCommand={vi.fn()} onRestore={vi.fn()} onExit={vi.fn()} /></>)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.getByRole('button', { name: 'Resume demo' })).toBeInTheDocument()
  })

  it('never triggers the final download through Show me', async () => {
    const storageKey = `cogdoc:interactive-demo:${INTERACTIVE_DEMO_VERSION}:${INTERACTIVE_DEMO_PROJECT_ID}`
    storage.set(storageKey, String(INTERACTIVE_DEMO_STEPS.length - 1))
    const onCommand = vi.fn()
    render(<><button data-demo-target="demo-export-markdown" onClick={() => window.dispatchEvent(new CustomEvent('cogdoc:demo-action', { detail: { action: 'exported' } }))}>Download</button><InteractiveDemoTour projectId={INTERACTIVE_DEMO_PROJECT_ID} onCommand={onCommand} onRestore={vi.fn()} onExit={vi.fn()} /></>)
    expect(await screen.findByText('Export requires your click')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Show me/ })).not.toBeInTheDocument()
    expect(onCommand).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Download' }))
    expect(await screen.findByText('You completed the research journey')).toBeInTheDocument()
  })
})
