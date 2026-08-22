// content_ch6.js — Chapter 6: Implementation.
const {
  h1, h2, h3, body, bodyFlat, bullet, numItem, figure, table, tableTitle, spacer,
} = require("./helpers");

function chapter6() {
  return [
    h1("CHAPTER 6: IMPLEMENTATION"),

    h2("6.1 Introduction"),
    bodyFlat(
      "This chapter describes how the design of Chapter 5 was implemented. It covers the development environment and the technologies used, the implementation of the four engines, the retrieval-augmented-generation pipeline (including the verdict guard and the calibration finding), authentication and security, and deployment. It closes with a condensed user guide so that an examiner can use the system."
    ),

    h2("6.2 Development Environment and Tools"),
    bodyFlat(
      "The front end and backend-for-frontend were written in TypeScript on Next.js (App Router) with React. The editor is built on Tiptap and ProseMirror. Styling uses Tailwind CSS and the shadcn/ui library; state management uses Zustand, with Framer Motion for animation. The retrieval service is written in Python with FastAPI and Pydantic. The database is PostgreSQL with the pgvector extension, accessed from TypeScript through the Prisma ORM and from Python through a dedicated pgvector adapter. Both codebases were built test-first, as described in Chapter 3. Table 6.1 summarises the technologies."
    ),
    tableTitle("Table 6.1: Technologies and tools used"),
    table(
      ["Layer", "Technology"],
      [
        ["Front end", "Next.js (App Router), React, TypeScript, Tailwind CSS, shadcn/ui (Radix), Framer Motion, Zustand, TanStack Query/Table, Recharts"],
        ["Editor", "Tiptap / ProseMirror (custom extensions: wavy underline, idle detector, intervention highlight)"],
        ["Backend-for-frontend", "Next.js Route Handlers, Prisma ORM"],
        ["Retrieval service", "Python, FastAPI, Uvicorn, Pydantic, httpx"],
        ["AI provider", "Google Gemini \u2014 gemini-3.1-flash-lite (LLM) and gemini-embedding-001 (3072-dim embeddings)"],
        ["Database", "PostgreSQL with pgvector; SQLite for the local prototype"],
        ["Auth", "Supabase Auth (@supabase/ssr) with row-level security; single-user dev fallback (disabled in production)"],
        ["Tooling", "Bun, Vitest, pytest, Docker / Docker Compose (multi-arch buildx), Conventional Commits"],
      ],
      [22, 78]
    ),
    spacer(),

    h2("6.3 Implementing the Engines"),
    bodyFlat(
      "The engine-orchestration logic lives in the front end. A content analyser inspects the document whenever the writer ends a sentence, goes idle, or completes a paragraph. When a trigger matches one or more engines, the orchestration fires the matching engine handlers, staggered by 500 milliseconds and respecting per-engine cooldowns. The Interceptor, Socratic Spacer, and Scaffold engines call the large language model through the backend-for-frontend; the Interceptor may also stream over Server-Sent Events from the FastAPI service. Each result is persisted as an Intervention in the database, then rendered as a wavy-underline decoration on the triggering sentence (added after a 2.5-second debounce so typing is never interrupted). Figure 6.1 shows the sequence."
    ),
    ...figure("12_seq_firing.png", "Figure 6.1: Sequence \u2014 engine firing and intervention rendering", 640),
    body(
      "Every prompt is loaded from the versioned PromptTemplate table rather than being hard-coded, so that prompt content can be edited and versioned without a redeployment. A lightweight delegation-heuristic check inspects the writer\u2019s input first, using a regular expression, so that obviously delegative prompts (\u201cwrite this for me\u201d) can be blocked without spending a model call."
    ),

    h2("6.4 The Retrieval-Augmented-Generation Pipeline"),
    bodyFlat(
      "The Citation Sentinel is the engine that grounds factual claims in real evidence. Its pipeline has four stages: chunking, embedding, retrieval, and verdict classification."
    ),
    h3("6.4.1 Ingest, Chunk, and Embed"),
    bodyFlat(
      "When a user uploads a PDF, the application extracts its text, splits it into roughly 500-token passages, and stores each passage as a PdfChunk row. The chunks are then sent to the FastAPI service, which embeds them using the Gemini embedding model and stores the resulting vectors in the pgvector column. The writer\u2019s own chunk identifiers are passed verbatim, so that retrieved evidence can be linked back to the exact passage for citation. Figure 6.3 shows this sequence."
    ),
    ...figure("14_seq_ingest.png", "Figure 6.3: Sequence \u2014 PDF ingest and embedding", 620),
    h3("6.4.2 Retrieve and Classify"),
    bodyFlat(
      "When the writer completes a factual claim, the claim is embedded as a query and the FastAPI service retrieves the five most similar passages from that project\u2019s chunks using cosine similarity over an HNSW index. These passages, plus the claim, are then sent to the language model with an evidence-only prompt, and the model returns one of four verdict labels. Figure 6.2 shows the sequence."
    ),
    ...figure("13_seq_citation.png", "Figure 6.2: Sequence \u2014 the Citation Sentinel RAG verdict", 640),
    h3("6.4.3 The Verdict Guard"),
    bodyFlat(
      "A guard wraps the verdict classification to prevent hallucinated support. If the grounding is weak \u2014 the highest similarity score is below a floor, or no passages were retrieved \u2014 the verdict is forced to \u201cinsufficient evidence\u201d regardless of what the language model said. This is the system\u2019s direct response to the stochastic-parrots critique from Chapter 2: the model\u2019s fluency is never allowed to invent evidence. The floor therefore remains as a production backstop against hallucinated support."
    ),
    h3("6.4.4 Asymmetric Embeddings and the Calibration Finding"),
    bodyFlat(
      "Two implementation findings turned out to be research contributions. First, the Gemini embedding model is asymmetric by design: documents and queries must be embedded with different task types (a retrieval-document task for the corpus, a retrieval-query task for the claim). An early bug embedded queries with the wrong task type, which measurably degraded ranking; fixing it raised Recall@5 and made vector retrieval win at every cut-off. Second, real embeddings produce a high baseline cosine similarity even for unrelated distractor claims, so the similarity floor calibrated for the simple surrogate embedder was far too low. Switching to real embeddings therefore required re-calibrating the verdict guard, not merely the retriever \u2014 a finding recorded in ADR-0008 and quantified in Chapter 7."
    ),

    h2("6.5 Intervention Lifecycle"),
    bodyFlat(
      "Every engine result is an Intervention, and its lifecycle is a small state machine. A new Intervention starts in the Active state (no user action yet, visible as a wavy underline). If the writer edits the triggering sentence so that the underline can no longer be matched, the Intervention moves to Faded, from which it can re-activate when the sentence is completed again. When the writer engages (answers the question, applies a scaffold, or accepts a verdict) the Intervention becomes Resolved. If a cooldown passes with no action, it is marked Ignored but is never deleted \u2014 it remains in the audit log for the History view. Figure 6.4 shows this state machine."
    ),
    ...figure("15_state.png", "Figure 6.4: Intervention state machine", 560),

    h2("6.6 Authentication and Security"),
    bodyFlat(
      "The system supports two authentication paths. In production it uses Supabase Auth with session-based authentication through the server-side Supabase SDK; a middleware layer refreshes session cookies and redirects unauthenticated browser requests to the login screen. A single-user development fallback exists for local prototyping, but it is hard-ignored whenever the environment is set to production, so it can never bypass authentication in a deployed system. At the database layer, every user-scoped table is protected by a row-level-security policy that restricts each row to its owning user, so that data isolation is enforced by the database itself and not only by the application. The FastAPI service connects with a service-role connection that bypasses row-level security only for the trusted server-side work of ingesting embeddings."
    ),

    h2("6.7 Deployment"),
    bodyFlat(
      "The system ships as a multi-stage Docker image built for two CPU architectures (AMD64 and ARM64), so the same image runs on x86 servers, Apple Silicon machines, and ARM cloud hosts. Docker Compose orchestrates three containers: the Next.js application, the FastAPI retrieval service, and a PostgreSQL database with pgvector enabled. An interactive first-run wizard configures the AI provider, the database, and authentication, and an entrypoint script applies any pending migrations before starting the application. This makes a local evaluation straightforward for an examiner."
    ),

    h2("6.8 How to Use Cogdoc (Condensed Guide)"),
    bodyFlat(
      "The following steps summarise how to use the system; the complete guide appears in Appendix E."
    ),
    numItem("1", "Open Cogdoc in a browser and create a project (for example, \u201cLiterature Review \u2014 AI and Cognitive Offloading\u201d)."),
    numItem("2", "Upload research PDFs into the Library, or paste text from articles or notes. The content is parsed, chunked, embedded, and indexed."),
    numItem("3", "Write in the editor. The document autosaves every 1.5 seconds. As you finish sentences, pause, or complete paragraphs, the engines fire."),
    numItem("4", "Watch for coloured wavy underlines. Hover an underlined sentence to see the intervention(s) and their actionable next-steps."),
    numItem("5", "Use the mode selector to choose Socratic, Coach, or Assistant friction depending on your deadline pressure."),
    numItem("6", "Export to Markdown, plain text, or HTML, or print to PDF. Review your Stats and History for engagement and verdict breakdowns."),
    body(
      "Common troubleshooting: if the Citation Sentinel reports \u201cinsufficient evidence\u201d, upload more relevant sources; if no interventions appear, ensure sentences end with a full stop, question mark, or exclamation mark, and that the AI provider is configured (the Docker wizard handles this on first run)."
    ),

    h2("6.9 Summary"),
    bodyFlat(
      "The implementation realises the design across a TypeScript application and a Python retrieval service, with the engines orchestrated in the editor, prompts loaded from a versioned table, and the Citation Sentinel grounded in pgvector retrieval behind a hallucination guard. Two implementation findings \u2014 the asymmetry of the embeddings and the need to re-calibrate the verdict guard \u2014 became measurable research contributions. Chapter 7 presents the testing and evaluation that quantify them."
    ),
  ];
}

module.exports = { chapter6 };
