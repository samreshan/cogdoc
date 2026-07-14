// @vitest-environment happy-dom
/**
 * Component test for the friction-mode segmented control.
 *
 * The selector is the visible surface of friction calibration (PRODUCT.md §9):
 * a 3-position Socratic ⇄ Coach ⇄ Assistant control wired to the store. It
 * dispatches setFrictionMode AND persists the choice via the settings PUT so the
 * mode survives a reload.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { useCogdoc } from '@/lib/store'
import FrictionModeSelector from './friction-mode-selector'

// Spy on the api client's setFrictionMode; the selector persists on change.
vi.mock('@/lib/api-client', () => ({
  api: {
    setFrictionMode: vi.fn().mockResolvedValue({ frictionMode: 'assistant' }),
  },
}))

beforeEach(() => {
  useCogdoc.setState({ frictionMode: 'socratic' })
})
afterEach(() => cleanup)

describe('FrictionModeSelector', () => {
  it('renders all three mode buttons labelled', () => {
    render(<FrictionModeSelector />)
    expect(screen.getByText(/socratic/i)).toBeTruthy()
    expect(screen.getByText(/coach/i)).toBeTruthy()
    expect(screen.getByText(/assistant/i)).toBeTruthy()
  })

  it('marks the active mode', () => {
    render(<FrictionModeSelector />)
    const active = screen.getByRole('group')
    // the socratic button is pressed initially
    const socraticBtn = screen.getByText(/socratic/i).closest('button')!
    expect(socraticBtn.getAttribute('aria-pressed')).toBe('true')
  })

  it('dispatches setFrictionMode and persists on click', async () => {
    const { api } = await import('@/lib/api-client')
    render(<FrictionModeSelector />)
    const assistantBtn = screen.getByText(/assistant/i).closest('button')!
    fireEvent.click(assistantBtn)
    expect(useCogdoc.getState().frictionMode).toBe('assistant')
    expect(api.setFrictionMode).toHaveBeenCalledWith('assistant')
  })
})
