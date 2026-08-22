// generate.js — assembles the Cogdoc FYP report into a single .docx.
// Minimal-academic style: Times New Roman, black, no decorative cover.
// Sections: Cover (no number) | Front matter (roman) | Body (arabic, from 1).
const {
  Document, Packer, Paragraph, TextRun, AlignmentType, NumberFormat,
  Header, Footer, PageNumber, SectionType, HeadingLevel,
} = require("docx");
const fs = require("fs");
const path = require("path");

const { FONT, SZ, BLACK, GREY, run } = require("./helpers");
const {
  cover, declaration, acknowledgement, abstract, toc, listFiguresTables,
} = require("./content_front");
const { chapter1 } = require("./content_ch1");
const { chapter2 } = require("./content_ch2");
const { chapter3 } = require("./content_ch3");
const { chapter4 } = require("./content_ch4");
const { chapter5 } = require("./content_ch5");
const { chapter6 } = require("./content_ch6");
const { chapter7 } = require("./content_ch7");
const { chapter8, references, appendices } = require("./content_ch8_refs_appx");

// ---- Shared default document style -----------------------------------------
const defaultStyles = {
  default: {
    document: {
      run: { font: { ascii: FONT, hAnsi: FONT }, size: SZ.body, color: BLACK },
      paragraph: { spacing: { line: 360 } },
    },
    heading1: {
      run: { font: { ascii: FONT, hAnsi: FONT }, size: SZ.h1, bold: true, color: BLACK },
      paragraph: { spacing: { before: 0, after: 240 } },
    },
    heading2: {
      run: { font: { ascii: FONT, hAnsi: FONT }, size: SZ.h2, bold: true, color: BLACK },
      paragraph: { spacing: { before: 280, after: 120 } },
    },
    heading3: {
      run: { font: { ascii: FONT, hAnsi: FONT }, size: SZ.h3, bold: true, color: BLACK },
      paragraph: { spacing: { before: 200, after: 100 } },
    },
  },
};

// ---- Footers ----------------------------------------------------------------
function pageFooter(format) {
  // format: "roman" | "arabic"
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            children: [PageNumber.CURRENT],
            font: { ascii: FONT, hAnsi: FONT },
            size: SZ.small,
            color: GREY,
          }),
        ],
      }),
    ],
  });
}

// running header for body pages
function bodyHeader() {
  return new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          new TextRun({
            text: "Cogdoc \u2014 Final Year Project Report",
            font: { ascii: FONT, hAnsi: FONT },
            size: SZ.small,
            italics: true,
            color: GREY,
          }),
        ],
      }),
    ],
  });
}

// ---- Assemble ----------------------------------------------------------------
const bodyChildren = [
  ...chapter1(),
  ...chapter2(),
  ...chapter3(),
  ...chapter4(),
  ...chapter5(),
  ...chapter6(),
  ...chapter7(),
  ...chapter8(),
  ...references(),
  ...appendices(),
];

const doc = new Document({
  creator: "Samreshan Sahani",
  title: "Cogdoc \u2014 Final Year Project Report",
  description: "Cogdoc: A Research-Assisted Writing IDE to Mitigate Cognitive Atrophy in the Age of Generative AI",
  styles: defaultStyles,
  features: { updateFields: true },
  sections: [
    // 1. Cover — no header/footer, no page number
    {
      properties: {
        page: {
          margin: { top: 1440, bottom: 1440, left: 1701, right: 1440 },
        },
      },
      children: cover(),
    },
    // 2. Front matter — roman numerals starting at i
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: {
          margin: { top: 1440, bottom: 1440, left: 1701, right: 1440 },
          pageNumbers: { start: 1, formatType: NumberFormat.LOWER_ROMAN },
        },
      },
      footers: { default: pageFooter("roman") },
      children: [
        ...declaration(),
        ...acknowledgement(),
        ...abstract(),
        ...toc(),
        ...listFiguresTables(),
      ],
    },
    // 3. Body + references + appendices — arabic, restart at 1
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: {
          margin: { top: 1440, bottom: 1440, left: 1701, right: 1440 },
          pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
        },
      },
      headers: { default: bodyHeader() },
      footers: { default: pageFooter("arabic") },
      children: bodyChildren,
    },
  ],
});

const outPath = path.join(__dirname, "..", "Cogdoc_FYP_Documentation.docx");
Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(outPath, buf);
  console.log("Wrote", outPath, "(" + (buf.length / 1024).toFixed(1) + " KB)");
});
