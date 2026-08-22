// helpers.js — minimal-academic document building blocks for Cogdoc FYP report.
// Style is deliberately plain: Times New Roman / serif body, black text, no
// decorative covers, no colour. All content is English.
const {
  Paragraph, TextRun, HeadingLevel, AlignmentType, ImageRun,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
  PageBreak, TabStopType, TabStopPosition, Header, Footer, PageNumber,
  NumberFormat,
} = require("docx");
const fs = require("fs");
const path = require("path");
const sizeOf = require("image-size").imageSize;

// ---- Fonts / sizes ----------------------------------------------------------
const FONT = "Times New Roman";
const SZ = {
  body: 24,      // 12pt
  small: 20,     // 10pt
  caption: 20,
  h1: 32,        // 16pt
  h2: 28,        // 14pt
  h3: 26,        // 13pt
  title: 44,     // 22pt
  subtitle: 28,
};
const BLACK = "000000";
const GREY = "555555";

// ---- Runs -------------------------------------------------------------------
function run(text, opts = {}) {
  return new TextRun({
    text,
    font: { ascii: FONT, hAnsi: FONT },
    size: opts.size ?? SZ.body,
    bold: opts.bold || false,
    italics: opts.italics || false,
    color: opts.color ?? BLACK,
  });
}

// runs from an array of {t, b?, i?, color?} parts (inline formatting / emphasis)
function richRuns(parts, base = {}) {
  return parts.map((p) =>
    run(p.t, {
      size: base.size ?? SZ.body,
      bold: p.b || false,
      italics: p.i || false,
      color: p.color ?? base.color ?? BLACK,
    })
  );
}

// ---- Paragraphs -------------------------------------------------------------
function body(text, opts = {}) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: 360, after: 160 },                 // 1.5 spacing
    indent: opts.noIndent ? undefined : { firstLine: 360 },
    children: Array.isArray(text)
      ? richRuns(text)
      : [run(text, { size: opts.size ?? SZ.body })],
  });
}

// body with NO first-line indent (used directly under a heading)
function bodyFlat(parts) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: 360, after: 160 },
    children: Array.isArray(parts) ? richRuns(parts) : [run(parts)],
  });
}

// bullet list item
function bullet(text, level = 0) {
  return new Paragraph({
    bullet: { level },
    spacing: { line: 320, after: 60 },
    children: Array.isArray(text) ? richRuns(text) : [run(text)],
  });
}

// numbered item — caller controls the visible number to avoid list-id churn
function numItem(num, text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: 340, after: 80 },
    indent: { left: 480, hanging: 360 },
    children: [
      run(num + "\t", { bold: true }),
      ...(Array.isArray(text) ? richRuns(text) : [run(text)]),
    ],
    tabStops: [{ type: TabStopType.LEFT, position: 480 }],
  });
}

// ---- Headings ---------------------------------------------------------------
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.LEFT,
    pageBreakBefore: true,
    spacing: { before: 0, after: 240 },
    children: [run(text, { size: SZ.h1, bold: true })],
  });
}
// h1 that does NOT force a page break (e.g. first chapter right after TOC)
function h1NoBreak(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.LEFT,
    spacing: { before: 0, after: 240 },
    children: [run(text, { size: SZ.h1, bold: true })],
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 120 },
    children: [run(text, { size: SZ.h2, bold: true })],
  });
}
function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 100 },
    children: [run(text, { size: SZ.h3, bold: true, italics: false })],
  });
}

// ---- Figure / image ---------------------------------------------------------
function figure(file, caption, maxWidthPx = 560) {
  // Usable A4 width (8765 twips ≈ 6.09in ≈ 584px) minus a safety margin.
  // Clamp every caller to this cap so no image overflows the page.
  maxWidthPx = Math.min(maxWidthPx, 560);
  const p = path.join(__dirname, "..", "diagrams", file);
  const buf = fs.readFileSync(p);
  const dim = sizeOf(buf);
  const scale = Math.min(1, maxWidthPx / dim.width);
  const w = Math.round(dim.width * scale);
  const h = Math.round(dim.height * scale);
  const img = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 160, after: 60 },
    children: [
      new ImageRun({
        data: buf,
        transformation: { width: w, height: h },
        type: dim.type === "png" ? "png" : "jpg",
      }),
    ],
  });
  const cap = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [run(caption, { size: SZ.caption, italics: true, color: GREY })],
  });
  return [img, cap];
}

// ---- Tables -----------------------------------------------------------------
const BORDER = { style: BorderStyle.SINGLE, size: 4, color: "999999" };
const ALL_BORDERS = {
  top: BORDER, bottom: BORDER, left: BORDER, right: BORDER,
  insideHorizontal: BORDER, insideVertical: BORDER,
};

function cell(text, opts = {}) {
  const children = Array.isArray(text)
    ? richRuns(text, { size: opts.size ?? SZ.small })
    : [run(text, { size: opts.size ?? SZ.small, bold: opts.bold || false })];
  return new TableCell({
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    shading: opts.shade
      ? { type: ShadingType.CLEAR, fill: "EEEEEE", color: "auto" }
      : undefined,
    children: Array.isArray(children)
      ? children.map(
          (c) =>
            new Paragraph({
              spacing: { line: 260, after: 0 },
              children: [c],
            })
        )
      : [new Paragraph({ spacing: { line: 260, after: 0 }, children })],
  });
}

// header-aware table. rows[0] is the header row.
function table(header, rows, colWidths) {
  const headerRow = new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: header.map((h, i) =>
      cell(h, { bold: true, shade: true, width: colWidths?.[i] })
    ),
  });
  const bodyRows = rows.map(
    (r) =>
      new TableRow({
        cantSplit: true,
        children: r.map((c, i) => cell(c, { width: colWidths?.[i] })),
      })
  );
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: ALL_BORDERS,
    rows: [headerRow, ...bodyRows],
  });
}

// table title paragraph (kept with the table via keepNext)
function tableTitle(text) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    keepNext: true,
    spacing: { before: 200, after: 80 },
    children: [run(text, { size: SZ.caption, bold: true })],
  });
}
function spacer() {
  return new Paragraph({ spacing: { after: 80 }, children: [run("")] });
}

// ---- Misc paragraph builders ------------------------------------------------
function caption(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [run(text, { size: SZ.caption, italics: true, color: GREY })],
  });
}

// A simple hanging-indent reference entry (APA-ish).
function refEntry(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: 320, after: 140 },
    indent: { left: 480, hanging: 480 },
    children: Array.isArray(text) ? richRuns(text) : [run(text, { size: SZ.body })],
  });
}

module.exports = {
  SZ, FONT, BLACK, GREY,
  run, richRuns, body, bodyFlat, bullet, numItem,
  h1, h1NoBreak, h2, h3, figure, table, tableTitle, spacer, caption, refEntry,
};
