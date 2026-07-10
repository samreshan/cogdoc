/**
 * RED→GREEN — tests for the SSE event-schema parser.
 *
 * Defines the uniform event contract from PRODUCT.md §12.3 that every
 * streaming engine emits:
 *   event: token   data: { "t": "<token>" }
 *   event: meta    data: { "tag": "[Provocation]", "engine": "socratic" }
 *   event: done    data: { "intervention_id": "<id>" }
 *   event: error   data: { "code": "...", "message": "..." }
 *
 * The parser turns a raw SSE text chunk stream into typed events, handling
 * the SSE wire format (event:/data: lines, blank-line dispatch, multi-line
 * data). This is what the gateway consumer uses to reconstruct interventions.
 */
import { describe, it, expect } from 'vitest'
import { parseSSEEvents, collectTokens, type SSEEvent } from '@/lib/sse'

describe('parseSSEEvents', () => {
  it('parses a single token event', () => {
    const chunk = 'event: token\ndata: {"t":"hello"}\n\n'
    const events = parseSSEEvents(chunk)
    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('token')
    expect((events[0] as any).data).toEqual({ t: 'hello' })
  })

  it('parses a meta event with tag + engine', () => {
    const chunk = 'event: meta\ndata: {"tag":"[Provocation]","engine":"socratic"}\n\n'
    const events = parseSSEEvents(chunk)
    expect(events[0].type).toBe('meta')
    expect((events[0] as any).data.tag).toBe('[Provocation]')
  })

  it('parses a done event carrying an intervention_id', () => {
    const chunk = 'event: done\ndata: {"intervention_id":"iv-1"}\n\n'
    const events = parseSSEEvents(chunk)
    expect(events[0].type).toBe('done')
    expect((events[0] as any).data.intervention_id).toBe('iv-1')
  })

  it('parses an error event with code + message', () => {
    const chunk = 'event: error\ndata: {"code":"rate_limited","message":"slow down"}\n\n'
    const events = parseSSEEvents(chunk)
    expect(events[0].type).toBe('error')
    expect((events[0] as any).data.code).toBe('rate_limited')
  })

  it('parses multiple events from a single chunk', () => {
    const chunk = [
      'event: token\ndata: {"t":"first "}\n\n',
      'event: token\ndata: {"t":"second"}\n\n',
      'event: done\ndata: {"intervention_id":"iv-9"}\n\n',
    ].join('')
    const events = parseSSEEvents(chunk)
    expect(events).toHaveLength(3)
    expect(events[0].type).toBe('token')
    expect(events[2].type).toBe('done')
  })

  it('returns [] for an empty string', () => {
    expect(parseSSEEvents('')).toEqual([])
  })

  it('returns [] for a partial event (no terminating blank line)', () => {
    // An event without the dispatching blank line is incomplete — buffered, not emitted.
    expect(parseSSEEvents('event: token\ndata: {"t":"x"}')).toEqual([])
  })

  it('defaults the type to "message" when no event: line present', () => {
    const chunk = 'data: {"t":"no event line"}\n\n'
    const events = parseSSEEvents(chunk)
    expect(events[0].type).toBe('message')
  })

  it('joins multi-line data fields', () => {
    const chunk = 'event: token\ndata: line1\ndata: line2\n\n'
    const events = parseSSEEvents(chunk)
    // multi-line data is joined with \n; if it's not JSON, data stays a string
    expect(events[0].type).toBe('token')
    expect((events[0] as any).data).toBe('line1\nline2')
  })
})

describe('collectTokens', () => {
  it('concatenates the t field from all token events', () => {
    const events: SSEEvent[] = [
      { type: 'meta', data: {} },
      { type: 'token', data: { t: 'Hello ' } },
      { type: 'token', data: { t: 'World' } },
      { type: 'done', data: { intervention_id: 'x' } },
    ]
    expect(collectTokens(events)).toBe('Hello World')
  })

  it('returns empty string when no token events', () => {
    expect(collectTokens([{ type: 'done', data: {} }])).toBe('')
  })

  it('handles token events missing the t field', () => {
    expect(collectTokens([{ type: 'token', data: {} }])).toBe('')
  })

  it('handles non-object data gracefully', () => {
    expect(collectTokens([{ type: 'token', data: 'not an object' }])).toBe('')
  })
})
