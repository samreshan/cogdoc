import { describe, it, expect } from 'vitest'
import { cn } from '@/lib/utils'

describe('cn (className merge)', () => {
  it('joins class names', () => {
    expect(cn('a', 'b')).toBe('a b')
  })

  it('handles conditional falsy values', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b')
  })

  it('dedupes conflicting tailwind classes (twMerge)', () => {
    // later padding wins over earlier padding
    expect(cn('p-2', 'p-4')).toBe('p-4')
  })

  it('returns empty string for no input', () => {
    expect(cn()).toBe('')
  })
})
