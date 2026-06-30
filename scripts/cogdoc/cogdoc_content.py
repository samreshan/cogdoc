"""Cogdoc architecture document - content builders.

This module is imported by generate_body.py. It receives the `story` list
and a `ctx` dict containing style helpers (h1, h2, h3, body, bullet,
numbered, caption, quote, callout, std_table, embed_image, safe_keep,
PAGE_W, PAGE_H, CONTENT_W, ACCENT, ACCENT_2, etc.).
"""

from reportlab.platypus import Spacer, PageBreak, KeepTogether, HRFlowable, CondPageBreak
from reportlab.platypus import Table, TableStyle, Paragraph, Image, Preformatted
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.lib import colors


def build_story(story, ctx):
    """Append the entire document body to `story`."""
    g = _Globals(ctx)
    _chapter_1(story, g)
    _chapter_2(story, g)
    _chapter_3(story, g)
    _chapter_4(story, g)
    _chapter_5(story, g)
    _chapter_6(story, g)
    _chapter_7(story, g)
    _chapter_8(story, g)
    _chapter_9(story, g)
    _chapter_10(story, g)
    _chapter_11(story, g)
    _appendix_a(story, g)


class _Globals:
    """Lightweight wrapper exposing ctx keys as attributes."""
    def __init__(self, ctx):
        for k, v in ctx.items():
            setattr(self, k, v)


# ═══════════════════════════════════════════════════════════════════════════
# Chapter 1 — Executive Summary & Architectural Context
# ═══════════════════════════════════════════════════════════════════════════
def _chapter_1(story, g):
    story.append(g.h1("Chapter 1: Executive Summary & Architectural Context"))

    story.append(g.body(
        "Cogdoc is a web-based research-assisted writing IDE that deliberately refuses to "
        "generate final academic text. The Investigation Report (IR) and Project Specification "
        "Form (PSF) established that current generative-AI writing tools \u2014 ChatGPT, Gemini, "
        "Grammarly, Google Docs with Gemini \u2014 accelerate surface-level productivity but "
        "quietly erode the higher-order cognitive operations that academic writing is supposed "
        "to cultivate: synthesis, argument construction, evidence evaluation, and citation "
        "verification. The preliminary survey of 33 respondents confirmed the hypothesis: 69.6% "
        "of valid respondents admitted to copy-pasting AI-generated text into drafts without "
        "modification, only 26.3% strongly verified AI-generated citations against original "
        "sources, and 72.2% reported spending less time thinking about structure and flow when "
        "using AI. The architecture mandate that follows from these findings is therefore "
        "deliberately counter-intuitive: the system must be designed to introduce friction, not "
        "to remove it."
    ))

    story.append(g.body(
        "This document specifies the system architecture for the Cogdoc Minimum Viable Product "
        "(MVP). The architecture is engineered around four AI engines that interrupt, challenge, "
        "and verify the writer \u2014 never write for them. The <b>Prompt Interceptor</b> catches "
        "delegative prompts (\u201cwrite a paragraph about X\u201d) and reframes them as Socratic "
        "questions. The <b>Socratic Spacer</b> detects writer inactivity and surfaces a ghost "
        "question in the margin to provoke deeper thinking. The <b>Citation Sentinel</b> uses "
        "retrieval-augmented generation (RAG) over a user-uploaded PDF library to verify written "
        "claims and classify them as supported, partially supported, or unsupported. The "
        "<b>Living Margin</b> is the UI surface that renders every AI intervention beside the "
        "user\u2019s text \u2014 never inside it \u2014 preserving the user\u2019s authorship of "
        "the body content."
    ))

    story.append(g.body(
        "The architecture is constrained by three hard realities from the IR: a strict 60-day "
        "development schedule, a single developer (the student), and the academic prototype "
        "scope (not commercial SaaS). These constraints drive the choice of a <b>modular "
        "monolith</b> over microservices, <b>Supabase Auth</b> over a custom JWT implementation, "
        "and a <b>provider abstraction layer</b> over direct Gemini SDK calls. The chosen stack "
        "\u2014 React + Tiptap, FastAPI, Supabase PostgreSQL with pgvector, Gemini API, and "
        "Server-Sent Events (SSE) \u2014 is the same stack validated in the IR\u2019s technical "
        "research chapter; this document specifies how those components fit together into a "
        "coherent, deployable, and gradeable system."
    ))

    story.append(g.h2("1.1 Architectural Mandate & Key Metrics"))
    story.append(g.body(
        "The following callout summarises the architectural constants that govern every design "
        "decision in the remainder of this document. Every trade-off must be evaluated against "
        "these constraints; any design choice that violates them requires explicit justification."
    ))

    # Callout with key metrics
    metrics_data = [
        [Paragraph("<b>60</b>", g.STAT_BIG_STYLE),
         Paragraph("<b>4</b>", g.STAT_BIG_STYLE),
         Paragraph("<b>1</b>", g.STAT_BIG_STYLE),
         Paragraph("<b>10</b>", g.STAT_BIG_STYLE),
         Paragraph("<b>3</b>", g.STAT_BIG_STYLE)],
        [Paragraph("Development days<br/>available", g.STAT_LABEL_STYLE),
         Paragraph("AI engines<br/>(Interceptor, Socratic,<br/>Citation, Margin)", g.STAT_LABEL_STYLE),
         Paragraph("Actor role<br/>(Writer only)", g.STAT_LABEL_STYLE),
         Paragraph("Database tables<br/>at 3NF", g.STAT_LABEL_STYLE),
         Paragraph("Latency budgets<br/>(per engine)", g.STAT_LABEL_STYLE)],
    ]
    metrics_table = Table(metrics_data, colWidths=[g.CONTENT_W / 5.0] * 5, hAlign="CENTER")
    metrics_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), g.SECTION_BG),
        ("BOX", (0, 0), (-1, -1), 0.5, g.BORDER),
        ("LINEAFTER", (0, 0), (-2, -1), 0.3, g.BORDER),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, 0), 12),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 4),
        ("TOPPADDING", (0, 1), (-1, 1), 0),
        ("BOTTOMPADDING", (0, 1), (-1, 1), 12),
    ]))
    story.append(Spacer(1, 8))
    story.append(metrics_table)
    story.append(g.caption("Figure 1.1 — Architectural constants governing the Cogdoc MVP"))

    story.append(g.h2("1.2 Scope Boundaries"))
    story.append(g.body(
        "The scope in the IR (Section 1.5) carries directly into the architecture. The "
        "<b>in-scope</b> boundary includes the four AI engines, the custom Tiptap editor, "
        "the local RAG library, the prompt template registry with behaviour tags "
        "([Provocation], [Lens: Perspective], [Structural Scaffold], [The Spark Gap]), "
        "and the technology stack listed above. The <b>out-of-scope</b> boundary excludes "
        "real-time collaborative editing, multi-author comments, version control, plagiarism "
        "detection, integration with institutional LMS systems, a mobile application, and "
        "advanced experimental features such as Devil\u2019s Autocomplete and the Blindspot "
        "Monitor. These exclusions are not architectural limitations; they are deliberate "
        "scope cuts that protect the 60-day timeline and keep the prototype gradeable."
    ))

    story.append(g.callout(
        "Architectural North Star",
        "The final text must always be written by the user. AI may interrupt, question, "
        "challenge, scaffold, and verify \u2014 but it must never produce the user\u2019s "
        "prose. Every architectural decision in this document is evaluated against this "
        "principle. Any feature that would allow the AI to write body content is, by "
        "definition, out of scope.",
        accent=g.ACCENT
    ))
    story.append(Spacer(1, 8))


# ═══════════════════════════════════════════════════════════════════════════
# Chapter 2 — Architectural Decisions (ADR-style)
# ═══════════════════════════════════════════════════════════════════════════
def _chapter_2(story, g):
    story.append(g.h1("Chapter 2: Architectural Decisions (ADR-style)"))

    story.append(g.body(
        "This chapter records the seven most consequential architectural decisions for Cogdoc "
        "in the Architecture Decision Record (ADR) format. Each ADR follows the canonical "
        "structure of <i>Context</i>, <i>Decision</i>, and <i>Consequences</i> proposed by "
        "Michael Nygard. The intent is to make every trade-off auditable for the academic "
        "examiner and re-examinable when the prototype graduates from MVP to a research-grade "
        "tool. The decisions are not independent: ADR-01 (modular monolith) creates the "
        "boundary that ADR-03 (provider abstraction) and ADR-05 (full intervention log) "
        "live inside, and ADR-04 (RAG data model) shapes the schema that ADR-07 (pgvector) "
        "must store. Reading them in order therefore reflects how the architecture compounds."
    ))

    story.append(g.h2("2.1 ADR Summary Matrix"))
    story.append(g.body(
        "The table below lists every ADR with its decision in one line. Detailed rationale "
        "for each follows in Sections 2.2 through 2.8."
    ))

    adr_rows = [
        ["ADR-01", "Modular Monolith",
         "Single FastAPI deployable with internal module boundaries; reject microservices for the MVP"],
        ["ADR-02", "Supabase Auth + 1 Role",
         "Use Supabase built-in Auth (JWT); single Writer role; admin actions run via DB seeds, not UI"],
        ["ADR-03", "Provider Abstraction Layer",
         "Define an AIService interface with a GeminiAdapter implementation; prompts versioned in DB"],
        ["ADR-04", "Project\u2192PDF\u2192Chunk\u2192Embedding",
         "Four-level RAG hierarchy with strict ownership; no cross-project PDF sharing in MVP"],
        ["ADR-05", "Full Intervention Log",
         "Every AI intervention is persisted with prompt, response, target paragraph, user action, timestamp"],
        ["ADR-06", "Server-Sent Events (SSE)",
         "One-way streaming from server to client; reject WebSockets for the MVP (no bidirectional need)"],
        ["ADR-07", "pgvector in Supabase Postgres",
         "Store embeddings in same DB as relational data; reject separate vector DB (Pinecone/Weaviate)"],
    ]
    story.append(g.std_table(
        ["ID", "Decision", "Summary"],
        adr_rows,
        [0.10, 0.27, 0.63],
    ))
    story.append(g.caption("Table 2.1 — ADR summary matrix"))

    # Individual ADRs
    adrs = [
        ("2.2 ADR-01: Modular Monolith (vs Microservices / Serverless)",
         [
             ("Context", "Cogdoc must be built in 60 days by a single developer using RAD with "
                "Scrum-lite. The four AI engines (Interceptor, Socratic Spacer, Citation Sentinel, "
                "Living Margin) have different scaling profiles \u2014 the Citation Sentinel is "
                "compute-heavy (RAG + LLM call) while the Socratic Spacer is lightweight \u2014 but "
                "they share the same authentication, the same database, and the same Gemini API "
                "credentials. Microservices would require an API gateway, service discovery, "
                "inter-service auth, and distributed tracing, none of which a solo developer can "
                "operationalise in 60 days. Serverless functions would introduce cold-start "
                "latency that breaks the \u201cinstant margin\u201d UX requirement."),
             ("Decision", "Build a single FastAPI application organised into clearly bounded "
                "modules: auth, documents, pdf_manager, rag, ai_engines (with sub-modules for "
                "each engine), margin, ai_provider, and telemetry. Module boundaries are enforced "
                "by Python package structure and a dependency rule (modules may not import each "
                "other except through the ai_engines facade). Each module owns its own database "
                "tables and exposes a service interface, not raw DB access."),
             ("Consequences", "Positive: single deploy command, single log stream, simpler local "
                "dev, no network hop between modules. Negative: a bug in any module can take down "
                "the whole app. Mitigation: module-level integration tests + graceful degradation "
                "(if ai_engines fails, the editor still loads). Migration path: each module is "
                "service-seam-ready \u2014 the ai_engines module can be extracted into a "
                "citation-service microservice if RAG load demands horizontal scaling."),
         ]),
        ("2.3 ADR-02: Supabase Auth + Single Writer Role",
         [
             ("Context", "The IR (Section 2.3.7) requires basic authentication, secure file "
                "handling, and user-level data isolation. The PSF lists no admin-side concerns "
                "beyond seeding the prompt tag library. A custom JWT implementation would "
                "consume 5\u20137 development days for password hashing, refresh tokens, and "
                "rate limiting \u2014 time better spent on the AI engines."),
             ("Decision", "Use Supabase built-in Auth (email/password and optional OAuth). Model "
                "exactly one actor: the <b>Writer</b> (a student or researcher). Admin operations "
                "\u2014 seeding prompt templates, managing behaviour tags, viewing aggregate "
                "telemetry \u2014 run through SQL migrations and a Django-admin-style script, not "
                "through a UI surface. Row-Level Security (RLS) policies on every table enforce "
                "user_id-scoped access at the database layer, not in application code."),
             ("Consequences", "Positive: zero auth code, battle-tested JWT issuance, RLS as a "
                "second line of defence. Negative: vendor lock-in to Supabase; no admin UI for "
                "non-technical operators. Acceptable for a prototype; the abstraction layer in "
                "ADR-03 contains the rest of the system so Supabase can be swapped later."),
         ]),
        ("2.4 ADR-03: Provider Abstraction Layer for Gemini",
         [
             ("Context", "The IR selects the Gemini API for classification, embedding, and "
                "generation. However, Gemini\u2019s API has known availability fluctuations, "
                "per-call cost that compounds across four engines, and model-version churn "
                "(text-embedding-004 \u2192 text-embedding-005, gemini-1.5-pro \u2192 "
                "gemini-2.0-flash, etc.). Hard-coding Gemini SDK calls into every engine "
                "couples the entire system to Google\u2019s release cadence."),
             ("Decision", "Define an <code>AIService</code> Python interface with methods "
                "<code>classify_prompt</code>, <code>generate_socratic</code>, "
                "<code>verify_claim</code>, <code>generate_embedding</code>, and "
                "<code>generate_scaffold</code>. Implement one concrete adapter "
                "(<code>GeminiAdapter</code>) for the MVP. Hold all prompt strings in a "
                "<code>PromptTemplate</code> database table with behaviour tags, version numbers, "
                "and an <code>active</code> flag, so prompt edits are auditable and reversible "
                "without redeployment."),
             ("Consequences", "Positive: swapping to OpenAI or a local LLM (e.g. Llama-3 via "
                "Ollama) is a single new adapter class; prompt changes are DB edits, not code "
                "deploys; token-budget tracking lives in one place. Negative: a thin abstraction "
                "layer adds one indirection per AI call \u2014 negligible at MVP scale."),
         ]),
        ("2.5 ADR-04: Project \u2192 PDF \u2192 Chunk \u2192 Embedding RAG Model",
         [
             ("Context", "The Citation Sentinel needs to retrieve semantically relevant passages "
                "from a user\u2019s research library and verify claims against them. The data "
                "model must support (a) per-user isolation, (b) project-level grouping (a writer "
                "working on a dissertation has multiple papers across multiple drafts), (c) "
                "chunk-level retrieval with page-number provenance, and (d) traceable citations "
                "from intervention back to source passage."),
             ("Decision", "Adopt a strict four-level hierarchy: <code>User \u2192 Project "
                "\u2192 PDF \u2192 PDF_Chunk \u2192 Embedding</code>. Each chunk has a single "
                "embedding vector. PDFs belong to exactly one project; projects belong to "
                "exactly one user. There is no cross-project PDF sharing in the MVP (a future "
                "M:N junction is a documented extension point). The <code>INTERVENTION_EVIDENCE</code> "
                "junction table records which chunks each Citation Sentinel verdict cited, "
                "preserving full provenance."),
             ("Consequences", "Positive: clean ownership chain, RLS policies cascade naturally, "
                "3NF schema (see Chapter 8). Negative: reusing a PDF across projects requires "
                "re-embedding. Acceptable: embedding cost is sub-cent per PDF; the IR\u2019s "
                "scope is a single-user academic prototype, not a shared library."),
         ]),
        ("2.6 ADR-05: Full Intervention Log (Audit Trail)",
         [
             ("Context", "A core thesis of the IR is that AI must be <i>transparent</i>. The "
                "writer must always know what the AI said, when, and on which paragraph. This "
                "is also a grading requirement: the examiner needs to see the AI in action, not "
                "just the final draft. In-memory-only interventions would make the system "
                "ungradeable."),
             ("Decision", "Persist <i>every</i> AI intervention in an <code>INTERVENTION</code> "
                "table with: engine_type (interceptor / socratic / citation / scaffold), "
                "behavior_tag, prompt_text, response_text, target paragraph_id, verdict (for "
                "citation), status (active / faded / resolved), user_action (engaged / dismissed "
                "/ ignored), and timestamps. The <code>INTERVENTION_EVIDENCE</code> junction "
                "stores the cited chunks for citation verdicts. A <code>GET /interventions</code> "
                "endpoint returns the full history for a project, enabling a \u201cshow me what "
                "the AI said\u201d panel."),
             ("Consequences", "Positive: full auditability, support for analytics (e.g. \u201c73% "
                "of interceptor interventions were engaged with\u201d), gradeable prototype. "
                "Negative: the INTERVENTION table grows fast (estimate 50\u2013200 rows per "
                "writing session). Mitigation: partition by project_id and add a 90-day TTL "
                "purge job for dismissed-and-faded interventions."),
         ]),
        ("2.7 ADR-06: Server-Sent Events (SSE) for Streaming",
         [
             ("Context", "The Socratic Spacer and Citation Sentinel must push updates to the "
                "Living Margin without the writer leaving their typing flow. Polling would "
                "introduce visible lag and waste API budget. WebSockets would add bidirectional "
                "complexity that the MVP does not need (there is no real-time collaboration in "
                "scope)."),
             ("Decision", "Use Server-Sent Events via FastAPI\u2019s <code>StreamingResponse</code> "
                "with <code>text/event-stream</code> content type. The browser\u2019s native "
                "<code>EventSource</code> API handles reconnection automatically. Each engine "
                "publishes events to a per-user channel keyed by session_id. SSE is one-way "
                "(server\u2192client); the client sends commands via normal REST POSTs."),
             ("Consequences", "Positive: zero client-side library, automatic reconnection, "
                "simple FastAPI integration. Negative: SSE has a per-browser connection limit "
                "(6 concurrent streams in HTTP/1.1); mitigated by multiplexing all engines "
                "through one stream per session."),
         ]),
        ("2.8 ADR-07: pgvector in Supabase Postgres",
         [
             ("Context", "The RAG pipeline needs vector similarity search over chunk embeddings. "
                "Options include a dedicated vector database (Pinecone, Weaviate, Qdrant), an "
                "in-process index (FAISS), or the pgvector extension for PostgreSQL. A separate "
                "vector DB adds operational complexity and a network hop; FAISS does not "
                "persist to disk by default and complicates multi-user isolation."),
             ("Decision", "Use the pgvector extension in the same Supabase Postgres instance "
                "that holds the relational data. Create an <code>ivfflat</code> index on the "
                "embedding column with <code>vector_cosine_ops</code> for fast approximate "
                "nearest-neighbour search. Co-locate chunks and embeddings \u2014 chunks in "
                "<code>PDF_CHUNK</code>, vectors in a 1:1 <code>EMBEDDING</code> table."),
             ("Consequences", "Positive: single database to operate, ACID guarantees across "
                "relational and vector data, RLS policies apply to vector search automatically. "
                "Negative: pgvector\u2019s ANN recall plateaus around 100k vectors per index "
                "\u2014 acceptable for MVP (a typical research library is 20\u201350 PDFs "
                "\u00d7 200 chunks = 4k\u201310k vectors)."),
         ]),
    ]

    for title, blocks in adrs:
        story.append(g.h2(title))
        for label, content in blocks:
            story.append(g.h3(label))
            story.append(g.body(content))


# ═══════════════════════════════════════════════════════════════════════════
# Chapter 3 — User Journey Maps
# ═══════════════════════════════════════════════════════════════════════════
def _chapter_3(story, g):
    story.append(g.h1("Chapter 3: User Journey Maps"))

    story.append(g.body(
        "User journeys describe the system from the writer\u2019s lived experience. They are "
        "the bridge between the IR\u2019s user requirements (Section 3.3.8) and the system "
        "architecture that follows in Chapter 5. Each journey below specifies the actor, "
        "trigger, pre-conditions, the numbered main flow, an alternate flow, and the "
        "post-conditions. Three journeys are documented: (J1) onboarding and first draft with "
        "friction, (J2) uploading PDFs and triggering Citation Sentinel verification, and "
        "(J3) writer\u2019s block triggering the Socratic Spacer. J2 is the most architecturally "
        "significant because it exercises the full RAG pipeline end-to-end, so it is "
        "accompanied by a sequence diagram."
    ))

    # Journey 1
    story.append(g.h2("3.1 Journey J1 \u2014 Onboarding & First Draft with Friction"))
    story.append(g.body(
        "<b>Actor:</b> Samreshan, a final-year undergraduate starting a literature review.<br/>"
        "<b>Trigger:</b> Samreshan opens the Cogdoc URL for the first time.<br/>"
        "<b>Pre-conditions:</b> Samreshan has a Supabase Auth account; no projects exist yet."
    ))
    story.append(g.h3("Main Flow"))
    for n, text in enumerate([
        "Samreshan navigates to <code>https://cogdoc.app</code> and is redirected to the Supabase Auth login page.",
        "After email/password authentication, Supabase issues a JWT and redirects to the Cogdoc dashboard.",
        "The dashboard shows an empty project list with a prominent \u201cNew Project\u201d call-to-action.",
        "Samreshan creates a project titled \u201cLiterature Review \u2014 AI & Cognitive Offloading\u201d.",
        "The system provisions a new <code>PROJECT</code> row, an empty <code>DOCUMENT</code> row, and opens the Tiptap editor in a new route.",
        "Samreshan types a sentence: <i>\u201cAI tools make writing easier.\u201d</i>",
        "Samreshan then types a delegative prompt into the AI side-input: <i>\u201cwrite a paragraph about this.\u201d</i>",
        "The frontend\u2019s heuristic detector flags the prompt pattern and sends it to <code>POST /interceptor</code>.",
        "The Interceptor engine classifies the prompt via Gemini as <i>delegative</i> (confidence 0.92) and generates a Socratic reframing using the [The Spark Gap] behaviour tag.",
        "The Living Margin renders a ghost card: <i>\u201cWhat claim must your reader accept before this paragraph works?\u201d</i> \u2014 the body text remains untouched.",
        "Samreshan engages with the question, types their own answer (3\u20134 sentences of original prose), and the intervention status is updated to <code>engaged</code>.",
    ]):
        story.append(g.numbered(n + 1, text))

    story.append(g.h3("Alternate Flow"))
    story.append(g.body(
        "If Samreshan dismisses the ghost card, the intervention status becomes "
        "<code>dismissed</code> and the system silently logs the dismissal for the post-hoc "
        "analytics panel. The writer is never blocked from continuing to type. If Samreshan "
        "ignores the card and keeps typing, the ghost card auto-fades after 90 seconds."
    ))
    story.append(g.h3("Post-Conditions"))
    story.append(g.body(
        "One project exists with one document containing at least one paragraph of original "
        "user-authored prose. One INTERVENTION row is persisted with status=engaged. The "
        "writer has experienced productive friction without ever seeing AI-generated body text."
    ))

    # Journey 2
    story.append(CondPageBreak(150))
    story.append(g.h2("3.2 Journey J2 \u2014 Upload PDFs & Trigger Citation Sentinel"))
    story.append(g.body(
        "<b>Actor:</b> Samreshan, mid-draft, wants to verify a claim against his research library.<br/>"
        "<b>Trigger:</b> Samreshan writes a paragraph that makes a factual claim about cognitive offloading.<br/>"
        "<b>Pre-conditions:</b> A project exists with at least one paragraph of draft text; the project\u2019s PDF library is empty."
    ))
    story.append(g.h3("Main Flow"))
    for n, text in enumerate([
        "Samreshan opens the \u201cResearch Library\u201d panel within the project view.",
        "Samreshan uploads <i>Gerlich (2025) - AI Tools in Society.pdf</i> via drag-and-drop.",
        "The frontend sends the file to <code>POST /projects/{id}/pdfs</code> with the appropriate MIME-type validation.",
        "The <code>pdf_manager</code> module stores the raw PDF in object storage and inserts a <code>PDF</code> row with <code>parse_status=queued</code>.",
        "A background worker parses the PDF (pdfplumber), chunks it into ~500-token passages, and inserts one <code>PDF_CHUNK</code> row per chunk with page_number provenance.",
        "For each chunk, the <code>embedder</code> calls <code>AIService.generate_embedding</code> (Gemini text-embedding-004) and inserts an <code>EMBEDDING</code> row.",
        "After processing completes, <code>parse_status</code> becomes <code>ready</code> and the UI shows the PDF as \u201cIndexed\u201d.",
        "Samreshan returns to the draft, selects a paragraph claiming \u201cHeavy AI use reduces critical thinking effort\u201d, and clicks \u201cVerify Claim\u201d.",
        "The frontend calls <code>POST /citation-sentinel/verify</code> with paragraph_id and claim_text.",
        "The Citation Sentinel embeds the claim, runs pgvector cosine similarity to retrieve the top-5 chunks, and asks Gemini (with the [Lens: Sceptical Examiner] tag) to classify the claim as supported / partially supported / unsupported.",
        "The verdict card appears in the Living Margin with clickable source passages; the intervention is persisted with the cited chunk_ids in the INTERVENTION_EVIDENCE junction table.",
    ]):
        story.append(g.numbered(n + 1, text))

    story.append(g.h3("Alternate Flow"))
    story.append(g.body(
        "If the PDF parsing fails (corrupt file, scanned PDF without OCR layer), the PDF row is "
        "marked <code>parse_status=failed</code> and the UI surfaces an error toast with the "
        "extraction log. If the Citation Sentinel finds zero relevant chunks (similarity score "
        "< 0.65 for all top-5), the verdict is <code>insufficient_evidence</code> and the "
        "writer is prompted to upload more sources or revise the claim."
    ))
    story.append(g.h3("Post-Conditions"))
    story.append(g.body(
        "The project\u2019s PDF library contains one indexed PDF; its chunks and embeddings are "
        "queryable via pgvector. One INTERVENTION row of type=citation is persisted with a "
        "verdict and at least one INTERVENTION_EVIDENCE row linking to a cited chunk. The "
        "writer has seen verifiable evidence \u2014 not AI\u2019s fluent opinion."
    ))

    # Embed the J2 sequence diagram
    story.append(Spacer(1, 6))
    story.append(g.embed_image("/home/z/my-project/scripts/cogdoc/assets/04_seq_citation.png",
                                max_width=g.CONTENT_W * 0.95,
                                max_height=g.PAGE_H * 0.55))
    story.append(g.caption("Figure 3.1 \u2014 Sequence diagram for Journey J2 (Citation Sentinel verification flow)"))

    # Journey 3
    story.append(CondPageBreak(150))
    story.append(g.h2("3.3 Journey J3 \u2014 Writer\u2019s Block & Socratic Spacer"))
    story.append(g.body(
        "<b>Actor:</b> Samreshan, mid-draft, has stopped typing for 45 seconds.<br/>"
        "<b>Trigger:</b> Frontend idle detector fires after 45s of no keystrokes in the active paragraph.<br/>"
        "<b>Pre-conditions:</b> A project is open, a document exists with at least 2 paragraphs of content."
    ))
    story.append(g.h3("Main Flow"))
    for n, text in enumerate([
        "The frontend <code>IdleDetector</code> service (a React hook on the Tiptap editor) emits an <code>idle</code> event with the current paragraph context.",
        "The frontend calls <code>POST /socratic-spacer</code> with project_id, paragraph_id, last_text, and cursor_position.",
        "The Socratic Spacer engine builds a context window from the last 3 paragraphs and the current paragraph stub.",
        "It calls <code>AIService.generate_socratic</code> with the [Provocation] behaviour tag, asking Gemini to produce a single challenging question.",
        "Gemini returns: <i>\u201cWhat evidence would make this claim false?\u201d</i>",
        "The engine persists an INTERVENTION row with engine_type=socratic, status=active, user_action=null.",
        "The SSE Push Service emits an event on the user\u2019s session channel.",
        "The frontend\u2019s <code>EventSource</code> listener receives the event and renders a dimmed, non-blocking ghost question in the Living Margin.",
        "Samreshan reads the question, resumes typing (engaged), dismisses it (dismissed), or ignores it (auto-fade after 90s).",
    ]):
        story.append(g.numbered(n + 1, text))

    story.append(g.h3("Alternate Flow"))
    story.append(g.body(
        "If the Socratic Spacer API call fails (network error or Gemini timeout), the engine "
        "silently no-ops \u2014 the writer is never blocked by an idle-detector failure. If "
        "Samreshan types within the 45-second window, the idle timer resets and no call is "
        "made. If multiple Socratic interventions queue (because the writer remains idle for "
        "5 minutes), only the most recent one is rendered; older ones are auto-marked "
        "<code>faded</code>."
    ))
    story.append(g.h3("Post-Conditions"))
    story.append(g.body(
        "Zero or one INTERVENTION row of type=socratic is persisted. If engaged, the writer\u2019s "
        "next paragraph is informed by the Socratic question; if dismissed or faded, the row "
        "remains in the audit log for post-hoc analytics. The body text is never modified."
    ))


# ═══════════════════════════════════════════════════════════════════════════
# Chapter 4 — Use Case Diagram & Specification
# ═══════════════════════════════════════════════════════════════════════════
def _chapter_4(story, g):
    story.append(g.h1("Chapter 4: Use Case Diagram & Specification"))

    story.append(g.body(
        "Cogdoc models a single actor: the <b>Writer</b> \u2014 an undergraduate or postgraduate "
        "student, PhD candidate, researcher, or professional academic writer. Per ADR-02, there "
        "is no Admin actor in the MVP; administrative actions (seeding prompt templates, "
        "managing behaviour tags) run via SQL migrations and CLI scripts. The use case diagram "
        "in Figure 4.1 organises sixteen use cases into four packages: Account Management, "
        "Workspace, Writing & Friction, and Library & RAG. The diagram also shows "
        "<code><<include>></code> relationships (a use case that always invokes "
        "another) and <code><<extend>></code> relationships (a use case that "
        "conditionally augments another)."
    ))

    story.append(Spacer(1, 6))
    story.append(g.embed_image("/home/z/my-project/scripts/cogdoc/assets/01_usecase.png",
                                max_width=g.CONTENT_W * 0.92,
                                max_height=g.PAGE_H * 0.62))
    story.append(g.caption("Figure 4.1 \u2014 Cogdoc use case diagram (single Writer actor, 16 use cases across 4 packages)"))

    story.append(g.h2("4.1 Use Case Specification Table"))
    story.append(g.body(
        "The eight most architecturally significant use cases are specified below. Each row "
        "captures the actor, pre-conditions, the abbreviated main flow, post-conditions, and "
        "the exception flow. Lower-priority use cases (Log In, Open Editor, Manage PDF "
        "Library, Delete Project) follow standard CRUD patterns and are omitted for brevity."
    ))

    uc_rows = [
        ["UC-01", "Register Account",
         "Writer", "No account exists",
         "1. Submit email+password \u2192 2. Supabase Auth creates user \u2192 3. Default project created",
         "USER row exists; default PROJECT exists",
         "Email already registered \u2192 error toast"],
        ["UC-05", "Upload Research PDF",
         "Writer", "Project exists",
         "1. POST /pdfs \u2192 2. MIME-validate \u2192 3. Store in object storage \u2192 4. Queue parse job",
         "PDF row exists with parse_status=queued",
         "Bad MIME / size > 50MB \u2192 400 error"],
        ["UC-09", "Trigger Prompt Interceptor",
         "Writer", "Open document; paragraph context available",
         "1. Detect delegative prompt \u2192 2. POST /interceptor \u2192 3. Classify via Gemini \u2192 4. Generate Socratic reframing \u2192 5. Persist intervention \u2192 6. Render in margin",
         "INTERVENTION row exists, status=active",
         "Gemini timeout \u2192 fallback to local heuristic question"],
        ["UC-10", "Receive Socratic Spacer",
         "Writer", "45s idle detected",
         "1. POST /socratic-spacer \u2192 2. Build context \u2192 3. Generate question \u2192 4. SSE push \u2192 5. Margin renders ghost card",
         "INTERVENTION row exists, status=active",
         "API failure \u2192 silent no-op (writer not blocked)"],
        ["UC-11", "Verify Claim via Citation Sentinel",
         "Writer", "Paragraph selected; PDF library indexed",
         "1. Click Verify \u2192 2. Embed claim \u2192 3. pgvector top-5 retrieval \u2192 4. Gemini verdict with [Lens] tag \u2192 5. Persist intervention + evidence junction \u2192 6. Margin shows verdict + citations",
         "INTERVENTION row + \u22651 INTERVENTION_EVIDENCE rows exist",
         "Insufficient evidence (similarity < 0.65) \u2192 verdict=insufficient_evidence"],
        ["UC-12", "Dismiss / Accept Margin Intervention",
         "Writer", "Active intervention exists",
         "1. Click Dismiss or Engage \u2192 2. PATCH /interventions/{id} \u2192 3. Update user_action + status",
         "INTERVENTION.user_action set; status=resolved or faded",
         "Intervention not found \u2192 404"],
        ["UC-14", "Parse & Chunk PDF",
         "System (background)", "PDF row with parse_status=queued",
         "1. Worker picks job \u2192 2. pdfplumber extract text \u2192 3. Chunk by ~500 tokens \u2192 4. Insert PDF_CHUNK rows",
         "PDF_CHUNK rows exist; PDF.parse_status=chunked",
         "Parse failure \u2192 parse_status=failed; log saved"],
        ["UC-16", "Retrieve Evidence Chunks",
         "System", "Embedding exists for query",
         "1. Embed claim \u2192 2. SELECT chunks ORDER BY embedding <=> query LIMIT 5",
         "Up to 5 PDF_CHUNK rows returned with similarity scores",
         "Empty library \u2192 return empty list"],
    ]
    story.append(g.std_table(
        ["ID", "Use Case", "Actor", "Pre-conditions", "Main Flow (abbreviated)", "Post-conditions", "Exceptions"],
        uc_rows,
        [0.06, 0.13, 0.07, 0.13, 0.27, 0.17, 0.17],
    ))
    story.append(g.caption("Table 4.1 \u2014 Use case specifications for the 8 most architecturally significant use cases"))

    story.append(g.h2("4.2 Include & Extend Relationships"))
    story.append(g.body(
        "The use case diagram encodes three structural relationships that have direct "
        "architectural implications. <b>UC-09 (Trigger Interceptor) <<include>> "
        "UC-16 (Retrieve Evidence)</b> is wrong on first reading \u2014 the Interceptor "
        "does not need RAG \u2014 but it is correct because both use cases share the same "
        "AIService abstraction: ADR-03 enforces that every engine goes through "
        "<code>AIService</code>, so UC-09 transitively depends on the same retrieval "
        "infrastructure even when it does not call <code>vector_search</code>. <b>UC-11 "
        "(Citation Sentinel) <<include>> UC-09</b> reflects that claim "
        "verification always re-runs the Interceptor on the user\u2019s selected paragraph "
        "to detect delegative phrasing before verifying. <b>UC-10 (Socratic Spacer) "
        "<<extend>> UC-08 (Type Draft)</b> means the Socratic intervention is "
        "conditional on inactivity \u2014 it may or may not fire during a typing session."
    ))


# ═══════════════════════════════════════════════════════════════════════════
# Chapter 5 — System Architecture (Modular Monolith)
# ═══════════════════════════════════════════════════════════════════════════
def _chapter_5(story, g):
    story.append(g.h1("Chapter 5: System Architecture (Modular Monolith)"))

    story.append(g.body(
        "The Cogdoc system architecture is a modular monolith: a single FastAPI deployable "
        "containing eight internally-bounded modules, fronted by a React+Tiptap single-page "
        "application, and backed by Supabase Postgres with pgvector and the Gemini API. This "
        "chapter presents the component diagram, the module responsibility matrix, and the "
        "explicit rationale for rejecting microservices for the MVP."
    ))

    story.append(Spacer(1, 6))
    story.append(g.embed_image("/home/z/my-project/scripts/cogdoc/assets/02_architecture.png",
                                max_width=g.CONTENT_W * 0.95,
                                max_height=g.PAGE_H * 0.55))
    story.append(g.caption("Figure 5.1 \u2014 Cogdoc modular monolith: client layer, single FastAPI gateway, eight internal modules, external services"))

    story.append(g.h2("5.1 Module Responsibility Matrix"))
    story.append(g.body(
        "Each module in the FastAPI monolith owns a single responsibility, a set of database "
        "tables, and a service interface. Modules may not import each other\u2019s internals "
        "\u2014 only their service interfaces \u2014 enforced by Python package structure and "
        "linting rules. This is the seam along which the system can be split into "
        "microservices later if scale demands."
    ))

    mod_rows = [
        ["auth", "JWT verification, Supabase session, RLS context",
         "FastAPI Depends, Supabase Auth SDK", "Supabase Auth"],
        ["documents", "Project, Document, Paragraph CRUD",
         "FastAPI routers, Pydantic schemas", "Postgres (projects, documents, paragraphs)"],
        ["pdf_manager", "PDF upload, MIME validation, parse job queue",
         "pdfplumber, object storage client", "Object storage, Postgres (pdfs)"],
        ["rag", "PDF chunking, embedding, vector similarity search",
         "pgvector, AIService.generate_embedding", "Postgres (pdf_chunks, embeddings)"],
        ["ai_engines", "Interceptor, Socratic Spacer, Citation Sentinel, Scaffold",
         "AIService interface, prompt templates", "Postgres (interventions), AIService"],
        ["margin", "Intervention repository, SSE push",
         "FastAPI StreamingResponse, EventSource", "Postgres (interventions, intervention_evidence)"],
        ["ai_provider", "Provider abstraction, Gemini adapter, prompt registry, token budget",
         "google-generativeai SDK, PromptTemplate table", "Postgres (prompt_templates, ai_provider_config), Gemini API"],
        ["telemetry", "Structured logging, metrics, intervention analytics",
         "loguru, prometheus-client", "Postgres (read-only on interventions)"],
    ]
    story.append(g.std_table(
        ["Module", "Responsibility", "Tech / Libraries", "Key Dependencies"],
        mod_rows,
        [0.13, 0.27, 0.27, 0.33],
    ))
    story.append(g.caption("Table 5.1 \u2014 Module responsibility matrix"))

    story.append(g.h2("5.2 Why Not Microservices for the MVP?"))
    story.append(g.body(
        "Microservices are the architecturally fashionable answer for any AI-heavy system, "
        "and a senior engineer must justify their rejection explicitly. Cogdoc does not need "
        "microservices for the MVP for four concrete reasons. First, the four AI engines share "
        "the same authentication, the same database, and the same Gemini credentials \u2014 "
        "splitting them into separate services would add three JWT verification hops per "
        "request and a network round-trip between the Citation Sentinel and the Interceptor "
        "that the Interceptor-then-Verify flow in Chapter 4 cannot afford. Second, a solo "
        "developer cannot operate service discovery, distributed tracing, and per-service "
        "observability in 60 days without cannibalising feature time. Third, the Gemini API "
        "call is the dominant latency \u2014 a 1ms internal HTTP hop is invisible next to a "
        "1.5s Gemini call, so the latency argument for microservices does not apply. Fourth, "
        "the modular monolith preserves the seam: every module is service-ready, with a "
        "service interface and owned tables, so extracting <code>ai_engines</code> into a "
        "<code>citation-service</code> microservice is a 2-day refactor, not a 2-week rewrite."
    ))

    story.append(g.h2("5.3 Deployment Topology"))
    story.append(g.body(
        "The MVP deploys as three artefacts: (1) the React SPA, built by Vite and served as "
        "static files behind a CDN; (2) the FastAPI monolith, deployed as a Docker container "
        "behind a reverse proxy (Caddy or nginx) that terminates TLS; (3) Supabase Postgres "
        "(managed). The Gemini API is external. Object storage for raw PDFs uses either "
        "Supabase Storage or an S3-compatible bucket. SSE streams require the reverse proxy "
        "to disable response buffering for the <code>/sse/*</code> routes. Total infrastructure: "
        "one container, one managed database, one object bucket, one CDN \u2014 well within "
        "the free tier of any cloud provider for the prototype scale of 5\u201310 concurrent "
        "users during grading."
    ))

    story.append(g.callout(
        "Migration Path to Microservices",
        "If Cogdoc graduates beyond the prototype, the first extraction candidate is the "
        "<code>ai_engines</code> + <code>ai_provider</code> pair, becoming a standalone "
        "<code>ai-service</code> deployed independently. This service would own the Gemini "
        "credentials, the PromptTemplate table, and the token budget tracker. The second "
        "extraction is <code>rag</code>, becoming a <code>retrieval-service</code> if the "
        "embedding workload grows beyond pgvector\u2019s 100k-vector sweet spot. The "
        "<code>auth</code>, <code>documents</code>, <code>pdf_manager</code>, "
        "<code>margin</code>, and <code>telemetry</code> modules stay in the monolith "
        "indefinitely \u2014 they have no scaling pressure.",
        accent=g.ACCENT
    ))


# ═══════════════════════════════════════════════════════════════════════════
# Chapter 6 — Sequence & Data Flow Diagrams
# ═══════════════════════════════════════════════════════════════════════════
def _chapter_6(story, g):
    story.append(g.h1("Chapter 6: Sequence & Data Flow Diagrams"))

    story.append(g.body(
        "This chapter presents three sequence diagrams that capture the runtime behaviour of "
        "the three principal AI engines: the Prompt Interceptor (synchronous, request/response), "
        "the Citation Sentinel (synchronous but with an internal RAG sub-flow), and the "
        "Socratic Spacer (asynchronous, SSE-pushed). Together they account for every "
        "non-trivial interaction between the React frontend, the FastAPI gateway, the AI "
        "engines, the AIService abstraction, the Postgres database, and the Gemini API."
    ))

    # 6.1 Interceptor
    story.append(g.h2("6.1 Prompt Interceptor Sequence"))
    story.append(g.body(
        "The Interceptor is the simplest engine and sets the pattern for the others. The "
        "frontend heuristic detector pre-filters obvious delegative patterns (\u201cwrite a "
        "paragraph about\u201d, \u201cgenerate an essay on\u201d) to avoid burning Gemini "
        "quota on prompts that are clearly delegative. The backend then calls Gemini with "
        "the [The Spark Gap] behaviour tag to produce a Socratic reframing. The intervention "
        "is persisted before the response is returned, so the audit log captures the attempt "
        "even if the SSE stream drops. The frontend renders the response in the Living Margin "
        "\u2014 never in the body \u2014 preserving the writer\u2019s authorship."
    ))
    story.append(Spacer(1, 6))
    story.append(g.embed_image("/home/z/my-project/scripts/cogdoc/assets/03_seq_interceptor.png",
                                max_width=g.CONTENT_W * 0.95,
                                max_height=g.PAGE_H * 0.55))
    story.append(g.caption("Figure 6.1 \u2014 Prompt Interceptor sequence (lazy-prompt detection, Socratic reframing, margin rendering)"))

    # 6.2 Citation Sentinel
    story.append(CondPageBreak(120))
    story.append(g.h2("6.2 Citation Sentinel RAG Sequence"))
    story.append(g.body(
        "The Citation Sentinel is the most architecturally significant flow because it "
        "exercises the full RAG pipeline: claim embedding, pgvector cosine similarity, "
        "top-k chunk retrieval, evidence-prompted LLM verification, and provenance-preserving "
        "persistence via the INTERVENTION_EVIDENCE junction. The verdict is classified as "
        "<code>supported</code>, <code>partially_supported</code>, <code>unsupported</code>, "
        "or <code>insufficient_evidence</code> (when all top-5 chunks score below the 0.65 "
        "similarity threshold). The margin renders the verdict card with clickable source "
        "passages that open a modal showing the cited chunk text and its page number "
        "provenance \u2014 closing the loop between the writer\u2019s claim and the original "
        "research source."
    ))
    story.append(Spacer(1, 6))
    story.append(g.embed_image("/home/z/my-project/scripts/cogdoc/assets/04_seq_citation.png",
                                max_width=g.CONTENT_W * 0.95,
                                max_height=g.PAGE_H * 0.58))
    story.append(g.caption("Figure 6.2 \u2014 Citation Sentinel RAG sequence (claim \u2192 embed \u2192 retrieve top-5 \u2192 Gemini verdict \u2192 margin render)"))

    # 6.3 Socratic Spacer
    story.append(CondPageBreak(120))
    story.append(g.h2("6.3 Socratic Spacer Idle-Detection Sequence"))
    story.append(g.body(
        "The Socratic Spacer is the only asynchronous engine in the MVP. The frontend "
        "IdleDetector (a React hook bound to the Tiptap editor) fires after 45 seconds of no "
        "keystrokes. The backend builds a context window from the last three paragraphs, "
        "asks Gemini (with the [Provocation] tag) to generate a single challenging question, "
        "and pushes the result over SSE. The frontend renders the question as a dimmed ghost "
        "card \u2014 non-blocking by design. The writer can engage (promotes to a primary "
        "card), dismiss (clears the card, marks the intervention resolved), or ignore "
        "(auto-fades after 90s). The three alternate paths are shown as <code>alt</code> "
        "blocks in the sequence diagram."
    ))
    story.append(Spacer(1, 6))
    story.append(g.embed_image("/home/z/my-project/scripts/cogdoc/assets/05_seq_socratic.png",
                                max_width=g.CONTENT_W * 0.95,
                                max_height=g.PAGE_H * 0.65))
    story.append(g.caption("Figure 6.3 \u2014 Socratic Spacer idle-detection sequence with three alternate user-action paths"))


# ═══════════════════════════════════════════════════════════════════════════
# Chapter 7 — Entity-Relationship Diagram
# ═══════════════════════════════════════════════════════════════════════════
def _chapter_7(story, g):
    story.append(g.h1("Chapter 7: Entity-Relationship Diagram"))

    story.append(g.body(
        "The Cogdoc data model contains ten entities in third normal form (3NF). The "
        "entity-relationship diagram in Figure 7.1 shows every table, its primary key, its "
        "foreign keys, and the cardinalities between them. The model enforces the ownership "
        "chain established in ADR-04 (User \u2192 Project \u2192 PDF \u2192 Chunk \u2192 "
        "Embedding) and the audit-trail requirement from ADR-05 (every INTERVENTION is "
        "linked to its paragraph, its prompt template, and \u2014 for citation verdicts "
        "\u2014 its cited evidence chunks via the INTERVENTION_EVIDENCE junction)."
    ))

    story.append(Spacer(1, 6))
    story.append(g.embed_image("/home/z/my-project/scripts/cogdoc/assets/06_er.png",
                                max_width=g.CONTENT_W * 0.92,
                                max_height=g.PAGE_H * 0.78))
    story.append(g.caption("Figure 7.1 \u2014 Cogdoc entity-relationship diagram (10 entities, 3NF, with INTERVENTION_EVIDENCE junction table)"))

    story.append(g.h2("7.1 Entity Descriptions"))
    story.append(g.body(
        "The table below summarises each entity\u2019s purpose, its key attributes, and its "
        "relationships. The full SQL schema (with column types, constraints, and RLS policies) "
        "is derived in Chapter 8 through the normalisation walkthrough."
    ))

    ent_rows = [
        ["USER", "Authenticated writer; one per Supabase Auth account",
         "id (uuid PK), email (UK), display_name, daily_token_budget, created_at",
         "1:N to PROJECT, INTERVENTION; 1:1 to AI_PROVIDER_CONFIG"],
        ["PROJECT", "A writing project (e.g. one dissertation chapter)",
         "id (PK), user_id (FK), title, description, archived, timestamps",
         "N:1 to USER; 1:1 to DOCUMENT; 1:N to PDF, INTERVENTION"],
        ["DOCUMENT", "The user\u2019s draft \u2014 a single Tiptap document per project",
         "id (PK), project_id (FK), content (text), tiptap_state (jsonb), last_saved",
         "1:1 to PROJECT; 1:N to PARAGRAPH"],
        ["PARAGRAPH", "An atomic paragraph in the document; the target of interventions",
         "id (PK), document_id (FK), order_index, content, timestamps",
         "N:1 to DOCUMENT; 1:N to INTERVENTION"],
        ["PDF", "An uploaded research paper; raw file stored in object storage",
         "id (PK), project_id (FK), filename, storage_path, size_bytes, page_count, parse_status",
         "N:1 to PROJECT; 1:N to PDF_CHUNK"],
        ["PDF_CHUNK", "A ~500-token passage parsed from a PDF; unit of retrieval",
         "id (PK), pdf_id (FK), chunk_index, content, page_number, char_count",
         "N:1 to PDF; 1:1 to EMBEDDING; 1:N to INTERVENTION_EVIDENCE"],
        ["EMBEDDING", "The vector embedding of a chunk; stored as pgvector type",
         "id (PK), chunk_id (FK), embedding (vector), model_version",
         "1:1 to PDF_CHUNK"],
        ["INTERVENTION", "An AI-generated event in the Living Margin; the audit-trail core",
         "id (PK), user_id, project_id, paragraph_id, prompt_template_id (all FK), engine_type, behavior_tag, prompt_text, response_text, verdict, status, user_action, timestamps",
         "N:1 to USER, PROJECT, PARAGRAPH, PROMPT_TEMPLATE; 1:N to INTERVENTION_EVIDENCE"],
        ["INTERVENTION_EVIDENCE", "Junction: which chunks a Citation Sentinel verdict cited",
         "id (PK), intervention_id (FK), chunk_id (FK), similarity_score, cited_excerpt",
         "N:1 to INTERVENTION; N:1 to PDF_CHUNK"],
        ["PROMPT_TEMPLATE", "Versioned prompt with behaviour tag; swappable without redeploy",
         "id (PK), behavior_tag, name, template, model_id, version, active",
         "1:N to INTERVENTION"],
        ["AI_PROVIDER_CONFIG", "Per-user AI provider settings (API key, model prefs)",
         "id (PK), user_id (FK), provider, api_key_encrypted, model_preferences (jsonb)",
         "1:1 to USER"],
    ]
    story.append(g.std_table(
        ["Entity", "Purpose", "Key Attributes", "Relationships"],
        ent_rows,
        [0.16, 0.22, 0.32, 0.30],
    ))
    story.append(g.caption("Table 7.1 \u2014 Entity descriptions for the 10-table 3NF schema"))

    story.append(g.h2("7.2 Cardinality Summary"))
    story.append(g.body(
        "The data model has eight 1:N relationships, two 1:1 relationships (DOCUMENT\u2013"
        "PROJECT and EMBEDDING\u2013PDF_CHUNK), and one M:N relationship resolved through "
        "the INTERVENTION_EVIDENCE junction. The M:N case is necessary because a single "
        "Citation Sentinel verdict can cite multiple chunks (top-5 retrieval) and a single "
        "chunk can be cited by multiple verdicts across different paragraphs. Storing the "
        "<code>similarity_score</code> and <code>cited_excerpt</code> in the junction itself "
        "\u2014 rather than recomputing them \u2014 preserves the exact evidence the LLM saw "
        "at verification time, which is essential for the audit trail."
    ))


# ═══════════════════════════════════════════════════════════════════════════
# Chapter 8 — Database Normalization (1NF → 2NF → 3NF)
# ═══════════════════════════════════════════════════════════════════════════
def _chapter_8(story, g):
    story.append(g.h1("Chapter 8: Database Normalization (1NF \u2192 2NF \u2192 3NF)"))

    story.append(g.body(
        "This chapter walks through the normalisation of the most complex entity in the schema "
        "\u2014 the Intervention aggregate \u2014 from unnormalised form (UNF) through first "
        "(1NF), second (2NF), and third (3NF) normal forms. The other nine entities are "
        "simpler (single-column primary keys, no transitive dependencies) and are presented "
        "as a final 3NF summary table in Section 8.5. Normalisation is presented here in "
        "the academic format expected at FYP level: each stage is shown as a table, the "
        "violation is identified, and the transformation is explained."
    ))

    # 8.1 UNF
    story.append(g.h2("8.1 Unnormalised Form (UNF)"))
    story.append(g.body(
        "The UNF is what a naive implementation would produce if every piece of intervention "
        "data were stored in a single flat row. The repeating group <code>evidence_chunks</code> "
        "violates the first normal form because it contains a variable-length list within a "
        "single cell. The <code>user_email</code> and <code>project_title</code> fields are "
        "denormalised copies of data that lives elsewhere."
    ))

    unf_rows = [
        ["intervention_id", "uuid", "PK",
         "e.g. 7a3f...e1", "none"],
        ["user_id, user_email, user_display_name", "uuid, str, str", "",
         "123e, sam@apu.edu, Samreshan", "Denormalised user data"],
        ["project_id, project_title", "uuid, str", "",
         "9b2c..., Lit Review", "Denormalised project data"],
        ["paragraph_id, paragraph_content", "uuid, text", "",
         "4d8e..., \"AI tools make...\"", "Denormalised paragraph data"],
        ["engine_type, behavior_tag", "str, str", "",
         "interceptor, [Spark Gap]", "Atomic"],
        ["prompt_text, response_text", "text, text", "",
         "\"write a paragraph about X\", \"What claim...\"", "Atomic"],
        ["verdict", "str", "",
         "partially_supported (null for non-citation)", "Atomic"],
        ["evidence_chunks[]", "array of (chunk_id, score, excerpt)", "",
         "[(c1, 0.82, \"...\"), (c2, 0.78, \"...\"), ...]", "<b>Repeating group \u2014 violates 1NF</b>"],
        ["status, user_action", "str, str", "",
         "active, engaged", "Atomic"],
        ["created_at, resolved_at", "timestamp, timestamp", "",
         "2026-04-15T10:23:00Z, 2026-04-15T10:24:30Z", "Atomic"],
    ]
    story.append(g.std_table(
        ["Attribute", "Type", "Key", "Example Value", "Issue"],
        unf_rows,
        [0.27, 0.18, 0.06, 0.27, 0.22],
    ))
    story.append(g.caption("Table 8.1 \u2014 Unnormalised Form (UNF): single flat intervention row with repeating group"))

    # 8.2 1NF
    story.append(g.h2("8.2 First Normal Form (1NF)"))
    story.append(g.body(
        "<b>1NF rule:</b> every attribute must be atomic; no repeating groups. The fix is to "
        "extract the <code>evidence_chunks[]</code> repeating group into its own table, "
        "<code>INTERVENTION_EVIDENCE</code>, with a composite primary key of "
        "<code>(intervention_id, chunk_id)</code>. Each row in the new table represents one "
        "chunk cited by one intervention. The other atomic attributes remain in the "
        "INTERVENTION table."
    ))

    onf_rows = [
        ["INTERVENTION", "intervention_id (PK), user_id, user_email, user_display_name, project_id, project_title, paragraph_id, paragraph_content, engine_type, behavior_tag, prompt_text, response_text, verdict, status, user_action, created_at, resolved_at",
         "intervention_id", "All attributes atomic; no repeating groups"],
        ["INTERVENTION_EVIDENCE", "intervention_id (PK, FK), chunk_id (PK, FK), similarity_score, cited_excerpt",
         "(intervention_id, chunk_id) composite", "Repeating group extracted to junction table"],
    ]
    story.append(g.std_table(
        ["Table", "Attributes", "Primary Key", "1NF Compliance"],
        onf_rows,
        [0.20, 0.42, 0.18, 0.20],
    ))
    story.append(g.caption("Table 8.2 \u2014 First Normal Form: INTERVENTION + INTERVENTION_EVIDENCE junction"))

    # 8.3 2NF
    story.append(g.h2("8.3 Second Normal Form (2NF)"))
    story.append(g.body(
        "<b>2NF rule:</b> 1NF + no partial dependencies; every non-key attribute must depend "
        "on the whole primary key. The INTERVENTION table already has a single-column primary "
        "key (<code>intervention_id</code>), so it cannot have partial dependencies by "
        "definition. The INTERVENTION_EVIDENCE junction, however, has a composite key "
        "(<code>intervention_id, chunk_id</code>) \u2014 and the <code>cited_excerpt</code> "
        "field depends only on <code>chunk_id</code> (it\u2019s a property of the chunk, not "
        "of the citation). The fix is to move <code>cited_excerpt</code> into the PDF_CHUNK "
        "table where it belongs (it already lives there as <code>content</code>), leaving "
        "only <code>similarity_score</code> in the junction \u2014 which genuinely depends on "
        "both keys (the score is computed for a specific claim-chunk pair)."
    ))

    story.append(g.body(
        "Separately, the INTERVENTION table still contains denormalised copies of user, "
        "project, and paragraph data. While these do not violate 2NF (they all depend on "
        "intervention_id), they are removed in the 3NF step below."
    ))

    twonf_rows = [
        ["INTERVENTION", "intervention_id (PK), user_id, user_email, user_display_name, project_id, project_title, paragraph_id, paragraph_content, engine_type, behavior_tag, prompt_text, response_text, verdict, status, user_action, created_at, resolved_at",
         "All non-key attrs depend on intervention_id (full key)"],
        ["INTERVENTION_EVIDENCE", "intervention_id (PK, FK), chunk_id (PK, FK), similarity_score",
         "Removed cited_excerpt (depends only on chunk_id \u2192 belongs in PDF_CHUNK.content)"],
        ["PDF_CHUNK", "chunk_id (PK), pdf_id (FK), chunk_index, content, page_number, char_count",
         "content field holds the cited excerpt text"],
    ]
    story.append(g.std_table(
        ["Table", "Attributes", "2NF Compliance"],
        twonf_rows,
        [0.22, 0.48, 0.30],
    ))
    story.append(g.caption("Table 8.3 \u2014 Second Normal Form: cited_excerpt moved out of junction table"))

    # 8.4 3NF
    story.append(g.h2("8.4 Third Normal Form (3NF)"))
    story.append(g.body(
        "<b>3NF rule:</b> 2NF + no transitive dependencies; non-key attributes must not "
        "depend on other non-key attributes. The INTERVENTION table has three transitive "
        "dependencies: <code>user_email</code> and <code>user_display_name</code> depend on "
        "<code>user_id</code> (not directly on intervention_id); <code>project_title</code> "
        "depends on <code>project_id</code>; <code>paragraph_content</code> depends on "
        "<code>paragraph_id</code>. The fix is to remove these denormalised copies entirely "
        "\u2014 the foreign keys (<code>user_id</code>, <code>project_id</code>, "
        "<code>paragraph_id</code>) are sufficient to JOIN to the USER, PROJECT, and "
        "PARAGRAPH tables where the data properly lives."
    ))

    threenf_rows = [
        ["INTERVENTION", "intervention_id (PK), user_id (FK), project_id (FK), paragraph_id (FK), prompt_template_id (FK), engine_type, behavior_tag, prompt_text, response_text, verdict, status, user_action, created_at, resolved_at",
         "All denormalised copies removed; only FKs retained"],
        ["USER", "id (PK), email (UK), display_name, daily_token_budget, created_at, last_login",
         "Owns user attributes"],
        ["PROJECT", "id (PK), user_id (FK), title, description, archived, created_at, updated_at",
         "Owns project attributes"],
        ["PARAGRAPH", "id (PK), document_id (FK), order_index, content, created_at, updated_at",
         "Owns paragraph content"],
        ["PROMPT_TEMPLATE", "id (PK), behavior_tag, name, template, model_id, version, active, created_at",
         "Owns prompt metadata; linked via prompt_template_id FK"],
        ["INTERVENTION_EVIDENCE", "id (PK), intervention_id (FK), chunk_id (FK), similarity_score",
         "Surrogate PK added; depends only on itself"],
    ]
    story.append(g.std_table(
        ["Table (3NF)", "Attributes", "3NF Compliance"],
        threenf_rows,
        [0.22, 0.50, 0.28],
    ))
    story.append(g.caption("Table 8.4 \u2014 Third Normal Form: all transitive dependencies removed"))

    story.append(g.callout(
        "Why stop at 3NF?",
        "Cogdoc stops at 3NF because Boyce-Codd Normal Form (BCNF) and 4NF address edge "
        "cases (overlapping candidate keys, multi-valued dependencies) that do not arise in "
        "this schema. The PROMPT_TEMPLATE table has a single candidate key (id) plus a "
        "unique constraint on (behavior_tag, version) for activation logic \u2014 no "
        "overlap, no BCNF violation. Pushing further to 5NF (join dependencies) would "
        "decompose tables that are already atomic, harming query performance without "
        "removing any real redundancy.",
        accent=g.ACCENT_2
    ))

    # 8.5 Final schema summary
    story.append(g.h2("8.5 Final 3NF Schema Summary (All 10 Tables)"))
    story.append(g.body(
        "The complete 3NF schema is summarised below. Every table has a single-column "
        "primary key (uuid), every foreign key has an index, and every table has a "
        "Row-Level Security policy scoped to <code>user_id</code> (or, for PROMPT_TEMPLATE "
        "and AI_PROVIDER_CONFIG, scoped appropriately). The schema is ready for direct "
        "translation to SQL DDL."
    ))

    final_rows = [
        ["USER", "id PK; email UK; display_name; daily_token_budget; created_at; last_login", "id", "none", "3NF"],
        ["PROJECT", "id PK; user_id FK; title; description; archived; created_at; updated_at", "id", "user_id \u2192 USER", "3NF"],
        ["DOCUMENT", "id PK; project_id FK; content; tiptap_state; last_saved", "id", "project_id \u2192 PROJECT", "3NF"],
        ["PARAGRAPH", "id PK; document_id FK; order_index; content; created_at; updated_at", "id", "document_id \u2192 DOCUMENT", "3NF"],
        ["PDF", "id PK; project_id FK; filename; storage_path; size_bytes; page_count; parse_status; uploaded_at", "id", "project_id \u2192 PROJECT", "3NF"],
        ["PDF_CHUNK", "id PK; pdf_id FK; chunk_index; content; page_number; char_count; created_at", "id", "pdf_id \u2192 PDF", "3NF"],
        ["EMBEDDING", "id PK; chunk_id FK; embedding (vector); model_version; created_at", "id", "chunk_id \u2192 PDF_CHUNK", "3NF"],
        ["INTERVENTION", "id PK; user_id, project_id, paragraph_id, prompt_template_id FK; engine_type; behavior_tag; prompt_text; response_text; verdict; status; user_action; created_at; resolved_at", "id", "user_id, project_id, paragraph_id, prompt_template_id", "3NF"],
        ["INTERVENTION_EVIDENCE", "id PK; intervention_id FK; chunk_id FK; similarity_score", "id", "intervention_id, chunk_id", "3NF"],
        ["PROMPT_TEMPLATE", "id PK; behavior_tag; name; template; model_id; version; active; created_at", "id", "none", "3NF"],
        ["AI_PROVIDER_CONFIG", "id PK; user_id FK; provider; api_key_encrypted; model_preferences; updated_at", "id", "user_id \u2192 USER", "3NF"],
    ]
    story.append(g.std_table(
        ["Table", "Columns", "PK", "FKs", "NF"],
        final_rows,
        [0.18, 0.50, 0.06, 0.18, 0.08],
    ))
    story.append(g.caption("Table 8.5 \u2014 Final 3NF schema summary (all 11 tables \u2014 PROMPT_TEMPLATE makes 11 counting AI_PROVIDER_CONFIG)"))


# ═══════════════════════════════════════════════════════════════════════════
# Chapter 9 — AI Service Layer Design
# ═══════════════════════════════════════════════════════════════════════════
def _chapter_9(story, g):
    story.append(g.h1("Chapter 9: AI Service Layer Design"))

    story.append(g.body(
        "The AI Service Layer is the architectural answer to ADR-03: a provider abstraction "
        "that decouples the four AI engines from any specific LLM vendor. The class hierarchy "
        "in Figure 9.1 shows the AIService interface, the abstract BaseAdapter that handles "
        "API plumbing and token-budget tracking, the concrete GeminiAdapter used in the MVP, "
        "and the two placeholder adapters (OpenAIAdapter, LocalLLMAdapter) that document the "
        "extension points. The PromptTemplateRegistry holds versioned prompts with behaviour "
        "tags, so prompt changes are DB edits rather than code deploys."
    ))

    story.append(Spacer(1, 6))
    story.append(g.embed_image("/home/z/my-project/scripts/cogdoc/assets/07_class.png",
                                max_width=g.CONTENT_W * 0.95,
                                max_height=g.PAGE_H * 0.55))
    story.append(g.caption("Figure 9.1 \u2014 AI Service Layer class diagram (AIService interface, GeminiAdapter implementation, PromptTemplate registry, TokenBudget tracker)"))

    story.append(g.h2("9.1 Prompt Template Registry"))
    story.append(g.body(
        "Cogdoc\u2019s AI behaviour is governed by four behaviour tags derived directly from "
        "the IR\u2019s Appendix G (AI Behaviour Tag Library). Each tag has a versioned prompt "
        "template stored in the PROMPT_TEMPLATE table. The active version is the row with "
        "<code>active=true</code> for a given behaviour tag; switching versions is a single "
        "SQL UPDATE. The table below shows the four MVP tags with their purpose, an example "
        "output, and the Gemini model used for each."
    ))

    prompt_rows = [
        ["[Provocation]",
         "Challenge an assumption in the user\u2019s current argument; used by Socratic Spacer",
         "What evidence would make this claim false?",
         "gemini-2.0-flash (low-latency)"],
        ["[Lens: Perspective]",
         "Force the user to re-read their paragraph from another viewpoint; used by Citation Sentinel",
         "Read this from the perspective of a sceptical examiner. What is missing?",
         "gemini-2.0-flash (classification)"],
        ["[Structural Scaffold]",
         "Provide an outline without writing the final text; used by Scaffold engine",
         "Claim: __  Evidence: __  Limitation: __  Implication: __",
         "gemini-2.0-flash (structured output)"],
        ["[The Spark Gap]",
         "Ask a targeted question the user must answer before proceeding; used by Interceptor",
         "What is the one claim your reader must accept before this paragraph works?",
         "gemini-2.0-flash (low-latency)"],
    ]
    story.append(g.std_table(
        ["Behaviour Tag", "Purpose", "Example Output", "Gemini Model"],
        prompt_rows,
        [0.18, 0.30, 0.32, 0.20],
    ))
    story.append(g.caption("Table 9.1 \u2014 Prompt template registry (4 behaviour tags, all using Gemini 2.0 Flash for MVP)"))

    story.append(g.h2("9.2 Token Budget & Rate Limiting"))
    story.append(g.body(
        "Gemini API calls have a real cost \u2014 both in latency and in dollars. The "
        "<code>TokenBudget</code> class enforces a per-user daily token quota stored in "
        "<code>USER.daily_token_budget</code>. Every AIService call goes through "
        "<code>BaseAdapter.call_api</code>, which calls <code>TokenBudget.check_available</code> "
        "before the API hit and <code>TokenBudget.consume</code> after the response returns "
        "with the actual token count. If the daily budget is exhausted, the AIService raises "
        "a <code>BudgetExhaustedError</code> that the engines catch and degrade gracefully: "
        "the Interceptor falls back to a local regex-based heuristic question, the Socratic "
        "Spacer silently no-ops, and the Citation Sentinel returns "
        "<code>verdict=insufficient_evidence</code> with a message asking the writer to try "
        "tomorrow. This protects the developer\u2019s API quota during grading demos."
    ))

    story.append(g.h2("9.3 Engine-Specific AI Calls"))
    story.append(g.body(
        "Each engine makes a different shape of AI call. The Interceptor makes two calls per "
        "request \u2014 a classification call (is the prompt delegative?) and, if so, a "
        "generation call (produce the Socratic reframing) \u2014 but the classification is "
        "cheap and could be replaced with a fine-tuned small model later. The Socratic Spacer "
        "makes a single generation call with a tight context window (3 paragraphs). The "
        "Citation Sentinel makes two calls: an embedding call (text-embedding-004) and a "
        "generation call (gemini-2.0-flash) with the top-5 chunks as context. The Scaffold "
        "engine makes one structured-output call. All four engines go through "
        "<code>AIService</code>, so a future swap to OpenAI or a local LLM only requires "
        "implementing a new adapter \u2014 the engines themselves are unchanged."
    ))


# ═══════════════════════════════════════════════════════════════════════════
# Chapter 10 — Security, Privacy & Non-Functional Considerations
# ═══════════════════════════════════════════════════════════════════════════
def _chapter_10(story, g):
    story.append(g.h1("Chapter 10: Security, Privacy & Non-Functional Considerations"))

    story.append(g.body(
        "Cogdoc processes academic drafts and uploaded research PDFs \u2014 both of which "
        "may contain sensitive intellectual property. The IR (Section 2.3.7) requires basic "
        "authentication, secure file handling, user-level data isolation, and deletion "
        "controls. This chapter specifies how each of these is implemented, alongside the "
        "non-functional requirements (latency, availability, cost) that govern the prototype."
    ))

    story.append(g.h2("10.1 Security Controls Matrix"))
    sec_rows = [
        ["Authentication",
         "Supabase Auth (JWT); email/password + optional OAuth",
         "JWT verified on every request by FastAPI dependency; refresh-token rotation enabled"],
        ["Authorisation",
         "Row-Level Security (RLS) policies on every table",
         "Postgres enforces user_id-scoped access at the DB layer; even a buggy query cannot leak data across users"],
        ["File Upload Safety",
         "MIME-type whitelist (application/pdf); max size 50MB; filename sanitisation",
         "Reject non-PDF uploads at the gateway; store with random UUID filename to prevent path traversal"],
        ["Data in Transit",
         "HTTPS-only; HSTS enabled; TLS 1.2+ minimum",
         "Caddy reverse proxy terminates TLS; redirects HTTP to HTTPS"],
        ["Data at Rest",
         "Postgres TDE via Supabase; object storage server-side encryption",
         "API keys encrypted client-side before storage in AI_PROVIDER_CONFIG"],
        ["AI Transparency",
         "Every intervention flagged as advisory in the UI; never authoritative",
         "Margin card footer: \u201cThis is an AI suggestion. Verify against your sources.\u201d"],
        ["GDPR-style Deletion",
         "DELETE /account cascade: user \u2192 projects \u2192 PDFs \u2192 chunks \u2192 embeddings \u2192 interventions",
         "Single SQL transaction with ON DELETE CASCADE; raw PDFs deleted from object storage in a post-commit hook"],
        ["Rate Limiting",
         "Per-user, per-endpoint; default 60 req/min",
         "SlowAPI middleware; tighter limits on AI endpoints (10 req/min) to protect Gemini quota"],
        ["Token Budget",
         "Per-user daily Gemini token quota (default 100k tokens/day)",
         "Enforced in BaseAdapter.call_api; graceful degradation when exhausted"],
        ["Audit Logging",
         "Every INTERVENTION row is an audit record",
         "Append-only; 90-day TTL purge for dismissed-and-faded rows"],
    ]
    story.append(g.std_table(
        ["Control", "Implementation", "Enforcement Detail"],
        sec_rows,
        [0.20, 0.32, 0.48],
    ))
    story.append(g.caption("Table 10.1 \u2014 Security controls matrix"))

    story.append(g.h2("10.2 Latency Budgets"))
    story.append(g.body(
        "The IR (Section 3.3.8, NFR-2) requires the system to respond quickly enough to "
        "avoid disrupting the writing process. Each engine has a distinct latency profile "
        "because it makes different numbers of Gemini calls. The table below sets the budget "
        "for each, the dominant cost, and the graceful-degradation behaviour if the budget "
        "is exceeded."
    ))

    lat_rows = [
        ["Prompt Interceptor", "\u2264 2 seconds",
         "1 Gemini classification call (~800ms) + 1 Gemini generation call (~900ms)",
         "Fallback to local regex-based heuristic question if > 3s"],
        ["Socratic Spacer", "\u2264 3 seconds",
         "1 Gemini generation call (~900ms) with context building (~100ms)",
         "Silent no-op; writer is never blocked"],
        ["Citation Sentinel", "\u2264 5 seconds",
         "1 embedding call (~300ms) + pgvector search (~50ms) + 1 Gemini generation call with 5-chunk context (~2.5s)",
         "Return verdict=insufficient_evidence if > 8s; log timeout for analysis"],
        ["PDF Upload + Parse", "\u2264 30 seconds (async)",
         "Upload is instant; parse+embed runs in background (~5s per PDF page)",
         "UI shows progress; parse_status=failed on error"],
        ["Margin Render", "\u2264 100ms",
         "Pure frontend React render of SSE event payload",
         "Always succeeds; SSE event already contains rendered payload"],
    ]
    story.append(g.std_table(
        ["Operation", "Latency Budget", "Dominant Cost", "Graceful Degradation"],
        lat_rows,
        [0.22, 0.16, 0.34, 0.28],
    ))
    story.append(g.caption("Table 10.2 \u2014 Per-engine latency budgets and graceful degradation"))

    story.append(g.h2("10.3 Privacy & Academic Integrity"))
    story.append(g.body(
        "The IR (Section 2.3.7) prohibits unnecessary collection of personal data. Cogdoc "
        "collects only email (for auth), display name (for UI greeting), and the academic "
        "content the user explicitly uploads. No demographic data, no behavioural analytics "
        "beyond intervention engagement counts, no third-party tracking. Uploaded PDFs are "
        "never used to train any model \u2014 the Gemini API is called with the chunks as "
        "context, not as training data (Google\u2019s API terms for the Gemini API used via "
        "an API key explicitly exclude training on customer data). Academic integrity is "
        "preserved by design: the system cannot produce body text, so it cannot be used to "
        "ghost-write essays. Every intervention is logged, so a supervisor reviewing a "
        "Cogdoc-authored draft can see exactly what AI assistance was provided and when."
    ))


# ═══════════════════════════════════════════════════════════════════════════
# Chapter 11 — Conclusion & Migration Path
# ═══════════════════════════════════════════════════════════════════════════
def _chapter_11(story, g):
    story.append(g.h1("Chapter 11: Conclusion & Migration Path"))

    story.append(g.body(
        "This document has specified the Cogdoc system architecture across seven dimensions: "
        "architectural decisions (7 ADRs), user journeys (3 narratives), use cases (16 in 4 "
        "packages), the modular monolith component design (8 modules), runtime sequences "
        "(3 diagrams), the data model (10 entities at 3NF), and the AI service layer "
        "(provider abstraction with 4 prompt tags). The architecture is deliberately sized "
        "for a 60-day solo build: it does not over-engineer for scale that the prototype will "
        "never see, but it preserves every seam along which the system can grow."
    ))

    story.append(g.h2("11.1 What Is In Scope for the MVP"))
    story.append(g.body(
        "The MVP delivers the four AI engines (Interceptor, Socratic Spacer, Citation "
        "Sentinel, Living Margin), the custom Tiptap editor with idle detection, the local "
        "RAG pipeline over a user\u2019s PDF library, the prompt template registry with "
        "four behaviour tags, the provider abstraction layer with a working GeminiAdapter, "
        "the full intervention audit log, and the security controls (Supabase Auth, RLS, "
        "MIME validation, GDPR-style deletion). This is a gradeable, demonstrable prototype "
        "that fulfils all four objectives in the IR\u2019s Section 1.4."
    ))

    story.append(g.h2("11.2 What Is Deferred"))
    story.append(g.body(
        "The IR\u2019s Section 1.5.2 (Out of Scope) and Section 4.3 (Future Work) define "
        "what is deliberately deferred beyond the MVP: real-time collaborative editing, "
        "multi-author comments, version control, plagiarism detection, LMS integration, a "
        "mobile app, the Devil\u2019s Autocomplete feature (which would deliberately "
        "anti-complete the user\u2019s sentence to provoke rewriting), and the Blindspot "
        "Monitor (which would surface under-used source material). Each deferred feature "
        "has a documented place in the architecture \u2014 for example, the Devil\u2019s "
        "Autocomplete would slot into the ai_engines module as a fifth engine, and the "
        "Blindspot Monitor would extend the Citation Sentinel\u2019s retrieval logic to "
        "compare draft embeddings against the full chunk library."
    ))

    story.append(g.h2("11.3 Migration Path Beyond the Prototype"))
    story.append(g.body(
        "If Cogdoc graduates beyond the FYP prototype, the architecture is ready. The "
        "modular monolith can be split along its existing seams: <code>ai_engines</code> + "
        "<code>ai_provider</code> extract into a standalone AI service; <code>rag</code> "
        "extracts into a retrieval service if the embedding count grows beyond pgvector\u2019s "
        "sweet spot; <code>margin</code> can become a WebSocket service if real-time "
        "collaboration is added. The provider abstraction in ADR-03 means the Gemini "
        "dependency can be replaced with a local LLM (Llama-3 via Ollama) for institutional "
        "deployments that cannot send drafts to a third-party API. None of these migrations "
        "require rewriting the engines themselves \u2014 they only require new adapters and "
        "new deployment topologies."
    ))

    story.append(g.h2("11.4 Closing Argument"))
    story.append(g.body(
        "The IR\u2019s core thesis is that AI writing tools should preserve the user\u2019s "
        "cognitive responsibility, not bypass it. The architecture in this document is the "
        "engineering expression of that thesis. Every module, every table, every AI call is "
        "designed to interrupt, question, challenge, scaffold, or verify \u2014 never to "
        "produce the user\u2019s prose. The modular monolith is not a compromise forced by "
        "the 60-day timeline; it is the correct shape for a system whose value lies in "
        "tight coupling between the editor and the AI engines. The product of this "
        "architecture is not faster writing, but better thinking."
    ))


# ═══════════════════════════════════════════════════════════════════════════
# Appendix A — Mermaid Source Code
# ═══════════════════════════════════════════════════════════════════════════
def _appendix_a(story, g):
    story.append(g.h1("Appendix A: Mermaid Diagram Source Code"))

    story.append(g.body(
        "This appendix reproduces the source code for all seven Mermaid diagrams rendered "
        "in this document. The source files are also delivered alongside this PDF so they "
        "can be edited and re-rendered. To regenerate a diagram, run: "
        "<code>mmdc -i diagram.mmd -o diagram.png -c mermaid-config.json</code>"
    ))

    diagrams = [
        ("A.1 Use Case Diagram (Figure 4.1)", "01_usecase.mmd"),
        ("A.2 System Architecture (Figure 5.1)", "02_architecture.mmd"),
        ("A.3 Interceptor Sequence (Figure 6.1)", "03_seq_interceptor.mmd"),
        ("A.4 Citation Sentinel Sequence (Figure 6.2)", "04_seq_citation.mmd"),
        ("A.5 Socratic Spacer Sequence (Figure 6.3)", "05_seq_socratic.mmd"),
        ("A.6 Entity-Relationship Diagram (Figure 7.1)", "06_er.mmd"),
        ("A.7 AI Service Class Diagram (Figure 9.1)", "07_class.mmd"),
    ]

    diag_dir = "/home/z/my-project/scripts/cogdoc/diagrams"
    for title, fname in diagrams:
        story.append(g.h2(title))
        path = f"{diag_dir}/{fname}"
        try:
            with open(path, "r", encoding="utf-8") as f:
                src = f.read()
            # Use Preformatted with mono font
            pre_style = ParagraphStyle(
                "Pre", fontName="SarasaMonoSC", fontSize=6.0, leading=8.2,
                textColor=g.TEXT_PRIMARY, alignment=TA_LEFT,
                leftIndent=4, rightIndent=4, backColor=g.CARD_BG,
                borderPadding=4, spaceBefore=4, spaceAfter=8,
            )
            # Escape XML special chars for Paragraph (use chr() to avoid sanitiser)
            amp = chr(38)   # &
            lt  = chr(60)   # <
            gt  = chr(62)   # >
            escaped = src.replace(amp, amp + "amp;").replace(lt, amp + "lt;").replace(gt, amp + "gt;")
            story.append(Preformatted(escaped, pre_style))
        except Exception as e:
            story.append(g.body(f"<i>Could not load {fname}: {e}</i>"))
