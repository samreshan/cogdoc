import mammoth from 'mammoth'
import {
  AlignmentType,
  BorderStyle,
  Document as DocxDocument,
  ExternalHyperlink,
  Footer,
  HeadingLevel,
  ImageRun,
  LineRuleType,
  Packer,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type ISectionOptions,
  type ParagraphChild,
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

const ACADEMIC_FONT = 'Times New Roman'
const ACADEMIC_BODY_SIZE = 24
const ONE_INCH_TWIPS = 1_440
const ONE_AND_A_HALF_LINE_SPACING = 360

function textRuns(node: ProseMirrorNode, forceBold = false): ParagraphChild[] {
  if (node.type === 'text') {
    const marks = node.marks ?? []
    const markTypes = new Set(marks.map((mark) => mark.type))
    const run = new TextRun({
      text: node.text ?? '',
      bold: forceBold || markTypes.has('bold'),
      italics: markTypes.has('italic'),
      strike: markTypes.has('strike'),
      font: markTypes.has('code') ? 'Courier New' : undefined,
    })
    const href = marks.find((mark) => mark.type === 'link')?.attrs?.href
    if (typeof href === 'string' && /^https?:\/\//i.test(href)) {
      return [new ExternalHyperlink({ link: href, children: [run] })]
    }
    return [run]
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
  return (node.content ?? []).flatMap((child) => textRuns(child, forceBold))
}

function paragraphFromNode(
  node: ProseMirrorNode,
  listKind?: 'bullet' | 'number',
  forceBold = false,
): Paragraph {
  const headingMap: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
    1: HeadingLevel.HEADING_1,
    2: HeadingLevel.HEADING_2,
    3: HeadingLevel.HEADING_3,
    4: HeadingLevel.HEADING_4,
    5: HeadingLevel.HEADING_5,
    6: HeadingLevel.HEADING_6,
  }
  if (node.type === 'horizontalRule') {
    return new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'A8A29E', space: 6 } },
      spacing: { before: 120, after: 120 },
    })
  }
  return new Paragraph({
    children: textRuns(node, forceBold),
    heading: node.type === 'heading' ? headingMap[Number(node.attrs?.level ?? 1)] : undefined,
    bullet: listKind === 'bullet' ? { level: 0 } : undefined,
    numbering: listKind === 'number' ? { reference: 'cogdoc-numbering', level: 0 } : undefined,
    style: node.type === 'codeBlock' ? 'Code' : node.type === 'blockquote' ? 'BlockQuote' : undefined,
  })
}

function tableFromNode(node: ProseMirrorNode): Table {
  const rows = (node.content ?? []).filter((child) => child.type === 'tableRow').map((row) => new TableRow({
    children: (row.content ?? []).map((cell) => new TableCell({
      children: (cell.content ?? []).map((paragraph) => paragraphFromNode(
        paragraph,
        undefined,
        cell.type === 'tableHeader',
      )),
      margins: { top: 80, bottom: 80, left: 100, right: 100 },
      shading: cell.type === 'tableHeader' ? { fill: 'E7E5E4' } : undefined,
    })),
  }))
  const border = { style: BorderStyle.SINGLE, size: 4, color: 'A8A29E' }
  return new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: border,
      bottom: border,
      left: border,
      right: border,
      insideHorizontal: border,
      insideVertical: border,
    },
  })
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
    properties: {
      page: {
        margin: {
          top: ONE_INCH_TWIPS,
          right: ONE_INCH_TWIPS,
          bottom: ONE_INCH_TWIPS,
          left: ONE_INCH_TWIPS,
          header: 720,
          footer: 720,
        },
        pageNumbers: { start: 1 },
      },
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ children: [PageNumber.CURRENT], size: 20, font: ACADEMIC_FONT })],
        })],
      }),
    },
    children: [
      new Paragraph({
        children: [new TextRun(title)],
        style: 'Title',
      }),
      ...body,
    ],
  }
  const document = new DocxDocument({
    title,
    creator: 'Cogdoc',
    description: 'Normalized academic document exported from Cogdoc',
    styles: {
      default: {
        document: {
          run: { font: ACADEMIC_FONT, size: ACADEMIC_BODY_SIZE, color: '1C1917' },
          paragraph: {
            spacing: {
              line: ONE_AND_A_HALF_LINE_SPACING,
              lineRule: LineRuleType.AUTO,
              after: 120,
            },
          },
        },
        title: {
          run: { font: ACADEMIC_FONT, size: 36, bold: true, color: '1C1917' },
          paragraph: { alignment: AlignmentType.CENTER, spacing: { after: 480 }, keepNext: true },
        },
        heading1: {
          run: { font: ACADEMIC_FONT, size: 32, bold: true, color: '1C1917' },
          paragraph: { spacing: { before: 360, after: 120 }, keepNext: true, outlineLevel: 0 },
        },
        heading2: {
          run: { font: ACADEMIC_FONT, size: 28, bold: true, color: '1C1917' },
          paragraph: { spacing: { before: 300, after: 120 }, keepNext: true, outlineLevel: 1 },
        },
        heading3: {
          run: { font: ACADEMIC_FONT, size: 24, bold: true, color: '1C1917' },
          paragraph: { spacing: { before: 240, after: 80 }, keepNext: true, outlineLevel: 2 },
        },
        heading4: {
          run: { font: ACADEMIC_FONT, size: 24, bold: true, italics: true, color: '1C1917' },
          paragraph: { spacing: { before: 200, after: 80 }, keepNext: true, outlineLevel: 3 },
        },
        heading5: {
          run: { font: ACADEMIC_FONT, size: 24, italics: true, color: '1C1917' },
          paragraph: { spacing: { before: 160, after: 80 }, keepNext: true, outlineLevel: 4 },
        },
        heading6: {
          run: { font: ACADEMIC_FONT, size: 24, italics: true, color: '1C1917' },
          paragraph: { spacing: { before: 160, after: 80 }, keepNext: true, outlineLevel: 5 },
        },
      },
      paragraphStyles: [
        {
          id: 'BlockQuote',
          name: 'Block Quote',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { font: ACADEMIC_FONT, size: ACADEMIC_BODY_SIZE, italics: true, color: '44403C' },
          paragraph: {
            indent: { left: 720, right: 720 },
            spacing: { line: ONE_AND_A_HALF_LINE_SPACING, lineRule: LineRuleType.AUTO, before: 120, after: 120 },
          },
        },
        {
          id: 'Code',
          name: 'Code',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { font: 'Courier New', size: 20, color: '292524' },
          paragraph: {
            shading: { fill: 'F5F5F4' },
            indent: { left: 240, right: 240 },
            spacing: { line: 240, lineRule: LineRuleType.AUTO, before: 120, after: 120 },
          },
        },
      ],
    },
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
