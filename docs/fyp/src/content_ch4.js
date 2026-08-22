// content_ch4.js — Chapter 4: System Analysis.
const {
  h1, h2, h3, body, bodyFlat, bullet, numItem, figure, table, tableTitle, spacer,
} = require("./helpers");

function chapter4() {
  return [
    h1("CHAPTER 4: SYSTEM ANALYSIS"),

    h2("4.1 Introduction"),
    bodyFlat(
      "This chapter analyses the requirements that Cogdoc must satisfy. It begins with the evidence gathered from the user survey and interviews, then defines the target user personas and the use cases. From these it derives the functional and non-functional requirements, and it states the assumptions and constraints under which the system operates."
    ),

    h2("4.2 Requirements Gathering: Survey Results"),
    bodyFlat(
      "The project surveyed thirty-three respondents (undergraduates, postgraduates, doctoral candidates, researchers, and academic writers) to understand how generative AI is actually used in academic writing and how receptive users would be to a friction-based tool. The headline findings are summarised in Table 4.1. The full survey instrument appears in Appendix A."
    ),
    tableTitle("Table 4.1: Headline survey findings (n = 33)"),
    table(
      ["Indicator", "Finding"],
      [
        ["Uses generative AI daily for academic work", "63.6%"],
        ["Pastes AI-generated text into drafts largely unchanged", "69.6%"],
        ["Trusts AI-generated factual claims despite known hallucination risk", "68.4%"],
        ["Strongly verifies AI citations against original sources", "26.3% (only)"],
        ["Spends less time thinking about structure and flow when using AI", "72.2%"],
        ["Feels they have mastered a topic from an AI summary without reading the core literature", "68.2%"],
        ["Rates a friction-based tool useful for long-term learning", "59.1%"],
        ["Would find such a tool frustrating under deadline pressure", "78.3%"],
      ],
      [62, 38]
    ),
    spacer(),
    body(
      "Two findings dominate the design. The first six rows confirm the problem: a large majority of users offload thinking to AI, trust unverified claims, and feel a false sense of mastery. The last two rows define the central design tension: a majority wants a friction-based tool for the long term, but an even larger majority expects it to be frustrating under deadline pressure. This single tension drives the friction-calibration research contribution described in Chapters 5 and 7 \u2014 the system must be strict enough to force reflection, yet not so obstructive that users abandon it."
    ),

    h2("4.3 User Personas"),
    bodyFlat("Three personas were defined from the survey and interviews."),
    h3("4.3.1 Persona 1 \u2014 Aarav, Undergraduate (FYP Stage)"),
    bodyFlat(
      "Aarav is writing his final-year report under deadline pressure. He is a heavy daily AI user; he pastes AI text and rarely verifies citations. He needs claim verification he can trust and something that stops him delegating whole sections without removing all speed. He represents the user most at risk of cognitive atrophy."
    ),
    h3("4.3.2 Persona 2 \u2014 Dr. Lim, Postgraduate Researcher"),
    bodyFlat(
      "Dr. Lim writes literature-heavy work across twenty to fifty PDFs. She wants evidence-grounded feedback and Socratic challenge, not generation. She needs reliable cross-document retrieval and wants her assumptions exposed. She is the primary user of the Citation Sentinel."
    ),
    h3("4.3.3 Persona 3 \u2014 Sam, Professional Academic Editor"),
    bodyFlat(
      "Sam drafts under discipline and values friction as a craft tool. He needs structural scaffolding without text generation and deep links to source passages for citation work. He is the primary user of the Scaffold engine and the export features."
    ),

    h2("4.4 Use Cases"),
    bodyFlat(
      "From the personas, six primary use cases were identified. Figure 4.1 presents the use case diagram. The system also defines explicit anti-use-cases: notably, \u201cask the AI to write a paragraph for me\u201d is deliberately not supported, in any mode."
    ),
    ...figure("04_usecase.png", "Figure 4.1: Use case diagram", 620),
    numItem("UC-1", "Sign up / log in: a user creates an account or signs in (via Supabase auth when configured, or enters the single-user prototype mode)."),
    numItem("UC-2", "Create and open a project: the user creates a project, which contains one document and one research library."),
    numItem("UC-3", "Write in the editor: the user types into the editor; the document autosaves every 1.5 seconds."),
    numItem("UC-4", "Upload research PDFs: the user drags PDFs into the library or pastes text; the content is parsed, chunked, embedded, and indexed for retrieval."),
    numItem("UC-5", "Receive AI interventions: as the user completes sentences, pauses, or finishes paragraphs, the engines fire and present coloured wavy underlines with hover popovers containing questions, verdicts, or scaffolds and actionable next-steps."),
    numItem("UC-6", "Export and review: the user exports the document to Markdown, plain text, or HTML, and reviews analytics and the full intervention history."),

    h2("4.5 Context of the System"),
    bodyFlat(
      "At the highest level, Cogdoc sits between the writer, the AI provider, the database, and the authentication provider. The writer supplies draft text, PDFs, and prompts; the system returns interventions, verdicts, exports, and analytics. All embedding and language-model work is delegated to Google Gemini; all data and vectors live in a PostgreSQL database with the pgvector extension; and authentication is delegated to Supabase. Figure 4.2 shows this context (a Data Flow Diagram, Level 0)."
    ),
    ...figure("05_context.png", "Figure 4.2: Context diagram (DFD Level 0)", 640),

    h2("4.6 Functional Requirements"),
    bodyFlat(
      "The functional requirements (FRs) define what the system must do. Each is numbered for traceability into the design and implementation chapters."
    ),
    tableTitle("Table 4.2: Functional requirements"),
    table(
      ["ID", "Requirement"],
      [
        ["FR-1", "The system shall let a user register, log in, and remain authenticated across sessions, with per-user data isolation."],
        ["FR-2", "The system shall let a user create, open, rename, archive, and delete projects, each with one document and one library."],
        ["FR-3", "The system shall provide a rich-text editor that autosaves the document and supports bold, italic, underline, focus mode, and a word count."],
        ["FR-4", "The system shall detect writing triggers (sentence completion, idle pause, paragraph completion) and fire the matching AI engines."],
        ["FR-5", "The system shall provide four engines: Interceptor, Socratic Spacer, Citation Sentinel, and Scaffold."],
        ["FR-6", "The Interceptor shall reframe vague or absolute claims as Socratic questions; it shall block attempts to make it write prose."],
        ["FR-7", "The Citation Sentinel shall retrieve the top passages from the user\u2019s library and classify a verdict (supported, partially supported, unsupported, insufficient evidence)."],
        ["FR-8", "The system shall let a user upload PDFs and paste text, and shall parse, chunk, embed, and index the content for retrieval."],
        ["FR-9", "The system shall present interventions as coloured wavy underlines with hover popovers and actionable next-steps."],
        ["FR-10", "The system shall let a user switch among three friction modes (Socratic, Coach, Assistant) and shall enforce the non-generation invariant in all modes."],
        ["FR-11", "The system shall let a user export the document to Markdown, plain text, and HTML, and print to PDF."],
        ["FR-12", "The system shall record every intervention in an audit log and present analytics (engagement rate, verdict breakdowns, per-engine counts) and a full history."],
      ],
      [12, 88]
    ),
    spacer(),

    h2("4.7 Non-Functional Requirements"),
    bodyFlat(
      "The non-functional requirements (NFRs) constrain how the system behaves."
    ),
    tableTitle("Table 4.3: Non-functional requirements"),
    table(
      ["Category", "Requirement"],
      [
        ["Performance", "Autosave shall complete within ~1.5 seconds; engines shall fire on sentence completion with staggered ~500 ms delays to avoid disrupting typing."],
        ["Reliability", "The verdict engine shall never claim support when evidence is weak; it shall return \u201cinsufficient evidence\u201d instead. The test suite and coverage gate shall protect regressions."],
        ["Usability", "Interventions shall appear as non-intrusive underlines; the interface shall match the look of a notebook (serif body, generous line height). A user shall be able to relax friction under deadline pressure."],
        ["Security", "User data shall be isolated by row-level security at the database layer. Authentication shall never be bypassable in production; the dev fallback shall be ignored when NODE_ENV is production."],
        ["Maintainability", "Prompt content shall be versioned and editable without redeployment. The codebase shall maintain at least 80% test coverage."],
        ["Portability", "The system shall ship as a multi-architecture Docker image (AMD64 and ARM64) so it runs on x86, Apple Silicon, and ARM servers."],
      ],
      [22, 78]
    ),
    spacer(),

    h2("4.8 Assumptions and Constraints"),
    bodyFlat("The analysis is made under the following assumptions and constraints."),
    bullet("Assumption: users have a modern browser and a working internet connection to reach the AI provider."),
    bullet("Assumption: the AI provider (Google Gemini) is available and within the user\u2019s daily token budget."),
    bullet("Constraint: the system must never generate paragraph-length prose; this is a hard, non-negotiable design constraint enforced in code."),
    bullet("Constraint: the evaluation corpus, while real, is modest (28 passages, 50 claims); large-scale performance is treated as future work."),
    bullet("Constraint: development was time-boxed to a roughly sixty-day window by a single developer."),

    h2("4.9 Summary"),
    bodyFlat(
      "The survey confirmed both the problem (heavy offloading and weak verification) and the central design tension (users want friction but fear it under pressure). Three personas and six use cases were derived, together with twelve functional and six categories of non-functional requirements. These requirements drive the system design presented in Chapter 5."
    ),
  ];
}

module.exports = { chapter4 };
