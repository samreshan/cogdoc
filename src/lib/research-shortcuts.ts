export type ResearchShortcut =
  | 'toggle-navigator'
  | 'toggle-inspector'
  | 'focus-navigator'
  | 'focus-work'
  | 'focus-inspector'

interface ShortcutInput {
  key: string
  code?: string
  metaKey?: boolean
  ctrlKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  editing?: boolean
}

export function researchShortcutFor(input: ShortcutInput): ResearchShortcut | null {
  const command = Boolean(input.metaKey || input.ctrlKey)
  const key = input.key.toLowerCase()
  const code = input.code ?? ''

  // Shifted shortcuts remain available while typing. Plain Cmd/Ctrl+B is
  // retained outside editable fields without stealing the editor's Bold key.
  if (command && key === 'b' && (input.shiftKey || !input.editing)) return 'toggle-navigator'
  if (command && input.shiftKey && key === 'i') return 'toggle-inspector'

  if (input.altKey && !command && !input.shiftKey) {
    if (key === '1' || code === 'Digit1' || code === 'Numpad1') return 'focus-navigator'
    if (key === '2' || code === 'Digit2' || code === 'Numpad2') return 'focus-work'
    if (key === '3' || code === 'Digit3' || code === 'Numpad3') return 'focus-inspector'
  }
  return null
}
