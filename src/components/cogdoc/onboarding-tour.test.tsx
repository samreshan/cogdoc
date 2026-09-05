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

  it('opens for a first login, persists completion, and remains replayable', async () => {
    vi.spyOn(api, 'getUser').mockResolvedValue({
      user: { id: 'user-1', email: 'student@example.com', displayName: null, dailyTokenBudget: 1000, onboardingCompletedAt: null },
    })
    const complete = vi.spyOn(api, 'setOnboardingCompleted').mockResolvedValue({ onboardingCompletedAt: '2026-08-28T00:00:00.000Z' })

    render(<OnboardingTour />)
    expect(await screen.findByText('One research workspace. Three quiet roles.')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Cogdoc workspace overview' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /skip for now/i }))
    await waitFor(() => expect(complete).toHaveBeenCalledWith(true))
    expect(window.localStorage.getItem('cogdoc-onboarding-complete')).toBe('1')

    fireEvent.click(screen.getByRole('button', { name: 'Open Cogdoc tutorial' }))
    expect(await screen.findByText('One research workspace. Three quiet roles.')).toBeInTheDocument()
  })

  it('does not force the dialog after account-level completion', async () => {
    vi.spyOn(api, 'getUser').mockResolvedValue({
      user: { id: 'user-1', email: 'student@example.com', displayName: null, dailyTokenBudget: 1000, onboardingCompletedAt: '2026-08-27T00:00:00.000Z' },
    })
    render(<OnboardingTour />)

    expect(await screen.findByRole('button', { name: 'Open Cogdoc tutorial' })).toBeInTheDocument()
    expect(screen.queryByText('One research workspace. Three quiet roles.')).not.toBeInTheDocument()
  })
})
