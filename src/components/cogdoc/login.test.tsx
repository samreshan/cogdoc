// @vitest-environment happy-dom
/**
 * Component test for the Login screen (Phase 6, §8.7).
 *
 * Renders the Supabase email sign-in form. Auth is delegated to @supabase/ssr
 * (mocked here); the test asserts the form is present and the submit triggers
 * the signInWithPassword call.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

// Mock the Supabase browser client.
vi.mock('@/lib/supabase-browser', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
      signUp: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}))

import Login from './login'
import { supabase } from '@/lib/supabase-browser'

const signInMock = supabase.auth.signInWithPassword as ReturnType<typeof vi.fn>
const signUpMock = supabase.auth.signUp as ReturnType<typeof vi.fn>

beforeEach(() => {
  signInMock.mockClear()
  signUpMock.mockClear()
  signUpMock.mockResolvedValue({ data: { session: null }, error: null })
})
afterEach(() => cleanup)

describe('Login', () => {
  it('renders email + password fields and a sign-in button', () => {
    render(<Login />)
    expect(screen.getByLabelText('Email')).toBeTruthy()
    expect(screen.getByLabelText('Password')).toBeTruthy()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeTruthy()
  })

  it('explains the document-first product boundary', () => {
    render(<Login />)
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content')
    expect(screen.getByText(/keep the document open/i)).toBeTruthy()
    expect(screen.getByText(/context you control/i)).toBeTruthy()
    expect(screen.getByText(/sources and citations with provenance/i)).toBeTruthy()
  })

  it('calls signInWithPassword with the entered credentials on submit', async () => {
    render(<Login />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'w@c.co' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
    expect(signInMock).toHaveBeenCalledWith({ email: 'w@c.co', password: 'secret' })
  })
})

describe('Login — signup mode', () => {
  function toSignup() {
    render(<Login />)
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))
  }

  it('shows a confirm-password field after switching to sign up', () => {
    toSignup()
    expect(screen.getByLabelText('Confirm password')).toBeTruthy()
    expect(screen.getByRole('button', { name: /create account/i })).toBeTruthy()
  })

  it('rejects mismatched passwords without calling signUp', async () => {
    toSignup()
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'w@c.co' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret1' } })
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'different' } })
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/do not match/i)
    expect(signUpMock).not.toHaveBeenCalled()
  })

  it('calls signUp with matching credentials and shows the confirmation notice', async () => {
    toSignup()
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'w@c.co' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret1' } })
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'secret1' } })
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))
    expect(await screen.findByRole('status')).toHaveTextContent(/confirmation link/i)
    expect(signUpMock).toHaveBeenCalledWith({ email: 'w@c.co', password: 'secret1' })
  })
})
