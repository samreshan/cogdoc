// @vitest-environment happy-dom
import { act, fireEvent, render, screen, cleanup } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import LiveResearchGuide from './live-research-guide'
import { completeGuideAction, registerLiveGuide } from '@/lib/live-research-guide'
const storage = new Map<string, string>()
beforeEach(() => {
  vi.useFakeTimers(); storage.clear()
  vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) })
})
afterEach(() => { cleanup(); vi.useRealTimers() })
it('releases the screen after eight seconds and tracks work while collapsed', () => {
  registerLiveGuide('p')
  render(<LiveResearchGuide projectId="p" />)
  expect(screen.getByRole('button', { name: 'Try it myself' })).toBeInTheDocument()
  act(() => { vi.advanceTimersByTime(8000) })
  expect(screen.getByRole('button', { name: 'Show guidance' })).toBeInTheDocument()
  act(() => { completeGuideAction('p', 'collaborate'); completeGuideAction('p', 'source'); completeGuideAction('p', 'write') })
  expect(screen.getByText('Choose a research question')).toBeInTheDocument()
  act(() => { completeGuideAction('p', 'question') })
  expect(screen.getByText('Inspect and choose evidence')).toBeInTheDocument()
})
it('can stay open for reading and resume without resetting user progress', () => {
  registerLiveGuide('p'); completeGuideAction('p', 'write')
  const view = render(<LiveResearchGuide projectId="p" />)
  fireEvent.click(screen.getByRole('button', { name: 'Keep explanation open' }))
  act(() => { vi.advanceTimersByTime(15000) })
  expect(screen.getByRole('button', { name: 'Try it myself' })).toBeInTheDocument()
  view.unmount()
  render(<LiveResearchGuide projectId="p" />)
  expect(screen.getByText('Choose a research question')).toBeInTheDocument()
})
