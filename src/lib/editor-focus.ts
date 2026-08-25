import type { Node as ProseMirrorNode } from '@tiptap/pm/model'

export interface EditorTextRange {
  from: number
  to: number
}

interface PositionedCharacter {
  char: string
  position: number
}

function textCharacters(doc: ProseMirrorNode): PositionedCharacter[] {
  const characters: PositionedCharacter[] = []
  doc.descendants((node, position) => {
    if (!node.isText || !node.text) return
    for (let offset = 0; offset < node.text.length; offset += 1) {
      characters.push({ char: node.text[offset]!, position: position + offset })
    }
  })
  return characters
}

function rangeAt(characters: PositionedCharacter[], start: number, length: number): EditorTextRange | null {
  const first = characters[start]
  const last = characters[start + length - 1]
  if (!first || !last) return null
  return { from: first.position, to: last.position + 1 }
}

function normalizeWithPositions(characters: PositionedCharacter[]): { text: string; indices: number[] } {
  let text = ''
  const indices: number[] = []
  let previousWasWhitespace = false
  for (let index = 0; index < characters.length; index += 1) {
    const character = characters[index]!
    if (/\s/.test(character.char)) {
      if (!previousWasWhitespace && text.length > 0) {
        text += ' '
        indices.push(index)
      }
      previousWasWhitespace = true
      continue
    }
    text += character.char.toLocaleLowerCase()
    indices.push(index)
    previousWasWhitespace = false
  }
  return { text, indices }
}

/** Locate review/intervention text in the current Tiptap document for right-pane navigation. */
export function findEditorTextRange(doc: ProseMirrorNode, quote: string): EditorTextRange | null {
  const target = quote.trim()
  if (!target) return null
  const characters = textCharacters(doc)
  const exactText = characters.map((character) => character.char).join('').toLocaleLowerCase()
  const exactStart = exactText.indexOf(target.toLocaleLowerCase())
  if (exactStart >= 0) return rangeAt(characters, exactStart, target.length)

  const normalizedDocument = normalizeWithPositions(characters)
  const normalizedTarget = target.toLocaleLowerCase().replace(/\s+/g, ' ')
  const normalizedStart = normalizedDocument.text.indexOf(normalizedTarget)
  if (normalizedStart < 0) return null
  const firstCharacterIndex = normalizedDocument.indices[normalizedStart]
  const lastCharacterIndex = normalizedDocument.indices[normalizedStart + normalizedTarget.length - 1]
  if (firstCharacterIndex === undefined || lastCharacterIndex === undefined) return null
  return rangeAt(characters, firstCharacterIndex, lastCharacterIndex - firstCharacterIndex + 1)
}
