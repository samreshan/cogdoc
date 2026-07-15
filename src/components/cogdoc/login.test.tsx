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

beforeEach(() => {
  signInMock.mockClear()
})
afterEach(() => cleanup)

describe('Login', () => {
  it('renders email + password fields and a sign-in button', () => {
    render(<Login />)
    expect(screen.getByPlaceholderText(/email/i)).toBeTruthy()
    expect(screen.getByPlaceholderText(/password/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeTruthy()
  })

  it('calls signInWithPassword with the entered credentials on submit', async () => {
    render(<Login />)
    fireEvent.change(screen.getByPlaceholderText(/email/i), { target: { value: 'w@c.co' } })
    fireEvent.change(screen.getByPlaceholderText(/password/i), { target: { value: 'secret' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
    expect(signInMock).toHaveBeenCalledWith({ email: 'w@c.co', password: 'secret' })
  })
})
