import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { exportAcademicDocx } from '@/lib/docx'

async function docxXml(content: string) {
  const zip = await JSZip.loadAsync(await exportAcademicDocx('Evidence-led learning', content))
  const read = async (path: string) => {
    const file = zip.file(path)
    expect(file, `${path} should exist in the DOCX package`).not.toBeNull()
    return file!.async('string')
  }
  return {
    document: await read('word/document.xml'),
    styles: await read('word/styles.xml'),
    footer: await read('word/footer1.xml'),
    relationships: await read('word/_rels/document.xml.rels'),
    properties: await read('docProps/core.xml'),
  }
}

describe('exportAcademicDocx', () => {
  it('applies a deterministic normalized academic page and typography profile', async () => {
    const xml = await docxXml(JSON.stringify({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Introduction' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'A readable academic paragraph.' }] },
      ],
    }))

    expect(xml.document).toMatch(/<w:pgMar[^>]*w:top="1440"[^>]*w:right="1440"[^>]*w:bottom="1440"[^>]*w:left="1440"/)
    expect(xml.document).toContain('w:val="Title"')
    expect(xml.document).toContain('w:val="Heading1"')
    expect(xml.styles).toContain('w:ascii="Times New Roman"')
    expect(xml.styles).toMatch(/<w:docDefaults>[\s\S]*?<w:sz w:val="24"/)
    expect(xml.styles).toMatch(/<w:docDefaults>[\s\S]*?<w:spacing[^>]*w:after="120"[^>]*w:line="360"[^>]*w:lineRule="auto"/)
    expect(xml.footer).toContain('PAGE')
    expect(xml.properties).toContain('<dc:creator>Cogdoc</dc:creator>')
    expect(xml.properties).toContain('<dc:title>Evidence-led learning</dc:title>')
  })

  it('preserves semantic blocks, tables, marks, and safe web links', async () => {
    const xml = await docxXml(JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{
            type: 'text',
            text: 'Open the source',
            marks: [{ type: 'bold' }, { type: 'link', attrs: { href: 'https://example.edu/paper' } }],
          }],
        },
        { type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Quoted evidence' }] }] },
        { type: 'codeBlock', content: [{ type: 'text', text: 'const evidence = true' }] },
        {
          type: 'table',
          content: [{
            type: 'tableRow',
            content: [
              { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Source' }] }] },
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Finding' }] }] },
            ],
          }],
        },
        { type: 'horizontalRule' },
      ],
    }))

    expect(xml.document).toContain('w:val="BlockQuote"')
    expect(xml.document).toContain('w:val="Code"')
    expect(xml.document).toContain('<w:tbl>')
    expect(xml.document).toContain('w:fill="E7E5E4"')
    expect(xml.document).toContain('<w:b/>')
    expect(xml.document).toContain('<w:hyperlink')
    expect(xml.relationships).toContain('Target="https://example.edu/paper"')
    expect(xml.document).toContain('<w:pBdr>')
  })
})
