/**
 * RED→GREEN — tests for the IdleDetector.
 *
 * Not a Tiptap editor plugin but a decoupled timer the editor drives: it
 * records typing activity and fires an onIdle callback after a threshold of
 * inactivity. Pure timer logic, fully testable with fake timers — no DOM,
 * no editor instance needed.
 *
 * This replaces the inline idle logic in editor.tsx (IDLE_THRESHOLD_MS) with a
 * unit-tested primitive usable by both the contentEditable and Tiptap editors.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { IdleDetector } from '@/lib/extensions/idle-detector'

describe('IdleDetector', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not fire onIdle before the threshold elapses', () => {
    const onIdle = vi.fn()
    const d = new IdleDetector({ thresholdMs: 2000, onIdle })
    d.start()
    vi.advanceTimersByTime(1999)
    expect(onIdle).not.toHaveBeenCalled()
    d.stop()
  })

  it('fires onIdle exactly once after the threshold', () => {
    const onIdle = vi.fn()
    const d = new IdleDetector({ thresholdMs: 2000, onIdle })
    d.start()
    vi.advanceTimersByTime(2000)
    expect(onIdle).toHaveBeenCalledTimes(1)
    d.stop()
  })

  it('activity resets the idle countdown', () => {
    const onIdle = vi.fn()
    const d = new IdleDetector({ thresholdMs: 2000, onIdle })
    d.start()
    vi.advanceTimersByTime(1500)
    d.ping() // user typed — reset
    vi.advanceTimersByTime(1500) // only 1500ms since ping
    expect(onIdle).not.toHaveBeenCalled()
    vi.advanceTimersByTime(500) // now 2000ms since ping
    expect(onIdle).toHaveBeenCalledTimes(1)
    d.stop()
  })

  it('does not fire after stop()', () => {
    const onIdle = vi.fn()
    const d = new IdleDetector({ thresholdMs: 1000, onIdle })
    d.start()
    d.stop()
    vi.advanceTimersByTime(5000)
    expect(onIdle).not.toHaveBeenCalled()
  })

  it('start is idempotent (calling twice does not double-fire)', () => {
    const onIdle = vi.fn()
    const d = new IdleDetector({ thresholdMs: 1000, onIdle })
    d.start()
    d.start()
    vi.advanceTimersByTime(1000)
    expect(onIdle).toHaveBeenCalledTimes(1)
    d.stop()
  })

  it('respects a custom threshold', () => {
    const onIdle = vi.fn()
    const d = new IdleDetector({ thresholdMs: 45000, onIdle })
    d.start()
    vi.advanceTimersByTime(44999)
    expect(onIdle).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onIdle).toHaveBeenCalledTimes(1)
    d.stop()
  })

  it('ping before start is a no-op (no crash)', () => {
    const onIdle = vi.fn()
    const d = new IdleDetector({ thresholdMs: 1000, onIdle })
    expect(() => d.ping()).not.toThrow()
  })
})
