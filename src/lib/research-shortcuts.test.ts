import { describe, expect, it } from 'vitest'
import { researchShortcutFor } from './research-shortcuts'

describe('research IDE shortcuts', () => {
  it('keeps pane toggles available while the document editor has focus', () => {
    expect(researchShortcutFor({ key: 'B', code: 'KeyB', metaKey: true, shiftKey: true, editing: true })).toBe('toggle-navigator')
    expect(researchShortcutFor({ key: 'I', code: 'KeyI', ctrlKey: true, shiftKey: true, editing: true })).toBe('toggle-inspector')
  })

  it('does not steal the standard bold shortcut while editing', () => {
    expect(researchShortcutFor({ key: 'b', metaKey: true, editing: true })).toBeNull()
    expect(researchShortcutFor({ key: 'b', metaKey: true, editing: false })).toBe('toggle-navigator')
  })

  it('maps pane focus shortcuts by physical digit key', () => {
    expect(researchShortcutFor({ key: '¡', code: 'Digit1', altKey: true, editing: true })).toBe('focus-navigator')
    expect(researchShortcutFor({ key: '2', altKey: true })).toBe('focus-work')
    expect(researchShortcutFor({ key: '3', altKey: true })).toBe('focus-inspector')
  })
})
