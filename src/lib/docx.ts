import mammoth from 'mammoth'
import {
  AlignmentType,
  Document as DocxDocument,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  type ISectionOptions,
} from 'docx'
import { documentToPlainText, parseDocumentContent, type ProseMirrorNode } from '@/lib/document-content'

export interface DocxCompatibilityReport {
  preserved: string[]
  warnings: string[]
  converterMessages: Array<{ type: string; message: string }>
}

function sanitizeImportedHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*')/gi, '')
    .replace(/(?:href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\1/gi, 'href="#"')
}

export async function importDocx(buffer: Buffer): Promise<{
  html: string
  report: DocxCompatibilityReport
}> {
  const result = await mammoth.convertToHtml(
    { buffer },
    {
      includeDefaultStyleMap: true,
      convertImage: mammoth.images.imgElement(async (image) => ({
        src: `data:${image.contentType};base64,${(await image.read('base64')) as string}`,
      })),
      styleMap: [
        "p[style-name='Code'] => pre > code:fresh",
        "p[style-name='Source Code'] => pre > code:fresh",
      ],
    },
  )
  const warnings = [
    'Page margins, headers, footers, exact pagination, fonts, and decorative table borders are normalized.',
  ]
  if (result.messages.length) warnings.push('Some Word structures required semantic conversion; review the details below.')
  return {
    html: sanitizeImportedHtml(result.value),
    report: {
      preserved: ['Headings', 'Paragraphs', 'Lists', 'Tables', 'Links', 'Basic images', 'Footnotes and endnotes', 'Code-style paragraphs'],
      warnings,
      converterMessages: result.messages.map((message) => ({ type: message.type, message: message.message })),
    },
  }
}

function textRuns(node: ProseMirrorNode): Array<TextRun | ImageRun> {
  if (node.type === 'text') {
    const markTypes = new Set((node.marks ?? []).map((mark) => mark.type))
    return [new TextRun({
      text: node.text ?? '',
      bold: markTypes.has('bold'),
      italics: markTypes.has('italic'),
      strike: markTypes.has('strike'),
      font: markTypes.has('code') ? 'Courier New' : undefined,
    })]
  }
  if (node.type === 'hardBreak') return [new TextRun({ break: 1 })]
  if (node.type === 'image') {
    const src = String(node.attrs?.src ?? '')
    const match = src.match(/^data:image\/(png|jpeg|jpg|gif);base64,(.+)$/i)
    if (!match) return [new TextRun('[Image omitted: source was not embedded]')]
    const type = match[1]?.toLowerCase() === 'jpeg' ? 'jpg' : match[1]?.toLowerCase()
    return [new ImageRun({
      data: Buffer.from(match[2] ?? '', 'base64'),
      type: type as 'png' | 'jpg' | 'gif',
      transformation: {
        width: Math.min(640, Number(node.attrs?.width ?? 480)),
        height: Math.min(480, Number(node.attrs?.height ?? 320)),
      },
    })]
  }
  return (node.content ?? []).flatMap(textRuns)
}

function paragraphFromNode(node: ProseMirrorNode, listKind?: 'bullet' | 'number'): Paragraph {
  const headingMap: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
    1: HeadingLevel.HEADING_1,
    2: HeadingLevel.HEADING_2,
    3: HeadingLevel.HEADING_3,
    4: HeadingLevel.HEADING_4,
    5: HeadingLevel.HEADING_5,
    6: HeadingLevel.HEADING_6,
  }
  return new Paragraph({
    children: textRuns(node),
    heading: node.type === 'heading' ? headingMap[Number(node.attrs?.level ?? 1)] : undefined,
    bullet: listKind === 'bullet' ? { level: 0 } : undefined,
    numbering: listKind === 'number' ? { reference: 'cogdoc-numbering', level: 0 } : undefined,
    style: node.type === 'codeBlock' ? 'Code' : undefined,
  })
}

function tableFromNode(node: ProseMirrorNode): Table {
  const rows = (node.content ?? []).filter((child) => child.type === 'tableRow').map((row) => new TableRow({
    children: (row.content ?? []).map((cell) => new TableCell({
      children: (cell.content ?? []).map((paragraph) => paragraphFromNode(paragraph)),
    })),
  }))
  return new Table({ rows })
}

function docxChildren(root: ProseMirrorNode): Array<Paragraph | Table> {
  const children: Array<Paragraph | Table> = []
  for (const node of root.content ?? []) {
    if (node.type === 'table') {
      children.push(tableFromNode(node))
      continue
    }
    if (node.type === 'bulletList' || node.type === 'orderedList') {
      for (const item of node.content ?? []) {
        for (const paragraph of item.content ?? []) {
          children.push(paragraphFromNode(paragraph, node.type === 'bulletList' ? 'bullet' : 'number'))
        }
      }
      continue
    }
    children.push(paragraphFromNode(node))
  }
  return children
}

export async function exportAcademicDocx(title: string, content: string): Promise<Buffer> {
  const parsed = parseDocumentContent(content)
  const body = typeof parsed === 'string'
    ? documentToPlainText(parsed).split(/\n{2,}/).map((text) => new Paragraph(text))
    : docxChildren(parsed)
  const section: ISectionOptions = {
    properties: {},
    children: [
      new Paragraph({
        children: [new TextRun({ text: title, bold: true, size: 36 })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 480 },
      }),
      ...body,
    ],
  }
  const document = new DocxDocument({
    numbering: {
      config: [{
        reference: 'cogdoc-numbering',
        levels: [{ level: 0, format: 'decimal', text: '%1.', alignment: AlignmentType.START }],
      }],
    },
    sections: [section],
  })
  return Packer.toBuffer(document)
}
