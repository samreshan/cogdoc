# Cogdoc — Product Specification

> **Cogdoc: A Research-Assisted IDE to Mitigate Cognitive Atrophy in the Age of Generative Artificial Intelligence.**
> Product, architecture, and delivery specification for the Final Year Project.
>
> Author: **Samreshan Sahani** (NP069749, NPT3F2509IT) — BSc (Hons) IT, Asia Pacific University of Technology & Innovation. Supervisor: Mr. Ishwor Thapa.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem & Evidence Base](#2-problem--evidence-base)
3. [Vision, Goals & Non-Goals](#3-vision-goals--non-goals)
4. [Design Principles & Friction Philosophy](#4-design-principles--friction-philosophy)
5. [Personas & Primary Use Cases](#5-personas--primary-use-cases)
6. [Feature Specification — Core Engines](#6-feature-specification--core-engines)
   - 6.1 [Interceptor](#61-interceptor)
   - 6.2 [Socratic Spacer](#62-socratic-spacer)
   - 6.3 [Citation Sentinel](#63-citation-sentinel)
   - 6.4 [Living Margin & Structural Scaffold](#64-living-margin--structural-scaffold)
7. [Feature Specification — Deferred / Experimental Engines](#7-feature-specification--deferred--experimental-engines)
   - 7.1 [Devil's Autocomplete](#71-devils-autocomplete)
   - 7.2 [Blindspot Monitor](#72-blindspot-monitor)
8. [Feature Specification — Supporting Systems](#8-feature-specification--supporting-systems)
9. [Friction Calibration (Research Contribution)](#9-friction-calibration-research-contribution)
10. [System Architecture](#10-system-architecture)
11. [Data Model](#11-data-model)
12. [API Contracts](#12-api-contracts)
13. [Behaviour Tag Library](#13-behaviour-tag-library)
14. [Evaluation & Research Methodology](#14-evaluation--research-methodology)
15. [Test Strategy & Test Cases](#15-test-strategy--test-cases)
16. [Non-Functional Requirements](#16-non-functional-requirements)
17. [Security & Privacy](#17-security--privacy)
18. [Two-Week Delivery Roadmap](#18-two-week-delivery-roadmap)
19. [Risk Register](#19-risk-register)
20. [SDG Alignment](#20-sdg-alignment)
21. [Glossary](#21-glossary)
22. [Document Control](#22-document-control)

---

## 1. Executive Summary

Cogdoc is a web-based, research-assisted writing IDE that deliberately **refuses to generate final academic text**. Instead of ghostwriting, the AI acts as a **Socratic challenger in the margin**: it intercepts delegative prompts, poses contextual questions during writer's block, and verifies the user's claims against their own uploaded research PDFs.

The problem Cogdoc addresses is **cognitive atrophy**: the documented tendency of generative-AI writing tools to offload higher-order cognition (argumentation, synthesis, evaluation, verification) and produce an **illusion of mastery** — the feeling of understanding without the intellectual work that creates understanding. Cogdoc's answer is **productive friction**: intentional, AI-driven interaction design that slows the user down at the right moments so that AI support *increases* cognition rather than bypassing it.

The MVP implements this through **four core engines** (Interceptor, Socratic Spacer, Citation Sentinel, Living Margin/Scaffold) grounded in a **local RAG pipeline** (Supabase + pgvector) so that claim verification is evidence-bound rather than hallucinated. Two experimental engines (Devil's Autocomplete, Blindspot Monitor) extend the friction concept further. A **friction-calibration** system lets the user modulate intervention intensity under deadline pressure — directly answering the central paradox surfaced by the project's own survey (78% would find the tool frustrating under deadlines).

**Stack (target, per IR Report §2.3):** React + Tiptap frontend · FastAPI backend · Supabase PostgreSQL + pgvector · Gemini-family API · Server-Sent Events streaming.

**Status:** A working monolith MVP exists (~4,800 LOC, Next.js + contentEditable + SQLite + keyword retrieval). This document specifies the migration to the target architecture and the feature surface to be delivered at final FYP defense.

---

## 2. Problem & Evidence Base

### 2.1 The core problem

Generative-AI writing tools are frictionless by design: the user enters a prompt, the system returns fluent text. Fluency creates the **impression that understanding has occurred even when the user has not done the intellectual work** (synthesising, arguing, verifying, revising). Two failure modes follow:

- **Cognitive offloading → atrophy.** When AI performs the high-value cognitive operations (structure, evidence, wording), the user practices fewer of the operations that build academic competence. Gerlich (2025) links high AI use to reduced critical-thinking patterns; Lee et al. (2025) report that knowledge workers with higher confidence in generative AI report less critical-thinking effort; Stadler et al. (2024) find LLMs reduce cognitive load but compromise depth of reasoning; Kosmyna et al. (2025) report accumulated "cognitive debt" in essay writers using ChatGPT.
- **Automation bias → the stochastic parrot problem.** LLMs produce plausible language without grounded knowledge (Bender et al., 2021). Users accept fluent but unsupported claims, inaccurate summaries, and hallucinated citations without verification.

### 2.2 Survey evidence (n = 33, preliminary)

The project's own survey validates the problem quantitatively. Headline findings:

| Indicator | Finding |
|---|---|
| AI usage frequency | 63.6% use generative AI **daily** for academic/research work |
| Copy-paste of AI text into drafts | **69.6%** agree/strongly agree they paste AI text largely unchanged |
| Trust in AI factual claims | **68.4%** trust AI-generated facts despite known hallucination risk |
| Citation verification | Only **26.3%** strongly agree they verify AI citations against original sources |
| Reduced structural thinking | **72.2%** spend less time thinking about structure/flow when using AI |
| Illusion of mastery | **68.2%** feel they have mastered a topic from an AI summary without reading core literature |
| Receptivity to productive friction | **59.1%** rate a friction-based tool useful for long-term learning |
| **The paradox** | **78.3%** would find it frustrating under deadline pressure |

**Implication for the product:** Cogdoc must be strict enough to force reflection and verification, but not so obstructive that users abandon it under pressure. This single tension drives the **Friction Calibration** research contribution (§9).

### 2.3 The design gap in the market

| System | Strength | Gap Cogdoc fills |
|---|---|---|
| Google Docs + Gemini | Integrated drafting, rewriting, generation | Optimised for generation, not cognition |
| Grammarly | Surface polish, clarity, tone | Smooths output rather than challenging reasoning |
| Elicit | Research discovery, paper synthesis | Not a writing IDE; no in-draft friction |

**The gap Cogdoc occupies:** a writing interface that *deliberately refuses to generate final text* and instead uses AI to preserve the writer's cognitive responsibility, while grounding verification in the user's own research library.

---

## 3. Vision, Goals & Non-Goals

### 3.1 Vision statement

> A writing environment where AI is a reflective and adversarial layer around the human author — not an author itself. The computer artefact is not a ghostwriter; it is a challenger in the margin. The final text is always written by the learner, because producing the text *is* the learning.

### 3.2 Aim (from IR §1.3)

To design, develop, and evaluate Cogdoc — a web-based research-assisted writing IDE that uses **productive AI friction** and **local contextual validation** to support academic writing without directly generating final text.

### 3.3 SMART objectives

| # | Objective | Success measure |
|---|---|---|
| O1 | Build a web-based academic writing IDE that cultivates critical thinking | A deployed editor with four working engines, demoable end-to-end |
| O2 | Limit dependence on AI-generated text via Socratic questioning instead of generation | Interceptor blocks ≥ 90% of delegative prompts in the test set (§15) and returns a Spark Gap question |
| O3 | Enable verification of written claims against uploaded research PDFs | Citation Sentinel achieves the precision/recall targets in §14.3 over a labeled evaluation set |
| O4 | Evaluate the tool with students, researchers, and writers | Survey (n ≥ 30) + ≥ 3 semi-structured interviews + usability study, analysed in the final report |

### 3.4 Non-Goals (explicitly out of scope)

- **No automatic generation** of final academic paragraphs, essays, or dissertation sections.
- **No plagiarism detection** and **no LMS integration** (e.g., Turnitin, Moodle).
- **No real-time multi-author collaborative editing** or comment threads (single-author focus).
- **No mobile app** — desktop-first, by design.
- **Not a commercial SaaS** — an academic prototype evaluated for its interaction-design and educational contribution.

### 3.5 Constraints

- 60-day total FYP development window; the migration + feature completion targets a focused 2-week sprint (§18).
- Citation Sentinel quality is bounded by the quality, readability, and relevance of uploaded PDFs and the embedding model's coverage.
- External AI API limits (rate, latency, cost, model availability) constrain production model choice.
- Survey/interview data collection is ongoing; final statistics land at end of the cycle.

---

## 4. Design Principles & Friction Philosophy

These principles are derived from the literature review (IR §2.1.6) and govern every feature decision. When a design choice and a principle conflict, the principle wins.

1. **Academic writing must not be cognitively scripted.** The system helps by surfacing poor questions, exposing weak assumptions, demanding evidence, and prompting revision. It never produces the final sentence.
2. **Friction is a feature, not a bug.** Following Bjork (1994) on *desirable difficulties* and Cabitza/Natali on *frictional AI*, intentional inefficiency at the right moment increases long-term retention and transfer.
3. **Evidence over fluency.** Following the stochastic-parrot critique, no claim is accepted as true because the AI said so. Claims are only "supported" if grounded in a passage from the user's own uploaded library.
4. **Friction must be calibrated, not absolute.** The paradox in §2.2 demands it: friction that users abandon under pressure is friction that fails. Intensity must adapt to context (§9).
5. **The human retains authorship and authorship responsibility.** There is always a clear separation between user-authored prose and AI-authored interventions; the AI never writes into the document body.
6. **Intelligence amplification, not substitution.** Following Bush (1945) and Engelbart (1962), the artefact augments the thinker's capacity to deal with complexity — it does not replace the thinking.

---

## 5. Personas & Primary Use Cases

### 5.1 Personas

**P1 — Aarav, undergraduate (FYP stage).** Writes his final-year report under deadline pressure. Heavy daily AI user; pastes AI text, rarely verifies citations. *Needs:* claim verification he can trust; something that stops him delegating whole sections without removing all speed.

**P2 — Dr. Lim, postgraduate researcher.** Literature-heavy writing across 20–50 PDFs. Wants evidence-grounded feedback and Socratic challenge, not generation. *Needs:* reliable cross-document retrieval; assumptions exposed.

**P3 — Sam, professional academic editor.** Drafts under discipline; values friction as a craft tool. *Needs:* structural scaffolding without text generation; deep links to source passages for citation work.

### 5.2 Primary use cases

| UC | Actor goal | Cogdoc response |
|---|---|---|
| UC-1 | Verify a written claim against my sources | Citation Sentinel retrieves top-k passages, returns supported/partial/unsupported verdict with evidence + deep link |
| UC-2 | Break a lazy-prompt habit | Interceptor classifies the prompt as delegative, refuses to generate, returns a `[The Spark Gap]` question |
| UC-3 | Get unstuck without being spoon-fed | Socratic Spacer fires on inactivity, surfaces a `[Provocation]`/`[Lens]` ghost question |
| UC-4 | Scaffold an argument without the AI writing it | Structural Scaffold returns `Claim / Evidence / Limitation / Implication` skeleton, no prose |
| UC-5 | Survive a deadline without abandoning the tool | Friction-calibration relaxes to Coach/Assistant mode under declared pressure (§9) |
| UC-6 | See what evidence I'm under-using | Blindspot Monitor compares draft against under-retrieved library passages (§7.2) |

### 5.3 Anti-use-cases (things Cogdoc must NOT do)

- Must not insert generated prose into the document body.
- Must not auto-accept or auto-reject a citation verdict on the user's behalf.
- Must not generate a bibliography or full reference list.
- Must not edit the user's text for grammar/style the way Grammarly does (that is a different product).

---

## 6. Feature Specification — Core Engines

Every engine follows the same lifecycle: **Trigger → Generate → Stream → Persist → Resolve.** The common lifecycle is defined once here and inherited.

### 6.0.1 Common engine lifecycle

| Stage | Behaviour |
|---|---|
| **Trigger** | A signal from the editor (idle timer, sentence-end punctuation, a user prompt, an explicit "verify" action) passes content-analyzer rules. Each engine has an independent cooldown to avoid flooding. |
| **Generate** | The backend builds a prompt from a seeded template + context, calls the AI model via the AI gateway. |
| **Stream** | The response streams to the client over SSE as tokens, then a terminal `done` event carrying the behaviour tag and a persisted `intervention_id`. |
| **Persist** | The intervention (engine type, tag, prompt, response, verdict if any) is written to the `Intervention` table (status `active`). Citation Sentinel additionally writes `InterventionEvidence` rows. |
| **Resolve** | The user acts on the intervention (`engaged` / `dismissed` / `ignored`); status moves to `resolved`/`faded`. The audit log feeds analytics. |

### 6.0.2 Common engine triggers & cooldowns (default, `socratic` friction mode)

| Engine | Trigger signal | Cooldown | Max per paragraph |
|---|---|---|---|
| Interceptor | User submits a prompt in the action bar | n/a (on demand) | 1 |
| Socratic Spacer | Idle ≥ threshold OR a sentence ending in `?` | 45 s | 1 |
| Citation Sentinel | Explicit "Verify claim" OR a detected claim sentence | 60 s | 1 |
| Scaffold | Explicit "Scaffold" action OR detected long paragraph | 90 s | 1 |

> **Note on the idle threshold.** The MVP code currently uses a 2 s idle threshold and the seed prompt text says 45 s. This drift will be reconciled: the production default is **45 s** in `socratic` mode, scaled by friction mode (§9). The 2 s value is a debugging default only.

### 6.1 Interceptor

**Purpose.** Identify lazy, vague, or delegative prompts and refuse to generate content on the user's behalf, instead returning a Socratic question that forces the user to do the cognitive work.

**Trigger.** On demand — the user types into the action bar and submits.

**Classification taxonomy.** A prompt is classified into one of:

| Class | Definition | Example | Response |
|---|---|---|---|
| `delegative` | Asks the AI to produce final text | "write a paragraph about cognitive load" | **Blocked.** Returns `[The Spark Gap]` question |
| `vague` | Too underspecified to be useful | "help with my intro" | Refused, asks for specificity |
| `assistant` | Legitimate non-generative help | "what are common counterarguments to X?" | Allowed; answered as a question, never as draft text |
| `metacognitive` | Reflection about the user's own writing | "is my argument here circular?" | Allowed; answered Socratically |

**Two-stage design.**
1. **Heuristic pre-check** (fast, no LLM cost): regex/pattern match for delegation verbs (`write`, `draft`, `generate`, `summarise this into`, `give me a paragraph`) and for "do my thinking" phrasing. A positive heuristic match short-circuits to a Spark Gap question.
2. **LLM classifier** (when heuristic is inconclusive): a compact prompt asks the model to return a JSON label + a one-line reason. Only `delegative`/`vague` are blocked; `assistant`/`metacognitive` proceed.

**On a blocked prompt.** The Interceptor:
- Does **not** return any draft text.
- Returns a `[The Spark Gap]` question (§13) scoped to the prompt's topic, e.g. *"What is the single claim a reader must accept before this paragraph works?"*
- Logs the intervention with `engineType = interceptor`, `userAction` initially null.

**On an allowed prompt.** The response is streamed but constrained: it must be a question, a reframing, or a pointer — never paragraph-length prose. A post-generation guard rejects any response exceeding the prose-length budget (see §6.1.1).

#### 6.1.1 Anti-generation guard

To guarantee the Interceptor never silently becomes a generator, every response passes a guard:
- **Hard reject** if the response contains > N complete sentences of declarative prose (configurable; default N = 2 in `socratic` mode, relaxed in `assistant` mode).
- **Hard reject** if the response is contiguous prose longer than a token cap.
- Rejected responses are replaced with a Spark Gap question and the incident is logged for the evaluation study.

### 6.2 Socratic Spacer

**Purpose.** Detect writer inactivity and surface a contextual ghost question in the margin that restarts thinking without generating text.

**Trigger.** Two signals:
- **Idle timer.** No keystroke for the mode-scaled idle threshold (default 45 s in `socratic`).
- **Question sentence.** The user types a sentence ending in `?` — interpreted as self-questioning, which the Spacer amplifies.

**Behaviour tag selection.** The Spacer chooses between `[Provocation]` (challenges an assumption) and `[Lens]` (forces re-reading from another viewpoint) based on the surrounding paragraph's content. A short classifier scores which is more apt; ties go to `[Provocation]`.

**Output.** A single ghost question rendered in the Living Margin beside the active paragraph. It is **advisory and dismissible** — it never writes into the document body. The question is persisted as an `Intervention` with `engineType = socratic`.

**Anti-nuisance rules.**
- One active Spacer intervention per paragraph at a time.
- If the user is actively typing (keystroke within the last threshold window), no new Spacer fires.
- A dismissed Spacer for paragraph P is not re-fired for P until the paragraph content changes materially (≥ 20% edit distance).

### 6.3 Citation Sentinel

**Purpose.** Verify user-written claims against the user's uploaded research PDFs and return an evidence-grounded verdict. This is the project's scientific core and its primary differentiator.

**Trigger.**
- **Explicit.** User selects a sentence/paragraph and invokes "Verify claim."
- **Automatic.** The content-analyzer flags a sentence as a claim (presence of a factual/quantitative assertion, causal verb, or absolute term) and the cooldown has elapsed.

**Pipeline.**
1. **Claim extraction.** The selected text is passed as the query.
2. **Vector retrieval.** The claim is embedded; pgvector returns the top-k (default k = 5) most semantically similar `PdfChunk`s from the project's PDF library, with cosine similarity scores.
3. **Verdict generation.** The AI is given the claim + the retrieved passages **only** (no general knowledge) and must return a structured verdict.

**Verdict taxonomy.**

| Verdict | Definition | UI treatment |
|---|---|---|
| `supported` | At least one retrieved passage directly entails the claim | Green underline + evidence card |
| `partially_supported` | Passages relate but don't fully entail; nuance/qualifier needed | Amber underline + evidence + gap note |
| `unsupported` | Retrieved passages contradict or are unrelated | Red underline + contradiction/absence note |
| `insufficient_evidence` | No sufficiently relevant passage retrieved (low max similarity) | Grey underline + "not enough in your library" note |

**Evidence card.** Each verdict links to:
- The exact `citedExcerpt` from the source chunk.
- The source PDF filename + approximate page (`pageApprox`).
- The `similarityScore`.
- A deep link that scrolls the Research Library to that passage.

**Persistence.** One `Intervention` row (`engineType = citation`, `verdict` set) + N `InterventionEvidence` rows (one per cited chunk).

**Guardrails.**
- The model is instructed it may **only** use the provided passages; any verdict must cite a passage id, else the verdict is downgraded to `insufficient_evidence`.
- If max retrieved similarity < a tunable floor (default 0.30 cosine), the verdict is forced to `insufficient_evidence` regardless of model output — preventing the model from inventing support.

### 6.4 Living Margin & Structural Scaffold

The **Living Margin** is the UI surface (not an engine) where interventions are rendered beside the text. The **Structural Scaffold** is the engine that produces a `[Structural Scaffold]` intervention.

**Living Margin surface.**
- Renders active interventions for the paragraph at the caret, grouped by engine, colour-coded by behaviour tag.
- Each intervention has engine-specific actions (§8.3) — e.g. for Citation: "Open evidence"; for Socratic: "Engage" / "Dismiss"; for Scaffold: "Insert skeleton".
- Interventions fade or resolve per the common lifecycle.

**Structural Scaffold engine.**
- **Purpose.** Provide an argumentative skeleton without writing the prose.
- **Output.** A fill-in structure, never contiguous prose:
  ```
  Claim: ____
  Evidence: ____
  Limitation: ____
  Implication: ____
  ```
- **Insertion rule.** The skeleton is inserted as **placeholder tokens** the user must replace; it is never pre-filled with generated content.

---

## 7. Feature Specification — Deferred / Experimental Engines

These extend the friction concept further and are specified here so they can be built within the delivery window if the critical path permits. They are explicitly lower-priority than the core four.

### 7.1 Devil's Autocomplete

**Concept.** An autocomplete that generates the next phrase as faint ghost text — but **physically will not commit unless the user types it themselves**, character by character. It shows what *could* come next, creating productive temptation, but the act of typing is what makes the knowledge stick. Inspired by desirable-difficulties theory: the suggestion is visible but the motor act of production is non-transferable.

**Behaviour.**
- On idle or at sentence mid-point, the model proposes a short continuation (≤ 12 words).
- Rendered as greyed ghost text at the caret.
- **Commit mechanic:** the suggestion is accepted only by the user typing each character; a Tab/Enter to accept-all is intentionally **disabled** in `socratic` mode (re-enabled in `assistant` mode, §9).
- Persisted as `Intervention` with `engineType = autocomplete` and a `userAction` of `typed` / `ignored` / `overruled` for the study.

**Anti-generation guard.** Suggestions are capped at one phrase; no multi-sentence autocomplete is permitted in any mode.

### 7.2 Blindspot Monitor

**Concept.** Compare the user's draft against their **under-retrieved** research library — passages that are highly relevant but were never cited or surfaced — and ask whether the user has overlooked a perspective. This directly attacks the illusion of mastery and one-sided evidence use.

**Behaviour.**
- Periodically (or on demand), embed the full draft, retrieve high-relevance passages that do **not** overlap with any Citation Sentinel evidence set, and select the most divergent.
- Present a `[Lens]`-style intervention: *"Your library contains a passage that complicates your claim on X — would you like to see it?"*
- On acceptance, show the passage and let the user decide whether to engage.

**Guardrails.** No more than one Blindspot prompt per writing session unless explicitly re-invoked, to avoid fatigue.

---

## 8. Feature Specification — Supporting Systems

### 8.1 The writing editor

- **Technology.** React + **Tiptap** (ProseMirror-based, headless) — replacing the MVP's raw `contentEditable` + `document.execCommand`.
- **Document model.** A ProseMirror doc (not an HTML string) persisted to the `Document` table.
- **Custom extensions.**
  - `WavyUnderline` — wraps target sentences in `<mark data-engine="...">` with per-engine colour, using fuzzy matching with cursor save/restore.
  - `IdleDetector` — drives the Socratic Spacer trigger.
  - `InterventionAnchor` — links a paragraph node to its intervention set.
- **Auto-save.** Debounced (1.5 s) write of the ProseMirror doc to the backend.
- **Keyboard.** Standard formatting via Tiptap commands; custom shortcuts for Verify-claim (⌘⇧V), Scaffold (⌘⇧S), Dismiss-intervention (Esc).

### 8.2 Research library (local RAG ingestion)

- **Ingestion pipeline.** Upload PDF → extract text (`pdf-parse` or equivalent) → clean → chunk (~500 tokens, with overlap) → embed (Gemini/OpenAI embedding model, 768-d) → store chunk + `embedding vector(768)` in `PdfChunk`.
- **Status tracking.** `Pdf.parseStatus` transitions `queued → parsing → ready | failed`.
- **Paste-text fallback.** Users may paste raw text if PDF parsing fails (OCR-laden or scanned PDFs).
- **Per-project isolation.** Retrieval is scoped to the active project's PDFs only.

### 8.3 Sentence popover (in-text intervention surface)

- On hovering a `<mark>`-ed sentence, a popover shows the engine-specific intervention and **actionable** next steps (not generic Engage/Dismiss):
  - Citation: "Open evidence" (deep link to passage), "Mark resolved", "Re-verify".
  - Socratic: "Engage" (opens a one-question loop), "Dismiss", "Show another lens".
  - Scaffold: "Insert skeleton", "Dismiss".
  - Interceptor: "Answer the Spark Gap", "Rephrase my prompt".

### 8.4 Analytics & history

- **Analytics panel.** Word count, intervention counts by engine/verdict, engage/dismiss ratios, "thinking time" proxy (time between keystrokes), supported-vs-unsupported claim ratio.
- **History.** Full intervention audit log (from the `Intervention` table) for reflection and for the evaluation study.

### 8.5 Export

- Export the document as Markdown, plain text, or HTML. Export never includes AI intervention text — only user-authored content.

### 8.6 Find Sources (web search assist)

- An opt-in web-search step (via the AI gateway's tool layer) that finds preliminary sources relevant to a claim, with an LLM relevance assessment. Distinct from Citation Sentinel: Find Sources searches the web; Citation Sentinel verifies against the user's **uploaded** library.

### 8.7 Authentication & multi-user isolation

- Supabase Auth (or `next-auth`, already a dependency) with email + OAuth.
- **Row-level security** on every table so a user can only read/write their own `Project`, `Document`, `Pdf`, `PdfChunk`, and `Intervention` rows.
- Replaces the MVP's hardcoded single user.

---

## 9. Friction Calibration (Research Contribution)

### 9.1 The problem this solves

The project's own survey surfaced a paradox: users see long-term value in friction (59.1%) but find it frustrating under deadline pressure (78.3%). A tool that users abandon under pressure is a tool that fails its educational mission. Cogdoc's contribution is not "more friction" or "less friction" — it is **calibrated friction**: intervention intensity that adapts to declared context without surrendering the core non-generation contract.

### 9.2 The three friction modes

| Mode | Behaviour | When |
|---|---|---|
| **Socratic** (default) | Full friction. All engines active, default cooldowns, Devil's Autocomplete commit disabled, anti-generation guard at strict threshold. | Open-ended writing, literature work, no deadline declared |
| **Coach** | Moderate friction. Cooldowns relaxed ~50%, Autocomplete allows phrase acceptance via typing (still no all-accept), Spark Gap questions softer. | Declared deadline within days; user toggles |
| **Assistant** | Light friction. Cooldowns relaxed ~75%, Autocomplete allows Tab-accept, Interceptor only blocks explicit "write the whole thing" prompts. Anti-generation guard still forbids multi-paragraph generation. | Declared deadline within hours; user toggles; time-boxed |

**Invariant across all modes:** Cogdoc never generates final paragraph-length prose, and every claim verdict remains evidence-grounded. Friction calibration relaxes *cadence and accepting help*, never the non-generation contract.

### 9.3 How the mode is set

- **Manual.** A friction slider in the editor top bar: `Socratic ⇄ Coach ⇄ Assistant`.
- **Declared deadline.** A user can set a deadline on a project; the system suggests a mode based on proximity and lets the user confirm or override.
- **Never automatic/secret.** Mode changes are always user-initiated or user-confirmed. The system never silently reduces friction.

### 9.4 Why this is a contribution

It operationalises the *frictional AI* literature (Cabitza, Natali) into a concrete, user-controllable interaction primitive and tests whether calibrated friction reduces abandonment without sacrificing learning benefit. This is testable (§14.4) and novel relative to Google Docs, Grammarly, and Elicit, none of which offer user-controlled friction modulation.

---

## 10. System Architecture

### 10.1 Target architecture (decoupled)

```
┌──────────────┐      HTTPS/SSE       ┌──────────────────┐       SQL        ┌────────────────────┐
│   Browser    │  ──────────────────▶ │   FastAPI        │  ──────────────▶ │  Supabase Postgres │
│ React+Tiptap │  ◀──── SSE stream ── │   (AI + RAG)     │                  │   + pgvector       │
│              │                      │                  │  ── embeddings ▶ │  (chunks, vectors) │
└──────┬───────┘                      └────────┬─────────┘                  └────────────────────┘
       │                                       │
       │ HTTPS (auth, CRUD, doc save)          │ AI gateway (model calls, tools)
       ▼                                       ▼
┌──────────────────┐               ┌────────────────────┐
│  Next.js (BFF)   │               │  Gemini-family API │
│  auth, projects, │               │  (chat + embed)    │
│  document save   │               └────────────────────┘
└──────────────────┘
```

- **Frontend (Browser).** React 19 + Tiptap editor, dashboard, Living Margin, popover, analytics.
- **Backend-for-Frontend (Next.js).** Owns auth, project/document CRUD, file upload orchestration, export. Calls FastAPI for all AI/RAG work.
- **AI/RAG service (FastAPI).** Owns the engines, prompt templates, retrieval, embedding, SSE streaming. The scientifically important half of the system.
- **Data store (Supabase Postgres + pgvector).** Relational data + vector embeddings in one store; RLS for isolation.
- **AI provider.** Gemini-family (or OpenAI-compatible) API for chat and embeddings.

### 10.2 Migration from the MVP (architecture decision records)

The MVP is a Next.js monolith with `contentEditable` + SQLite + keyword-overlap retrieval. The migration to the target architecture is recorded as ADRs (see §18, Sprint 0). Each deviation from IR §2.3 is either **remedied** (brought into line with the spec) or **justified** (kept, with a written rationale):

| Spec item | MVP reality | Decision |
|---|---|---|
| React + Tiptap | contentEditable + `execCommand` | **Remedy** — migrate to Tiptap (Sprint 3) |
| FastAPI backend | Next.js route handlers | **Remedy** — extract AI/RAG to FastAPI (Sprint 1–2) |
| Supabase + pgvector | SQLite + keyword overlap | **Remedy** — migrate to Supabase + pgvector (Sprint 1) |
| Gemini API | `z-ai-web-dev-sdk` wrapper | **Justify** — keep OpenAI-compatible gateway; Gemini reachable through it; document in ADR |
| SSE streaming | Blocking request/response | **Remedy** — add SSE (Sprint 2) |
| Multi-user auth | Hardcoded single user | **Remedy** — add Supabase Auth + RLS (Sprint 2) |

### 10.3 Component responsibilities (matrix)

| Concern | Owner |
|---|---|
| Editor surface, highlighting, idle detection | Frontend (Tiptap) |
| Auth, session, RLS enforcement | Supabase + Next.js BFF |
| Project/Document/PDF CRUD | Next.js BFF |
| PDF parse + chunk | FastAPI (ingest) |
| Embedding + vector store/read | FastAPI + pgvector |
| Engine prompt construction + model call | FastAPI (AI gateway) |
| SSE streaming | FastAPI (producer) → Browser (consumer) |
| Intervention persistence | FastAPI writes via Supabase client |

---

## 11. Data Model

Target Postgres schema (extends the existing Prisma models). Only deltas and key fields shown; full DDL lives in `prisma/schema.postgres.prisma`.

### 11.1 Entities

```
User
  id, email, displayName, dailyTokenBudget, frictionMode (enum), createdAt, lastLogin

Project
  id, userId, title, description, deadline?, archived, createdAt, updatedAt

Document
  id, projectId (unique), content (ProseMirror JSON), lastSaved

Pdf
  id, projectId, userId, filename, rawText, sizeBytes,
  parseStatus (queued|parsing|ready|failed), uploadedAt

PdfChunk                       ← the vector-bearing table
  id, pdfId, chunkIndex, content, charCount, pageApprox,
  embedding  vector(768)       ← NEW (was a comment in the MVP schema)
  createdAt

Intervention
  id, userId, projectId, paragraphId, promptTemplateTag,
  engineType (interceptor|socratic|citation|scaffold|autocomplete|blindspot),
  promptText, responseText,
  verdict (supported|partially_supported|unsupported|insufficient_evidence | null),
  frictionMode (socratic|coach|assistant),     ← NEW
  status (active|faded|resolved),
  userAction (engaged|dismissed|ignored|typed), createdAt, resolvedAt

InterventionEvidence
  id, interventionId, chunkId, similarityScore, citedExcerpt

PromptTemplate
  id, behaviorTag (unique), name, template, modelId, version, active, createdAt
```

### 11.2 Key indexes

- `PdfChunk`: HNSW index on `embedding` using `vector_cosine_ops` for fast ANN retrieval.
- `Intervention`: composite index on `(projectId, status)` and `(userId, createdAt)` for analytics/history.
- RLS policies on all user-scoped tables enforcing `userId = auth.uid()`.

### 11.3 Enums

- `engineType`: `interceptor | socratic | citation | scaffold | autocomplete | blindspot`
- `verdict`: `supported | partially_supported | unsupported | insufficient_evidence`
- `frictionMode`: `socratic | coach | assistant`
- `parseStatus`: `queued | parsing | ready | failed`

---

## 12. API Contracts

These contracts are the single source of truth across frontend, BFF, and FastAPI. They are locked at Sprint 0 and treated as immutable; changes require updating `docs/CONTRACTS.md` with acknowledgement from all affected streams.

### 12.1 FastAPI → BFF/Browser surface

All AI/RAG endpoints live under `/api`. Streaming endpoints use `text/event-stream` and emit the SSE event schema in §12.3.

| Method & path | Body | Response |
|---|---|---|
| `POST /api/rag/ingest` | `{ pdf_id, text, project_id }` | `{ chunks: [{ chunk_id, chunk_index, page_approx }] }` |
| `POST /api/rag/retrieve` | `{ claim, project_id, top_k }` | `{ passages: [{ chunk_id, pdf_id, score, text, page_approx }] }` |
| `POST /api/ai/interceptor` | `{ prompt, context, friction_mode }` | SSE stream |
| `POST /api/ai/socratic` | `{ context, behaviour?, friction_mode }` | SSE stream |
| `POST /api/ai/citation` | `{ claim, passages }` | `{ verdict, evidence: [{ chunk_id, excerpt, score }], rationale }` |
| `POST /api/ai/scaffold` | `{ context, friction_mode }` | SSE stream |
| `POST /api/ai/autocomplete` | `{ doc_state, cursor, friction_mode }` | SSE stream (Devil's Autocomplete) |
| `POST /api/ai/blindspot` | `{ draft, project_id }` | `{ prompt, passage }` (Blindspot Monitor) |

### 12.2 Next.js BFF → Browser surface

| Method & path | Purpose |
|---|---|
| `POST /api/auth/*` | Supabase/next-auth sign-in, sign-out, session |
| `GET/POST /api/projects`, `…/[id]` | Project CRUD |
| `GET/PUT /api/projects/[id]/document` | Document read/save |
| `POST /api/projects/[id]/pdfs` | Upload PDF (triggers FastAPI ingest) |
| `POST /api/projects/[id]/add-source` | Paste-text source |
| `GET /api/projects/[id]/export?format=` | md/txt/html export |
| `GET/POST /api/interventions`, `PATCH /api/interventions/[id]` | Intervention list/resolve |
| `GET /api/analytics` | Aggregated session stats |
| `GET/PUT /api/settings` | User friction mode + preferences |

### 12.3 SSE event schema (uniform across all streaming engines)

```
event: token      data: { "t": "<token>" }
event: meta       data: { "tag": "[Provocation]", "engine": "socratic", "friction_mode": "socratic" }
event: done       data: { "intervention_id": "<id>", "verdict": null }
event: error      data: { "code": "rate_limited" | "model_error" | "guard_violation", "message": "…" }
```

- `token` events carry streamed content tokens.
- `meta` is emitted first with the behaviour tag and engine.
- `done` is emitted exactly once at the end, carrying the persisted `intervention_id` (and `verdict` for Citation if applicable).
- `error` may occur at any point; the client shows a non-blocking toast and the partial intervention is still persisted if any content streamed.

### 12.4 Error model

| HTTP / event code | Meaning | Client behaviour |
|---|---|---|
| 400 | Malformed request / guard violation | Show inline error, no retry |
| 401 / 403 | Auth/RLS failure | Redirect to sign-in |
| 429 | Rate limited | Backoff retry (gateway) then toast |
| 500 / `model_error` | Upstream AI failure | Retry once, then toast |
| `guard_violation` | Anti-generation guard tripped | Replace response with Spark Gap, log incident |

---

## 13. Behaviour Tag Library

The seeded `PromptTemplate` rows. Each tag defines a reusable AI behaviour. (From IR Appendix G, extended.)

| Tag | Purpose | Example output pattern |
|---|---|---|
| `[The Spark Gap]` | A targeted question the user must answer before proceeding (used by Interceptor on blocked prompts) | "What is the one claim your reader must accept before this paragraph works?" |
| `[Provocation]` | Challenges an assumption in the user's current argument | "What evidence would make this claim false?" |
| `[Lens]` | Forces re-reading the paragraph from another viewpoint | "Read this from the perspective of a sceptical examiner. What is missing?" |
| `[Structural Scaffold]` | Provides an outline without writing the final text | "Claim: __ Evidence: __ Limitation: __ Implication: __" |

Tag selection logic:
- Interceptor block → `[The Spark Gap]`.
- Socratic Spacer → `[Provocation]` or `[Lens]` (content-scored).
- Scaffold → `[Structural Scaffold]`.
- Blindspot Monitor → `[Lens]`.
- Devil's Autocomplete → no tag (it is a continuation, not a question).

---

## 14. Evaluation & Research Methodology

### 14.1 Three-tier testing (from IR §6)

Unit → Integration → User Acceptance Testing, as detailed in §15.

### 14.2 Data gathering (from IR §3.2)

- **Quantitative:** online questionnaire (n ≥ 30 target) across undergraduates, postgraduates, PhDs, researchers, academic writers. Purposive sampling. Four sections: demographics/AI usage, cognitive offloading/automation bias, illusion of mastery, receptivity to productive friction.
- **Qualitative:** ≥ 3 semi-structured interviews (IR §3.2.5 guide), thematically analysed.
- **Document analysis:** literature, similar systems, technical docs.

### 14.3 Citation Sentinel retrieval evaluation (primary technical result)

This is the project's core scientific deliverable — converting "the Sentinel's accuracy is unproven" (IR §4.2) into a measured result.

**Ground-truth set.** ~50 hand-written claims spanning ~5 academic PDFs, each labeled by the author with the correct verdict:
- `supported` — directly entailed by a known passage.
- `partially_supported` — related but incomplete.
- `unsupported` — contradicted or absent.
- `insufficient_evidence` — no relevant passage in the library.

**Metrics.**
- **Precision, recall, F1** per verdict class.
- **Retrieval quality:** Recall@k (k=5) — is a supporting passage in the top-k?
- **Ablation (the headline comparison):** run the same claim set through (a) the MVP keyword-overlap retrieval and (b) pgvector semantic retrieval. Report the delta. This is a guaranteed-to-produce-numbers result and directly justifies the migration.

**Acceptance targets (socratic mode):**
- Citation verdict F1 (macro) ≥ 0.70 on the ground-truth set.
- Recall@5 ≥ 0.80 for `supported` claims.
- Vector retrieval beats keyword retrieval on Recall@5 by ≥ 15 percentage points.

### 14.4 Friction-calibration study (primary interaction-design result)

A small within-subjects usability study (target n ≈ 8–10) to test the central paradox:
- Each participant writes a short argumentative passage under two conditions: **Socratic mode** and **Assistant/deadline mode**, in counterbalanced order.
- Measures: perceived frustration (Likert), perceived learning value (Likert), time-on-task, intervention engage-rate, intent-to-reuse.
- Hypothesis: Assistant mode reduces perceived frustration without proportionally reducing perceived learning value — i.e. calibrated friction is a viable compromise.
- Reported as a descriptive + small-sample inferential result in the final report.

### 14.5 Interceptor blocking evaluation

- Test set of ~40 prompts hand-labeled `delegative | vague | assistant | metacognitive`.
- Measure classification accuracy and, critically, **blocking precision**: of prompts blocked, how many were truly delegative (false-block rate must be low, because wrongly blocking a legitimate `assistant` prompt destroys trust).
- Acceptance: blocking precision ≥ 0.90; delegative recall ≥ 0.90.

---

## 15. Test Strategy & Test Cases

### 15.1 Test pyramid

```
        ┌───────────┐
        │    UAT    │  manual, n≈8–10 users, scenarios (§15.4)
        └───────────┘
       ┌─────────────┐
       │ Integration │  API contract tests, RAG end-to-end, RLS checks
       └─────────────┘
      ┌───────────────┐
      │     Unit      │  content-analyzer, retrieval, guards, prompt builders
      └───────────────┘
```

### 15.2 Unit test cases (representative)

| ID | Component | Case | Expected |
|---|---|---|---|
| U-01 | content-analyzer | Sentence "This proves that X always causes Y." | flagged as `claim` (absolute + causal) |
| U-02 | content-analyzer | Sentence "What are the main reasons?" | flagged as `question` |
| U-03 | Interceptor heuristic | "write a paragraph about quantum computing" | `delegative` (regex match), no LLM call |
| U-04 | Interceptor heuristic | "what are counterarguments to dualism?" | not matched → goes to LLM classifier |
| U-05 | Anti-generation guard | Response of 4 declarative sentences in `socratic` | hard-reject → replace with Spark Gap |
| U-06 | Anti-generation guard | 1-sentence question response | accepted |
| U-07 | Chunker | 1200-token text | 3 chunks (~500 tok, ~100 overlap) |
| U-08 | Chunker | empty text | returns [] , no error |
| U-09 | Citation guard | max retrieved similarity 0.20 | verdict forced to `insufficient_evidence` |
| U-10 | Friction mode | mode = `assistant` | cooldowns scaled by configured factor |
| U-11 | SSE parser | stream with one `token` + `done` | reconstructed text + intervention_id |
| U-12 | Tiptap WavyUnderline | apply mark to sentence "X." then caret restore | caret position unchanged |

### 15.3 Integration test cases (representative)

| ID | Flow | Expected |
|---|---|---|
| I-01 | Upload PDF → ingest → retrieve on a known claim | top-5 includes the expected passage; Recall@5 hit |
| I-02 | Upload PDF → verify a `supported` claim end-to-end | verdict `supported`, evidence card with excerpt + deep link |
| I-03 | Verify an `unsupported` claim | verdict `unsupported` with absence/contradiction note |
| I-04 | Submit delegative prompt via Interceptor over SSE | blocked, Spark Gap streamed, `intervention_id` returned in `done` |
| I-05 | Idle 45 s with a half-written paragraph | Socratic Spacer fires once, ghost question in margin |
| I-06 | Dismiss a Spacer for paragraph P; keep typing in P | no re-fire until P changes materially |
| I-07 | RLS: user A queries user B's project | 403 / empty result |
| I-08 | Toggle friction Socratic → Assistant → submit prompt | Assistant cooldowns apply; non-generation guard still rejects multi-paragraph |
| I-09 | Export document as Markdown | file contains only user-authored content, no intervention text |
| I-10 | Network drop mid-SSE | client shows toast; partial intervention persisted if any token streamed |

### 15.4 UAT scenarios (manual, for the usability study)

| Scenario | Steps | Pass criteria |
|---|---|---|
| S-1 Claim verification | Create project → upload 2 PDFs → write a factual claim → Verify | User sees a verdict + evidence they can open; rates trust ≥ 4/5 |
| S-2 Lazy-prompt intercept | Type "write my methodology section" in action bar | Blocked with a Spark Gap; user reports it changed their approach |
| S-3 Getting unstuck | Write a paragraph, stop for 45 s | A margin question appears; user resumes writing |
| S-4 Deadline survival | Declare a 2-hour deadline → mode suggests Assistant → continue writing | User completes draft; frustration rating lower than Socratic baseline |
| S-5 Scaffold without generation | Invoke Scaffold on a thin paragraph | Skeleton inserted as placeholders; user fills it; no prose generated |
| S-6 Anti-abandonment | Use for 20 min continuously | Engage-rate ≥ 40% of interventions; user does not abandon |

### 15.5 Non-functional verification

- **Performance:** Citation Sentinel end-to-end (retrieve + verdict) p95 ≤ 4 s on a 5-PDF library.
- **Streaming:** first token of an SSE engine response in ≤ 1.5 s p95.
- **Reliability:** a failed AI call never crashes the editor; user content is never lost (auto-save confirmed on reconnect).
- **Security:** unauthenticated access to any `/api/projects/[id]/*` returns 401; cross-user access returns 403.

---

## 16. Non-Functional Requirements

| NFR | Requirement |
|---|---|
| **Usability** | Interface simple, readable, suitable for long-form academic writing; minimal chrome in focus mode |
| **Responsiveness** | Editor interactions never block on AI calls; interventions arrive asynchronously via SSE |
| **Latency** | First token ≤ 1.5 s p95; full Citation verdict ≤ 4 s p95 (5-PDF library) |
| **Privacy** | User drafts and PDFs isolated per user; no unnecessary PII; AI outputs marked advisory |
| **Transparency** | Every claim verdict states its evidence or its absence; never silently asserts |
| **Hallucination control** | Responses grounded in uploaded documents; guardrails force `insufficient_evidence` when grounding is weak |
| **Deadline usability** | The system remains usable under academic deadline pressure (friction calibration) |
| **Authorship separation** | Clear visual separation between user prose and AI interventions; AI never writes into the body |
| **Learning orientation** | The system supports long-term critical-thinking development, not just short-term output |

---

## 17. Security & Privacy

(From IR §2.3.7, extended.)

- **Data minimisation.** Collect no unnecessary PII; email is the only identity anchor.
- **Per-user isolation.** Row-Level Security on all user-scoped tables; retrieval scoped to the active project's PDFs.
- **Secure file handling.** PDFs stored in Supabase Storage with per-project paths; parse failures fail closed.
- **Advisory outputs.** The UI states AI outputs are advisory; verdicts are evidence-grounded, not authoritative.
- **Deletion controls.** Users can delete projects, PDFs, and their account, cascading to chunks/embeddings/interventions.
- **Secrets.** AI API keys server-side only, never exposed to the browser; `.env` never committed (the MVP ships a broken placeholder `DATABASE_URL` — to be corrected).
- **Academic-integrity framing.** Cogdoc is a writing-support tool, not an AI-content generator; this positioning is stated in-product.

---

## 18. Two-Week Delivery Roadmap

A contracts-first, parallelised plan exploiting a multi-agent build. The golden rule: **`main` always runs a passing demo; every migration lands behind a flag and only merges when the demo script passes.**

### Sprint 0 — Contracts, scaffold, safety net (Days 1–2)

- [ ] Tag current MVP `v0-monolith` (the floor we never fall below).
- [ ] Switch to conventional commits (current history is opaque UUID messages).
- [ ] Lock the four contracts (FastAPI OpenAPI, schema delta, SSE schema, Next.js `ai-gateway.ts` seam) into `docs/CONTRACTS.md`.
- [ ] Scaffold empty FastAPI app; create Supabase project; enable pgvector.
- [ ] Write the demo script (create project → write claim → upload PDF → Sentinel verifies) as the merge gate.

### Sprint 1 — Scientific core: FastAPI + Supabase + pgvector (Days 3–9)

- [ ] Add `embedding vector(768)` to `PdfChunk`; HNSW index; migrate Prisma → Postgres.
- [ ] FastAPI `/rag/ingest` (parse → chunk → embed → store) and `/rag/retrieve` (cosine ANN).
- [ ] FastAPI `/ai/citation` returning the verdict taxonomy with evidence + deep links.
- [ ] Point Next.js Citation route at FastAPI behind `USE_VECTOR_RETRIEVAL` flag.
- [ ] Build the labeled ground-truth set (§14.3); run keyword-vs-vector ablation → record F1/Recall@5.

### Sprint 2 — Stream the engines + auth (Days 10–15, parallel streams)

- [ ] Move all four engines behind the FastAPI AI gateway with SSE streaming (SSE schema §12.3).
- [ ] Frontend `EventSource` consumer; interventions type in instead of blocking.
- [ ] Supabase Auth + RLS on all tables; kill the hardcoded user.
- [ ] Tiptap migration: `@tiptap/react` + starter-kit; port `WavyUnderline` + `IdleDetector`; ProseMirror doc persistence.

### Sprint 3 — Friction calibration + experimental engines + hardening (Days 16–21)

- [ ] Friction modes (`socratic|coach|assistant`) with slider + deadline suggestion; mode-scaled cooldowns and guard thresholds (§9).
- [ ] Devil's Autocomplete (ghost-text, typing-only commit in Socratic) + Blindspot Monitor.
- [ ] Full `docker-compose` (Next.js + FastAPI + Postgres) — portfolio artifact.
- [ ] Run friction-calibration usability study (§14.4) and Interceptor blocking evaluation (§14.5).
- [ ] Finalise ADR set; demo dry-run against the gate script.

### Parallel-stream ownership map (multi-agent)

| Stream | Owns | Integrates at | Risk |
|---|---|---|---|
| A · RAG core | pgvector ingest/retrieve, embeddings | `ai-gateway.ts` flag | Low |
| B · Citation Sentinel | verdict logic, evidence, deep links | consumes A | Low |
| C · Tiptap migration | editor, WavyUnderline, IdleDetector | `editor.tsx` | **High** — strongest agent, earliest start |
| D · AI gateway + SSE | move engines to FastAPI, SSE | `ai-gateway.ts` | Medium |
| E · Auth + RLS | Supabase Auth, RLS policies | `auth.ts` | Low |
| F · Evaluation harness | ground-truth set, ablation script, metrics | reads A+B | Low — **this is the grade & research** |
| G · Experimental engines | Devil's Autocomplete, Blindspot Monitor | new routes + UI | Medium |

### Multi-agent coordination rules

1. **One file = one owner at a time.** `ai-gateway.ts` is the only shared merge point; streams queue, never double-edit.
2. **Every stream branches; every merge re-runs the demo script.** Green demo = mergeable.
3. **Contracts are immutable after Sprint 0.** Schema/event changes require a `CONTRACTS.md` proposal acknowledged by all affected streams.

---

## 19. Risk Register

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Tiptap migration breaks the highlight/idle system | High | High | Give it the strongest agent + earliest start; keep `v0-monolith` as fallback; feature-flag the swap |
| R2 | Citation Sentinel accuracy below target | Medium | High | Build the ground-truth set early; tune retrieval top-k and similarity floor; report honestly if below target |
| R3 | Spec≠code divergence penalised at viva | High (already real) | High | ADR set reconciles every deviation; update spec where justified |
| R4 | Multi-agent merge conflicts stall delivery | Medium | Medium | Contracts-first; one-owner-per-file; merge-gate script |
| R5 | AI API rate/latency limits disrupt demos | Medium | Medium | Retry/backoff in gateway; cached responses for the demo script; a deterministic fallback intervention set |
| R6 | Friction too high → users abandon (survey: 78%) | High | High | Friction calibration (§9) is the explicit countermeasure; study measures it |
| R7 | Deadline/schedule overrun | Medium | High | Cut order if behind: experimental engines first, then SSE, then (last) Tiptap — never cut pgvector + evaluation |
| R8 | PDF parse failures on scanned/OCR PDFs | Medium | Low | Paste-text fallback; clear `parseStatus` messaging |
| R9 | `.env` ships broken placeholder path | Low | Low | Correct in Sprint 0; add to repo checklist |

---

## 20. SDG Alignment

- **SDG 4 — Quality Education.** Cogdoc supports critical thinking, evidence-based writing, and responsible AI literacy. It is designed to preserve the cognitive work that academic writing is meant to cultivate, countering the deskilling risk of frictionless AI tools. (Primary alignment.)
- **SDG 9 — Industry, Innovation and Infrastructure.** Cogdoc contributes an innovative educational-software architecture (decoupled, RAG-grounded, friction-calibrated) and reusable prompt templates, architecture diagrams, and evaluation instruments. (Secondary alignment.)

---

## 21. Glossary

- **Cognitive offloading** — using external tools/actions to reduce internal cognitive demand (Risko & Gilbert, 2016). Beneficial for low-value tasks; harmful when it replaces high-value cognition.
- **Cognitive atrophy** — the decline of cognitive skills through disuse, here driven by over-delegation to AI.
- **Productive friction / frictional AI** — intentional interaction design that increases cognitive engagement to prevent deskilling (Cabitza et al., 2024; Natali, 2024).
- **Desirable difficulties** — learning conditions that feel harder short-term but improve retention/transfer long-term (Bjork, 1994).
- **Automation bias** — over-trust in automated suggestions even when wrong.
- **Stochastic parrot** — an LLM producing plausible language without grounded knowledge (Bender et al., 2021).
- **Illusion of mastery** — the feeling of understanding a topic from fluent AI output without the underlying work.
- **RAG** — Retrieval-Augmented Generation; grounding model output in retrieved evidence passages.
- **pgvector** — PostgreSQL extension enabling vector similarity search for RAG.
- **Living Margin** — the UI surface beside the text where AI interventions are rendered.
- **Behaviour tag** — a reusable AI behaviour template (`[Provocation]`, `[Lens]`, `[Structural Scaffold]`, `[The Spark Gap]`).
- **Spark Gap** — a targeted question the user must answer before proceeding; the Interceptor's response to a delegative prompt.
- **Sentinel verdict** — `supported | partially_supported | unsupported | insufficient_evidence`.
- **Friction mode** — `socratic | coach | assistant`; user-controlled intervention intensity.

---

## 22. Document Control

| Field | Value |
|---|---|
| Document | Cogdoc Product Specification |
| Version | 1.0 |
| Status | Spec for FYP delivery (migration + completion) |
| Author | Samreshan Sahani (NP069749) |
| Supervisor | Mr. Ishwor Thapa |
| Institution | Asia Pacific University of Technology & Innovation |
| Related | IR Report (Investigation Report); `README.md`; `DEVELOPER.md`; `worklog.md`; `prisma/schema.prisma` |
| Source of truth for contracts | `docs/CONTRACTS.md` (to be created in Sprint 0) |
| Source of truth for deviations | `docs/ADRs/` (to be created in Sprint 0) |

---

*This document is the single end-to-end reference for Cogdoc's product, architecture, evaluation, and delivery. Feature and contract changes update this file first; code and tests follow.*
