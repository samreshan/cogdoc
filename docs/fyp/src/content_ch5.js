// content_ch5.js — Chapter 5: System Design.
const {
  h1, h2, h3, body, bodyFlat, bullet, numItem, figure, table, tableTitle, spacer,
} = require("./helpers");

function chapter5() {
  return [
    h1("CHAPTER 5: SYSTEM DESIGN"),

    h2("5.1 Introduction"),
    bodyFlat(
      "This chapter presents the design of Cogdoc. It covers the overall architecture, the major design decisions recorded as Architecture Decision Records (ADRs), the central design principle (the non-generation contract and friction calibration), the data model, the user-interface and user-experience design, and the design of the four AI engines. The chapter describes the system as it was built, noting where the implementation matured beyond the original specification."
    ),

    h2("5.2 System Architecture"),
    bodyFlat(
      "Cogdoc is a two-service application. A Next.js application serves both the front end (the editor and all user-interface components) and a backend-for-frontend (BFF) layer of route handlers that own the engine logic and database access through the Prisma object-relational mapper. A separate Python FastAPI service performs the heavy retrieval-augmented-generation work: embedding documents and queries, vector retrieval, and the citation verdict. The two services communicate across a single, well-defined seam called the AI gateway. Google Gemini provides both the large language model and the embedding model. Figure 5.1 shows the architecture."
    ),
    ...figure("06_architecture.png", "Figure 5.1: System architecture", 640),
    body(
      "This separation is deliberate. Keeping the retrieval and embedding logic in a dedicated Python service lets the project use the mature Python ecosystem for vector operations (the pgvector adapter and the pgvector extension itself) while keeping the interactive, latency-sensitive editor in a single Next.js deployment. The AI gateway (src/lib/ai-gateway.ts) is the only shared merge point between the two codebases, which kept parallel development safe during the sprints."
    ),
    body(
      "Deployment uses Docker Compose with three containers: the Next.js application, the FastAPI service, and a PostgreSQL database with pgvector enabled. An interactive first-run wizard and an entrypoint script configure the AI provider, the database, and authentication. The image is built for two CPU architectures (AMD64 and ARM64) so it runs on conventional x86 servers, Apple Silicon, and ARM cloud instances. Figure 5.2 shows the deployment view."
    ),
    ...figure("07_deployment.png", "Figure 5.2: Component and deployment view", 600),

    h2("5.3 Major Design Decisions (Architecture Decision Records)"),
    bodyFlat(
      "The most significant design decisions were recorded as Architecture Decision Records so that the reasoning would survive the sprint in which it was made. Five ADRs are summarised here."
    ),
    numItem("ADR-0000", "Spec-versus-build reconciliation. A master document accounting for every deviation between the original specification and the delivered system. It records that the core commitments (a FastAPI retrieval service, streaming, authentication, and a decoupled architecture) were met, and that two items (the pgvector adapter and the Tiptap editor) were delivered as a real interface plus a working surface rather than only an interface."),
    numItem("ADR-0006", "Tiptap editor migration. The original prototype used a raw contentEditable surface with a deprecated command interface; the specification required a React + Tiptap (ProseMirror) editor. The decision was to deliver the Tiptap extension layer (the wavy-underline mark and the idle detector) first, then complete the full surface swap. The swap later landed and the legacy editor was deleted, leaving a single Tiptap surface."),
    numItem("ADR-0007", "Streaming delivery (partial). The specification required all four engines to stream their output token-by-token over Server-Sent Events. The decision was to implement streaming end-to-end for the Interceptor engine first (the highest demonstration value) and to keep the other three as blocking route handlers, rather than ship four broken streams. The remaining engines carry explicit phase markers for later streaming."),
    numItem("ADR-0008", "Real embeddings and pgvector. Live retrieval originally used a keyword-overlap baseline; the FastAPI service used a hashing-based surrogate embedder. This decision added a real Gemini embedding adapter and a pgvector store, and it recorded the central finding that switching to real embeddings requires re-calibrating the verdict guard (see Chapter 7)."),
    numItem("ADR-0009", "Document content as ProseMirror JSON. Document content was originally stored as an HTML string. The decision made ProseMirror JSON the canonical store (serialised by the Tiptap editor), while accepting legacy HTML on load for backwards compatibility. Documents migrate lazily on first open-and-save under the new editor."),

    h2("5.4 The Non-Generation Contract and Friction Calibration"),
    bodyFlat(
      "The single most important design principle is the non-generation contract. In every mode and under every circumstance, the system is structurally prevented from producing paragraph-length prose for the user. This is enforced by an explicit guard (an isGenerationAllowed check) implemented in both the TypeScript and Python code. The guard counts declarative sentences and words in any candidate output: three or more declarative sentences, or more than sixty words, or any direct prose that answers the user\u2019s request, is blocked. What is allowed is a Socratic question, a citation verdict, or an empty structural scaffold with blanks. Figure 5.6 shows this decision flow."
    ),
    ...figure("11_non_generation.png", "Figure 5.6: The non-generation contract decision flow", 620),
    body(
      "Friction calibration is the research contribution that sits on top of this invariant. The system offers three modes, selected by the user. In Socratic mode (the default) all engines are active with full cooldowns and the experimental autocomplete cannot be accepted. In Coach mode the cooldowns are relaxed by about half and phrase acceptance by typing is allowed. In Assistant mode the cooldowns are relaxed by about three quarters and tab-acceptance of short ghost text is allowed, but the Interceptor still blocks any explicit request to \u201cwrite the whole thing\u201d. Critically, friction calibration relaxes only the cadence of interventions and the acceptance of help; it never relaxes the non-generation contract. This is how the design resolves the survey tension: a user under deadline pressure can dial the friction down, but the AI still cannot write their essay. Figure 5.5 shows the flow."
    ),
    ...figure("10_friction.png", "Figure 5.5: Friction mode calibration and the non-generation contract", 600),

    h2("5.5 Data Modelling"),
    bodyFlat(
      "The data model consists of eight tables normalised to third normal form, managed through the Prisma schema (with separate definitions for the SQLite prototype and the PostgreSQL production database). The model centres on the Intervention entity, which is the audit record of every AI action, and on the PdfChunk entity, which carries the vector embedding column managed by raw SQL (because Prisma cannot represent the pgvector type directly). Figure 5.3 is the entity-relationship diagram, and Table 5.2 describes each entity."
    ),
    ...figure("08_er.png", "Figure 5.3: Entity-relationship diagram (eight tables)", 640),
    tableTitle("Table 5.2: Data model \u2014 entity descriptions"),
    table(
      ["Entity", "Purpose and key fields"],
      [
        ["User", "A registered writer. Holds email, display name, a daily token budget, and the chosen friction mode (socratic, coach, or assistant)."],
        ["Project", "A writing project owned by a user. Has a title, description, and an archived flag. Contains exactly one Document and a set of PDFs."],
        ["Document", "The text being written, one per project. Stores the content as ProseMirror JSON and a lastSaved timestamp for autosave."],
        ["Pdf", "An uploaded research source. Holds the filename, the extracted raw text, the file size, and a parse status (queued, ready, or failed)."],
        ["PdfChunk", "A ~500-token passage of a PDF. Holds the chunk index, content, character count, an approximate page, and the vector embedding (a vector(3072) column managed outside Prisma)."],
        ["Intervention", "The central audit entity. Records the engine type, the prompt and response, the verdict (for citations), a status (active, faded, resolved), and the user\u2019s action (engaged, dismissed, ignored)."],
        ["InterventionEvidence", "A junction linking an Intervention to the PdfChunk(s) that were retrieved as evidence, with a similarity score and the cited excerpt."],
        ["PromptTemplate", "A versioned, editable prompt keyed by behaviour tag (Provocation, Lens, Structural Scaffold, The Spark Gap). Edits do not require a redeployment."],
      ],
      [20, 80]
    ),
    spacer(),

    h2("5.6 Data Flow"),
    bodyFlat(
      "Figure 5.4 is a Level 1 data-flow diagram. It shows the processes (manage auth and projects, edit and autosave the document, detect triggers, run the engines, ingest and embed PDFs, retrieve and verify claims, render interventions, and export) and the data stores they read and write (the document store, the PDF-chunk and vector store, the intervention audit log, and the prompt templates)."
    ),
    ...figure("09_dfd1.png", "Figure 5.4: Data flow diagram, Level 1", 660),

    h2("5.7 User-Interface and User-Experience Design"),
    bodyFlat(
      "The interface is designed to feel like a focused notebook, not a chatbot. The editor uses a serif typeface (Newsreader) at a comfortable size with generous line height, so that reading one\u2019s own draft is pleasant. Autosave is continuous (debounced to 1.5 seconds) and a live save indicator reassures the writer that their work is safe."
    ),
    body(
      "Interventions are deliberately non-intrusive. When an engine fires on a sentence, that sentence receives a coloured wavy underline, each colour mapping to an engine: amber for the Interceptor, rose for the Socratic Spacer, emerald for the Citation Sentinel, sky for the Scaffold, and a neutral stone colour when multiple engines fire on one sentence. The underline appears about 2.5 seconds after the engine fires, so that it never interrupts the act of typing. Hovering over an underlined sentence opens a popover that stacks every intervention for that sentence vertically, each with its own actionable next-step (for example, Find evidence, Rewrite claim, View evidence, Apply scaffold, or Answer this). Small animated \u201cpixelated pets\u201d in the margin provide a light, playful signal that an engine has fired, making the otherwise invisible cognitive activity feel alive."
    ),
    body(
      "The friction mode is exposed as a simple selector (Socratic, Coach, Assistant) so that the user always knows and always controls how much challenge they are receiving; mode changes are never secret or automatic. The whole experience is built with Tailwind CSS and the shadcn/ui component library on top of Radix primitives, with Framer Motion for the transitions. The editor itself is built on Tiptap and ProseMirror, which gave the project clean control over decorations (the underlines) and document state."
    ),

    h2("5.8 Design of the Four AI Engines"),
    bodyFlat(
      "The four engines are the heart of the system. Each has a precise trigger condition, a behaviour, and a set of actionable outcomes. Table 5.1 summarises them."
    ),
    tableTitle("Table 5.1: The four AI engines"),
    table(
      ["Engine", "Behaviour tag", "Fires when", "What it does"],
      [
        ["Interceptor", "The Spark Gap", "Vague language (\u201cbasically\u201d, \u201cstuff\u201d) or absolute claims (\u201calways\u201d, \u201cnever\u201d)", "Reframes the sentence as a Socratic question that forces specificity; blocks requests to write prose."],
        ["Socratic Spacer", "Provocation", "A ~2-second idle pause, or a question sentence", "Asks a provocative question that challenges the writer\u2019s assumption."],
        ["Citation Sentinel", "Lens", "A factual claim (contains \u201cresearch\u201d, \u201cstudy\u201d, \u201c%\201d, and is six or more words)", "Retrieves the top passages from the user\u2019s library and returns a verdict with cited evidence."],
        ["Scaffold", "Structural Scaffold", "A long sentence (25+ words) or paragraph completion", "Offers an empty Claim / Evidence / Limitation / Implication outline the writer fills in."],
      ],
      [16, 16, 34, 34]
    ),
    spacer(),
    body(
      "A single sentence can trigger several engines at once, and their results stack in the popover. Triggers are detected by a content analyser that runs when the writer ends a sentence (with a full stop, question mark, or exclamation mark), goes idle, or completes a paragraph (pressing Enter). To avoid overwhelming the writer, fired engines respect per-engine cooldowns and are staggered by 500 milliseconds. Two experimental engines extend the set: a Devil\u2019s Autocomplete that offers very short (no more than twelve words, single-sentence) ghost text accepted only by Tab and only in Assistant mode, and a Blindspot Monitor that surfaces one overlooked but highly relevant library passage per session. Both experiments stay inside the non-generation contract."
    ),

    h2("5.9 Summary"),
    bodyFlat(
      "The design is a two-service architecture with a clean AI-gateway seam, eight normalised tables centred on the Intervention audit entity, and a hard non-generation invariant that no friction mode can relax. The four engines turn the literature\u2019s call for productive friction into concrete behaviour, presented through a notebook-style interface with non-intrusive, actionable interventions. The next chapter describes how this design was implemented."
    ),
  ];
}

module.exports = { chapter5 };
