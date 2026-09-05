// @vitest-environment happy-dom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/lib/api-client'
import OnboardingTour from './onboarding-tour'

const storage = new Map<string, string>()
Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
    clear: () => storage.clear(),
  },
})

describe('OnboardingTour', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  it('stays optional, persists completion, and remains replayable', async () => {
    const complete = vi.spyOn(api, 'setOnboardingCompleted').mockResolvedValue({ onboardingCompletedAt: '2026-08-28T00:00:00.000Z' })

    render(<OnboardingTour />)
    expect(screen.queryByText('The document stays central.')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Open Cogdoc guide' }))
    expect(await screen.findByText('The document stays central.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Got it' }))
    await waitFor(() => expect(complete).toHaveBeenCalledWith(true))
    expect(window.localStorage.getItem('cogdoc-onboarding-complete')).toBe('1')

    fireEvent.click(screen.getByRole('button', { name: 'Open Cogdoc guide' }))
    expect(await screen.findByText('The document stays central.')).toBeInTheDocument()
  })

  it('does not force the guide open on render', () => {
    render(<OnboardingTour />)

    expect(screen.getByRole('button', { name: 'Open Cogdoc guide' })).toBeInTheDocument()
    expect(screen.queryByText('The document stays central.')).not.toBeInTheDocument()
  })
})
