import QRCode from 'qrcode'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

function wrap(text: string, width: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    if (`${line} ${word}`.trim().length > width) {
      if (line) lines.push(line)
      line = word
    } else line = `${line} ${word}`.trim()
  }
  if (line) lines.push(line)
  return lines
}

export async function buildCertificatePdf(input: {
  certificateId: string
  workspaceTitle: string
  workspaceType: string
  createdAt: string
  documentHash: string
  reportHash: string
  criticalResolved: number
  advisoryRemaining: number
  citationCoverage: number
  verificationUrl: string
}): Promise<Buffer> {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595, 842])
  const serif = await pdf.embedFont(StandardFonts.TimesRoman)
  const serifBold = await pdf.embedFont(StandardFonts.TimesRomanBold)
  const sans = await pdf.embedFont(StandardFonts.Helvetica)
  const warmBlack = rgb(0.12, 0.1, 0.08)
  const moss = rgb(0.12, 0.38, 0.3)

  page.drawRectangle({ x: 34, y: 34, width: 527, height: 774, borderColor: rgb(0.76, 0.72, 0.65), borderWidth: 1 })
  page.drawText('COGDOC', { x: 62, y: 770, size: 11, font: sans, color: moss })
  page.drawText('Process Verified', { x: 62, y: 710, size: 34, font: serifBold, color: warmBlack })
  page.drawText('Academic process attestation', { x: 64, y: 684, size: 12, font: sans, color: rgb(0.4, 0.37, 0.33) })

  let y = 625
  for (const line of wrap(input.workspaceTitle, 52)) {
    page.drawText(line, { x: 62, y, size: 19, font: serif, color: warmBlack })
    y -= 23
  }
  page.drawText(`${input.workspaceType === 'assignment' ? 'Assignment' : 'Research workspace'} · ${new Date(input.createdAt).toLocaleDateString('en-GB')}`, {
    x: 62, y: y - 4, size: 10, font: sans, color: rgb(0.42, 0.39, 0.35),
  })

  const rows = [
    ['Critical actions resolved', String(input.criticalResolved)],
    ['Advisories remaining', String(input.advisoryRemaining)],
    ['Citation-reference coverage', `${Math.round(input.citationCoverage * 100)}%`],
  ]
  y -= 72
  for (const [label, value] of rows) {
    page.drawText(label, { x: 62, y, size: 10, font: sans, color: rgb(0.4, 0.37, 0.33) })
    page.drawText(value, { x: 330, y, size: 12, font: sans, color: warmBlack })
    y -= 28
  }

  const qrDataUrl = await QRCode.toDataURL(input.verificationUrl, { margin: 1, width: 220, errorCorrectionLevel: 'M' })
  const qr = await pdf.embedPng(Buffer.from(qrDataUrl.split(',')[1] ?? '', 'base64'))
  page.drawImage(qr, { x: 392, y: 116, width: 120, height: 120 })
  page.drawText('Private verification', { x: 405, y: 101, size: 8, font: sans, color: rgb(0.4, 0.37, 0.33) })

  page.drawText(`Certificate ${input.certificateId}`, { x: 62, y: 225, size: 9, font: sans, color: warmBlack })
  page.drawText(`Document SHA-256  ${input.documentHash}`, { x: 62, y: 205, size: 7, font: sans, color: rgb(0.35, 0.33, 0.3) })
  page.drawText(`Report SHA-256     ${input.reportHash}`, { x: 62, y: 190, size: 7, font: sans, color: rgb(0.35, 0.33, 0.3) })

  const disclaimer = 'This certificate attests only that the named Cogdoc checks were completed against the exact hashed snapshot. It does not prove human authorship, AI-free writing, academic correctness, originality, institutional approval, or code correctness.'
  y = 130
  for (const line of wrap(disclaimer, 76)) {
    page.drawText(line, { x: 62, y, size: 8, font: sans, color: rgb(0.38, 0.35, 0.32) })
    y -= 11
  }
  return Buffer.from(await pdf.save())
}

