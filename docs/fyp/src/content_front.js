// content_front.js — cover, declaration, acknowledgements, abstract, TOC.
const {
  Paragraph, TextRun, AlignmentType, HeadingLevel, PageBreak,
  TableOfContents, StyleLevel, TabStopType, TabStopPosition,
} = require("docx");
const { run, SZ, FONT, BLACK, GREY, h1NoBreak } = require("./helpers");

function centered(text, opts = {}) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: opts.before ?? 0, after: opts.after ?? 120, line: opts.line ?? 320 },
    children: [run(text, {
      size: opts.size ?? SZ.body,
      bold: opts.bold || false,
      italics: opts.italics || false,
      color: opts.color ?? BLACK,
    })],
  });
}

function blank(n = 1) {
  return Array.from({ length: n }, () =>
    new Paragraph({ spacing: { after: 0 }, children: [run("")] })
  );
}

// ---- Cover page (plain, no decoration) -------------------------------------
function cover() {
  return [
    ...blank(3),
    centered("ASIA PACIFIC UNIVERSITY OF TECHNOLOGY & INNOVATION", {
      size: SZ.h3, bold: true, after: 80,
    }),
    centered("School of Computing", { size: SZ.body, italics: true, after: 60 }),
    centered("BSc (Hons) in Information Technology", { size: SZ.body, after: 320 }),
    ...blank(2),
    centered(
      "COGDOC: A Research-Assisted Writing IDE to Mitigate Cognitive Atrophy in the Age of Generative AI",
      { size: SZ.title, bold: true, line: 380, after: 200 }
    ),
    centered("A Final Year Project Report", { size: SZ.h3, italics: true, after: 400 }),
    ...blank(3),
    centered("Submitted by", { size: SZ.body, after: 60 }),
    centered("Samreshan Sahani", { size: SZ.h2, bold: true, after: 60 }),
    centered("Student ID: [Student ID]", { size: SZ.body, after: 240 }),
    centered("Supervised by", { size: SZ.body, after: 60 }),
    centered("[Supervisor Name]", { size: SZ.body, bold: true, after: 320 }),
    ...blank(2),
    centered(
      "A report submitted in partial fulfilment of the requirements for the degree of Bachelor of Science (Honours) in Information Technology",
      { size: SZ.small, italics: true, line: 300, after: 240 }
    ),
    centered("Asia Pacific University of Technology & Innovation", {
      size: SZ.body, after: 40,
    }),
    centered("[Month Year]", { size: SZ.body, bold: true }),
  ];
}

function sectionHeading(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.CENTER,
    pageBreakBefore: true,
    spacing: { before: 0, after: 240 },
    children: [run(text, { size: SZ.h1, bold: true })],
  });
}

function declaration() {
  return [
    sectionHeading("DECLARATION"),
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { line: 360, after: 200 },
      children: [run(
        "I, Samreshan Sahani (Student ID: [Student ID]), hereby declare that the work contained in this Final Year Project report, entitled \u201cCogdoc: A Research-Assisted Writing IDE to Mitigate Cognitive Atrophy in the Age of Generative AI\u201d, is my own work and has not been submitted, either in part or in whole, for the award of any other degree or qualification at this or any other institution. All sources of information and ideas have been properly acknowledged and cited."
      )],
    }),
    ...blank(2),
    new Paragraph({
      spacing: { after: 240 },
      children: [run("Signature: ____________________________", { size: SZ.body })],
    }),
    new Paragraph({
      spacing: { after: 240 },
      children: [run("Name: Samreshan Sahani", { size: SZ.body })],
    }),
    new Paragraph({
      spacing: { after: 240 },
      children: [run("Date: ____________________________", { size: SZ.body })],
    }),
  ];
}

function acknowledgement() {
  return [
    sectionHeading("ACKNOWLEDGEMENTS"),
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { line: 360, after: 200 },
      indent: { firstLine: 360 },
      children: [run(
        "First and foremost, I would like to express my sincere gratitude to my supervisor, [Supervisor Name], for the continuous guidance, patience, and constructive feedback provided throughout the duration of this Final Year Project. The insights shared during our supervisory sessions shaped both the direction of the project and the rigour of its evaluation."
      )],
    }),
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { line: 360, after: 200 },
      indent: { firstLine: 360 },
      children: [run(
        "My thanks also go to the lecturers and staff of the School of Computing at Asia Pacific University of Technology & Innovation, whose modules on software development, systems analysis, and research methods laid the foundation for the work presented here."
      )],
    }),
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { line: 360, after: 200 },
      indent: { firstLine: 360 },
      children: [run(
        "I am grateful to the thirty-three respondents who took part in the project\u2019s survey and to those who agreed to be interviewed. Their honest accounts of writing with generative AI directly informed the design of Cogdoc and made the requirements gathering meaningful."
      )],
    }),
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { line: 360, after: 200 },
      indent: { firstLine: 360 },
      children: [run(
        "Finally, I thank my family and friends for their encouragement and understanding throughout the long hours of development, testing, and writing."
      )],
    }),
  ];
}

function abstract() {
  return [
    sectionHeading("ABSTRACT"),
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { line: 360, after: 200 },
      indent: { firstLine: 360 },
      children: [run(
        "Generative artificial intelligence (AI) writing tools such as ChatGPT, Gemini, and Grammarly make academic writing faster, but a growing body of evidence links heavy use of these tools to cognitive offloading \u2014 the habit of delegating higher-order thinking to a machine \u2014 and to an illusion of mastery in which a learner feels they understand a topic without doing the work that creates understanding. This project, Cogdoc, addresses that problem from the opposite direction: instead of writing prose for the user, Cogdoc is a research-assisted writing IDE whose AI acts as a challenger in the margin. A hard \u201cnon-generation contract\u201d structurally prevents the system from ever producing paragraph-length prose. Four AI engines then intervene in the margin: the Interceptor reframes vague or absolute claims as questions, the Socratic Spacer provokes deeper thinking during pauses, the Citation Sentinel verifies factual claims against the writer\u2019s own uploaded research library using retrieval-augmented generation (RAG), and the Scaffold offers empty structural outlines the writer fills in themselves."
      )],
    }),
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { line: 360, after: 200 },
      indent: { firstLine: 360 },
      children: [run(
        "The system is built as a two-service application: a Next.js front end that also acts as a backend-for-frontend, and a Python FastAPI service that performs embedding and retrieval over a PostgreSQL database with the pgvector extension. Google Gemini provides both the large language model and the embedding model. Development followed a test-driven, iterative process across four sprints, with an enforced eighty-percent code-coverage gate. The research contributions are twofold: a user-controllable friction calibration that relaxes engine cadence under deadline pressure without ever relaxing the non-generation contract, and an empirical evaluation showing that switching to real (asymmetric) embeddings requires re-calibrating the verdict guard rather than only the retriever. The evaluation achieved a verdict macro-F1 of 0.773 and a retrieval Recall@5 of 0.8875 against a real-corpus benchmark, meeting the project\u2019s targets. The findings suggest that AI can be designed to increase cognition rather than bypass it, and that this design can be evaluated with the same rigour applied to generative systems."
      )],
    }),
  ];
}

function toc() {
  return [
    sectionHeading("TABLE OF CONTENTS"),
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: 120 },
      children: [
        run(
          "Note: after opening this document, right-click the table below and choose \u201cUpdate Field\u201d to refresh the page numbers.",
          { size: SZ.small, italics: true, color: GREY }
        ),
      ],
    }),
    new TableOfContents("Table of Contents", {
      hyperlink: true,
      headingStyleRange: "1-3",
      stylesWithLevels: [
        new StyleLevel("Heading1", 1),
        new StyleLevel("Heading2", 2),
        new StyleLevel("Heading3", 3),
      ],
    }),
  ];
}

function listFiguresTables() {
  const figList = [
    "Figure 1.1: Project timeline (sprint plan over a 60-day window)",
    "Figure 3.1: The test-driven development gate cycle",
    "Figure 3.2: Overall project methodology",
    "Figure 4.1: Use case diagram",
    "Figure 4.2: Context diagram (DFD Level 0)",
    "Figure 5.1: System architecture",
    "Figure 5.2: Component and deployment view",
    "Figure 5.3: Entity-relationship diagram (eight tables)",
    "Figure 5.4: Data flow diagram, Level 1",
    "Figure 5.5: Friction mode calibration and the non-generation contract",
    "Figure 5.6: The non-generation contract decision flow",
    "Figure 6.1: Sequence \u2014 engine firing and intervention rendering",
    "Figure 6.2: Sequence \u2014 the Citation Sentinel RAG verdict",
    "Figure 6.3: Sequence \u2014 PDF ingest and embedding",
    "Figure 6.4: Intervention state machine",
    "Figure 7.1: Calibrated evaluation pipeline",
    "Figure 7.2: Per-verdict precision, recall and F1",
    "Figure 7.3: Vector versus keyword retrieval recall by cut-off k",
  ];
  const tabList = [
    "Table 2.1: Comparative analysis of existing writing tools",
    "Table 4.1: Headline survey findings (n = 33)",
    "Table 4.2: Functional requirements",
    "Table 4.3: Non-functional requirements",
    "Table 5.1: The four AI engines",
    "Table 5.2: Data model \u2014 entity descriptions",
    "Table 6.1: Technologies and tools used",
    "Table 6.2: API endpoints",
    "Table 7.1: Test summary",
    "Table 7.2: Evaluation results against targets",
  ];
  const figParas = figList.map(
    (f) =>
      new Paragraph({
        spacing: { line: 300, after: 40 },
        children: [run(f, { size: SZ.body })],
      })
  );
  const tabParas = tabList.map(
    (t) =>
      new Paragraph({
        spacing: { line: 300, after: 40 },
        children: [run(t, { size: SZ.body })],
      })
  );
  return [
    sectionHeading("LIST OF FIGURES"),
    ...figParas,
    sectionHeading("LIST OF TABLES"),
    ...tabParas,
  ];
}

module.exports = { cover, declaration, acknowledgement, abstract, toc, listFiguresTables };
