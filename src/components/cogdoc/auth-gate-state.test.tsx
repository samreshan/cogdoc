// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { AuthConfigurationError, AuthLoading } from './auth-gate-state'

afterEach(cleanup)

describe('auth gate states', () => {
  it('announces progress instead of rendering an empty screen', () => {
    render(<AuthLoading />)
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content')
    expect(screen.getByRole('status')).toHaveTextContent('Loading Cogdoc')
  })

  it('explains the supported deployment choices when auth is missing', () => {
    render(<AuthConfigurationError />)
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content')
    expect(screen.getByRole('heading', { name: /authentication is not configured/i })).toBeTruthy()
    expect(screen.getByText('COGDOC_SINGLE_USER_MODE=1')).toBeTruthy()
  })
})
