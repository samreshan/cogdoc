// @vitest-environment happy-dom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/lib/api-client'
import AssistantStatus from './assistant-status'

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('AssistantStatus', () => {
  it('shows a connected local assistant and its model without exposing an endpoint', async () => {
    vi.spyOn(api, 'checkAssistant').mockResolvedValue({
      provider: 'ollama', model: 'qwen3:8b', configured: true, local: true,
      status: 'reachable', message: 'The local assistant is reachable.',
    })
    render(<AssistantStatus />)

    expect(await screen.findByRole('button', { name: 'Assistant connected' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Assistant connected' }))
    expect(screen.getByText('Local assistant connected')).toBeInTheDocument()
    expect(screen.getByText('Ollama · qwen3:8b')).toBeInTheDocument()
    expect(document.body.textContent).not.toContain('11434')
  })

  it('explains quota limits while keeping scholarly research available', async () => {
    vi.spyOn(api, 'checkAssistant').mockResolvedValue({
      provider: 'gemini', model: 'gemini-3.5-flash-lite', configured: true, local: false,
      status: 'quota_limited', message: 'Gemini quota is currently limited.',
    })
    render(<AssistantStatus />)

    expect(await screen.findByRole('button', { name: 'Assistant needs attention' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Assistant needs attention' }))
    expect(screen.getByText(/Source search still works through OpenAlex and Crossref/i)).toBeInTheDocument()
  })

  it('can refresh readiness from the popover', async () => {
    const check = vi.spyOn(api, 'checkAssistant')
      .mockResolvedValueOnce({
        provider: 'gemini', model: 'gemini-3.5-flash-lite', configured: false, local: false,
        status: 'missing_configuration', message: 'Add an API key.',
      })
      .mockResolvedValueOnce({
        provider: 'gemini', model: 'gemini-3.5-flash-lite', configured: true, local: false,
        status: 'reachable', message: 'Gemini is reachable.',
      })
    render(<AssistantStatus />)
    fireEvent.click(await screen.findByRole('button', { name: 'Assistant needs attention' }))
    fireEvent.click(screen.getByRole('button', { name: 'Check again' }))

    await waitFor(() => expect(check).toHaveBeenCalledTimes(2))
    expect(await screen.findByRole('button', { name: 'Assistant connected' })).toBeInTheDocument()
  })
})
