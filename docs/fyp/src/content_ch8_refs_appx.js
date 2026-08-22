// content_ch8_refs_appx.js — Chapter 8, References, and Appendices.
const {
  Paragraph, TextRun, AlignmentType, HeadingLevel, PageBreak,
} = require("docx");
const {
  h1, h2, h3, body, bodyFlat, bullet, numItem, figure, table, tableTitle, spacer,
  refEntry, run, SZ,
} = require("./helpers");

// ---------------- Chapter 8: Conclusion -------------------------------------
function chapter8() {
  return [
    h1("CHAPTER 8: CONCLUSION"),

    h2("8.1 Summary of Achievements"),
    bodyFlat(
      "This project set out to design, build, and evaluate a writing tool that uses AI to mitigate cognitive atrophy rather than cause it. Cogdoc achieves its aim. It is a research-assisted writing IDE in which the AI never writes the prose for the user; instead, four engines intervene in the margin \u2014 the Interceptor, the Socratic Spacer, the Citation Sentinel, and the Scaffold \u2014 questioning vague claims, provoking deeper thought, verifying facts against the writer\u2019s own library, and offering empty structural outlines."
    ),
    body(
      "Measured against the objectives of Chapter 1, the project: investigated the problem through a literature review and a survey of thirty-three respondents; designed and enforced a non-generation contract that structurally prevents prose generation; implemented all four engines with real-time detection and non-intrusive underlines; implemented retrieval-augmented claim verification against the writer\u2019s own PDFs behind a hallucination guard; implemented and evaluated a three-mode friction calibration; and evaluated the system against measurable targets, meeting its verdict-accuracy (macro-F1 0.773) and retrieval-recall (Recall@5 0.8875) goals. The system is also complete as a product: it has authentication, autosave, export, analytics, and a full intervention history, and it ships as a portable multi-architecture Docker image."
    ),

    h2("8.2 Research Contributions"),
    bodyFlat(
      "The project makes three contributions. The first is design: it operationalises the frictional-AI literature into a concrete, user-controllable, three-mode friction calibration backed by a hard non-generation invariant \u2014 an interaction primitive not offered by the reviewed existing tools. The second and third are empirical: a reproducible demonstration that Gemini\u2019s retrieval embeddings are asymmetric and that mixing their task types measurably degrades ranking; and the finding that switching to real embeddings requires re-calibrating the verdict guard rather than merely the retriever. These findings are recorded as Architecture Decision Records so that other builders can act on them."
    ),

    h2("8.3 Limitations"),
    bodyFlat(
      "The limitations, stated honestly, are these. The evaluation corpus is real but small, so the absolute metrics should be read as evidence on this corpus rather than as guarantees at scale. The ambitious fifteen-percentage-point ablation target was not met on this corpus. The live round-trip through a hosted pgvector instance was not verified because outbound database ports were blocked in the evaluation environment. User acceptance rests on a survey and interviews rather than a controlled trial. Finally, the system is evaluated in English, and its prompts and corpus reflect that."
    ),

    h2("8.4 Future Work"),
    bodyFlat(
      "The clearest next steps follow directly from the limitations. A larger stress-test corpus (the project\u2019s planned Sprint 4) would test whether the vector-over-keyword gap widens at scale as expected, and would justify the smaller, single-topic chunking identified as the highest-leverage retrieval improvement. Verifying the live pgvector round-trip against a managed instance would close the remaining deployment gap. Completing Server-Sent-Events streaming for the remaining three engines would deliver the original latency contract in full. A controlled usability study would convert the survey-based acceptance evidence into measured results. Finally, multilingual support and integration with reference managers would broaden the tool\u2019s reach."
    ),

    h2("8.5 Reflection"),
    bodyFlat(
      "Building Cogdoc reinforced a simple lesson: the discipline of test-driven development and an honest, measurable evaluation were what made it possible to tell, at the end, what actually worked and what did not. The targets that were met and the one that was not are reported openly, because the value of an empirical project lies in the reliability of its claims. The broader hope of the project is modest but clear: it shows that AI writing tools can be designed to make their users think more rather than less, and that such a design can be built and measured today."
    ),
  ];
}

// ---------------- References -------------------------------------------------
function refHeading() {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.LEFT,
    pageBreakBefore: true,
    spacing: { before: 0, after: 240 },
    children: [run("REFERENCES", { size: SZ.h1, bold: true })],
  });
}

function references() {
  return [
    refHeading(),
    refEntry("Bender, E. M., Gebru, T., McMillan-Major, A., & Shmitchell, S. (2021). On the dangers of stochastic parrots: Can language models be too big? In Proceedings of the 2021 ACM Conference on Fairness, Accountability, and Transparency (FAccT \u201921) (pp. 610\u2013623). Association for Computing Machinery."),
    refEntry("Bjork, R. A. (1994). Memory and metamemory considerations in the training of human beings. In J. Metcalfe & A. P. Shimamura (Eds.), Metacognition: Knowing about knowing (pp. 185\u2013205). MIT Press."),
    refEntry("Bush, V. (1945). As we may think. The Atlantic Monthly, 176(1), 101\u2013108."),
    refEntry("Cabitza, F., & Natali, A. (2024). Frictional AI as a design stance for human-centered artificial intelligence. In Human-centered artificial intelligence (pp. 91\u2013111). Springer."),
    refEntry("Engelbart, D. C. (1962). Augmenting human intellect: A conceptual framework (Summary Report, AFOSR-3233). Stanford Research Institute."),
    refEntry("Feathers, M. (2004). Working effectively with legacy code. Prentice Hall."),
    refEntry("Gerlich, M. (2025). AI tools in society: Impacts on cognitive offloading and the future of critical thinking. Societies, 15(1), Article 6. https://doi.org/10.3390/soc15010006"),
    refEntry("Kosmyna, N., et al. (2025). Your brain on ChatGPT: Accumulation of cognitive debt when using an AI assistant for essay writing tasks (MIT Media Lab / Brainwave study). Massachusetts Institute of Technology."),
    refEntry("Lee, M., Varshney, N. R., et al. (2025). The impact of generative AI on critical thinking: Self-reported reductions in cognitive effort and confidence effects among knowledge workers. Microsoft Research & Carnegie Mellon University."),
    refEntry("Risko, E. F., & Gilbert, S. J. (2016). Cognitive offloading. Trends in Cognitive Sciences, 20(9), 676\u2013688."),
    refEntry("Stadler, M., et al. (2024). The cognitive effects of large language models: Reduced load at the cost of reasoning depth. Studies on the cognitive impact of LLM assistance."),
  ];
}

// ---------------- Appendices -------------------------------------------------
function appxHeading(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.LEFT,
    pageBreakBefore: true,
    spacing: { before: 0, after: 240 },
    children: [run(text, { size: SZ.h1, bold: true })],
  });
}

function appendices() {
  return [
    appxHeading("APPENDIX A: SURVEY INSTRUMENT"),
    bodyFlat(
      "The requirements survey was administered online to thirty-three respondents recruited by purposive sampling (undergraduates, postgraduates, doctoral candidates, researchers, and academic writers). It had four sections."
    ),
    h2("Section 1 \u2014 Demographics and AI-usage habits"),
    bullet("What is your current role? (undergraduate / postgraduate / PhD / researcher / academic writer / other)"),
    bullet("How often do you use generative AI (e.g. ChatGPT, Gemini) for academic or research work? (daily / weekly / monthly / rarely)"),
    bullet("Which tools do you use most? (ChatGPT / Gemini / Grammarly / Elicit / other)"),
    h2("Section 2 \u2014 Cognitive offloading and automation bias"),
    bullet("I paste AI-generated text into my drafts largely unchanged. (5-point agreement scale)"),
    bullet("I trust the factual claims that AI generates, even though I know it can hallucinate. (5-point scale)"),
    bullet("I verify AI-generated citations against the original sources. (5-point scale)"),
    h2("Section 3 \u2014 Illusion of mastery"),
    bullet("I spend less time thinking about structure and flow when I use AI. (5-point scale)"),
    bullet("After reading an AI summary, I feel I have mastered a topic without reading the core literature. (5-point scale)"),
    h2("Section 4 \u2014 Receptivity to productive friction"),
    bullet("A tool that makes me slow down to question, verify, and defend my claims would help me learn in the long term. (5-point scale)"),
    bullet("Such a tool would frustrate me when I am under deadline pressure. (5-point scale)"),
    body("The headline results are reported in Table 4.1. The instrument was complemented by at least three semi-structured interviews using the guide below."),

    appxHeading("APPENDIX B: EVALUATION DATASET"),
    bodyFlat(
      "The evaluation corpus consisted of 28 verbatim passages (chunks) drawn from five real research PDFs, including the Gerlich (2025) study and papers on critical thinking, algorithmic fairness (the COMPAS / Northpointe recidivism tool), and environmental accounting. The 28 chunks included realistic distractors such as journal page furniture and licence boilerplate. Fifty claims were hand-labelled with ground-truth verdicts: 20 supported (paraphrases of source content), 10 partially supported (overstatement, incorrect causation, or misattributed intent), 10 unsupported (contradicted by the sources), and 10 with insufficient evidence (off-corpus, including topic-adjacent hard negatives such as the Gutenberg printing press and Norwegian recidivism). The claims were split deterministically into a calibration set of 19 and a held-out test set of 31; all reported metrics are on the held-out test set. Example claim\u2013verdict pairs from the per-claim results include: \u201cThe Gerlich study found no relationship between AI tool usage and critical thinking\u201d (expected unsupported, predicted unsupported) and \u201cPeople tend to remember where information lives rather than the information itself\u201d (expected supported, predicted supported)."),

    appxHeading("APPENDIX C: ADR INDEX"),
    tableTitle("Table C.1: Architecture Decision Records"),
    table(
      ["ADR", "Title", "Status"],
      [
        ["0000", "Spec-versus-build reconciliation (capstone)", "Accepted"],
        ["0006", "Tiptap editor migration: extensions built, surface swap delivered", "Closed"],
        ["0007", "SSE streaming: partial delivery (Interceptor first)", "Accepted"],
        ["0008", "Real embeddings + pgvector (with re-calibration finding)", "Accepted"],
        ["0009", "Document content migration: HTML \u2192 ProseMirror JSON", "Accepted"],
      ],
      [12, 68, 20]
    ),
    spacer(),

    appxHeading("APPENDIX D: API ENDPOINTS"),
    bodyFlat(
      "Table D.1 lists the principal application-programming endpoints. The backend-for-frontend exposes Next.js route handlers; the retrieval service exposes FastAPI endpoints."
    ),
    tableTitle("Table D.1: API endpoints"),
    table(
      ["Endpoint", "Service", "Purpose"],
      [
        ["POST /api/projects, GET/PATCH/DELETE /api/projects/[id]", "BFF", "Create, list, update, delete projects"],
        ["GET/PUT /api/projects/[id]/document", "BFF", "Load and autosave the document"],
        ["POST /api/projects/[id]/pdfs, DELETE /api/pdfs/[id]", "BFF", "Upload and delete research PDFs"],
        ["POST /api/projects/[id]/add-source, /find-sources", "BFF", "Add a web source; search the web for sources"],
        ["GET /api/projects/[id]/export", "BFF", "Export to Markdown / text / HTML"],
        ["POST /api/interceptor, /socratic-spacer, /scaffold", "BFF", "Run the non-streaming engines"],
        ["POST /api/citation-sentinel", "BFF", "Run the citation engine (delegates to RAG)"],
        ["POST /api/autocomplete, /blindspot", "BFF", "Experimental engines"],
        ["GET/PUT /api/interventions, PATCH /api/interventions/[id]", "BFF", "Intervention CRUD and user-action logging"],
        ["GET /api/analytics", "BFF", "Aggregate engagement and verdict statistics"],
        ["GET/PUT /api/settings, /api/user", "BFF", "User settings and current user"],
        ["POST /api/rag/ingest", "FastAPI", "Chunk, embed, and store a PDF\u2019s passages"],
        ["POST /api/rag/retrieve", "FastAPI", "Cosine ANN retrieval over a project\u2019s chunks"],
        ["POST /api/ai/citation", "FastAPI", "Retrieve and classify a verdict (with guard)"],
        ["POST /api/ai/interceptor/stream", "FastAPI", "SSE producer streaming the Interceptor output"],
      ],
      [40, 14, 46]
    ),
    spacer(),

    appxHeading("APPENDIX E: USER GUIDE"),
    bodyFlat("This appendix reproduces the end-user guide for the system."),
    h2("Getting started"),
    numItem("1", "Open Cogdoc in your browser (http://localhost:3000 when running locally)."),
    numItem("2", "Create a project \u2014 click New Project, enter a title, and click Create."),
    numItem("3", "Start writing in the editor. Your text autosaves every 1.5 seconds."),
    h2("The four engines and their underlines"),
    bullet("Amber wavy \u2014 Interceptor: fires on vague language or absolute claims; reframes the sentence as a question."),
    bullet("Rose wavy \u2014 Socratic Spacer: fires on a pause or a question; provokes deeper thinking."),
    bullet("Emerald wavy \u2014 Citation Sentinel: fires on factual claims; verifies them against your library."),
    bullet("Sky wavy \u2014 Scaffold: fires on long sentences or paragraph completion; offers an empty outline."),
    body("Hover an underlined sentence to see the intervention(s) and their actionable next-steps."),
    h2("Uploading research"),
    body("Click Library in the top bar, then Upload PDF (drag-and-drop) or Paste text. The content is parsed, chunked into roughly 500-token passages, embedded, and indexed. The Citation Sentinel can then verify your claims against it."),
    h2("Friction modes"),
    body("Use the mode selector to choose Socratic (full friction, the default), Coach (moderate), or Assistant (light, under deadline pressure). The AI still never writes your prose in any mode."),
    h2("Exporting and reviewing"),
    body("Click Export to download your draft as Markdown, plain text, or HTML, or to print to PDF. Use Stats and History in the top bar to review how many interventions each engine fired, your engagement rate, and the full intervention audit trail."),
    h2("Keyboard shortcuts"),
    table(
      ["Shortcut", "Action"],
      [
        ["Cmd/Ctrl + B / I / U", "Bold / Italic / Underline"],
        ["Esc", "Clear selection / close popover"],
        ["Enter", "New paragraph (may trigger Scaffold)"],
        ["Shift + Enter", "Line break (no new paragraph)"],
      ],
      [35, 65]
    ),
  ];
}

module.exports = { chapter8, references, appendices };
