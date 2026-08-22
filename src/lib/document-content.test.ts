import { describe, expect, it } from 'vitest'
import { canonicalDocumentString, documentToHtml, documentToPlainText, parseDocumentContent } from '@/lib/document-content'

describe('canonical document compatibility', () => {
  it('converts legacy HTML into canonical ProseMirror JSON without intervention UI', () => {
    const canonical = canonicalDocumentString('<h1>Title</h1><p>Hello <mark class="cogdoc-mark">world</mark></p>')
    expect(JSON.parse(canonical)).toMatchObject({ type: 'doc' })
    expect(documentToPlainText(canonical)).toContain('Title')
    expect(documentToHtml(canonical)).not.toContain('cogdoc-mark')
  })

  it('repairs empty or malformed stored content to an editable document', () => {
    expect(parseDocumentContent('')).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] })
    expect(() => JSON.parse(canonicalDocumentString('{broken'))).not.toThrow()
  })
})
