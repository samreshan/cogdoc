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

  it('renders structured citation metadata in text and HTML exports', () => {
    const content = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Evidence ' }, { type: 'structuredCitation', attrs: { referenceId: 'r1', author: 'Chen', year: '2025', locator: 'p. 14' } }] }] })
    expect(documentToPlainText(content)).toContain('(Chen, 2025, p. 14)')
    expect(documentToHtml(content)).toContain('data-reference-id="r1"')
  })
})
