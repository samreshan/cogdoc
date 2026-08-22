## Overview

I will produce **one comprehensive Word (.docx) document** — `Cogdoc_FYP_Documentation.docx` — following the **APU BSc (Hons) IT Final Year Project 8-chapter structure** (per APU SOC/SOT Documentation Guidelines), written in simple language, minimal/vanilla academic styling (Times New Roman, black headings, plain title page), with **~15 diagrams rendered from Mermaid source to PNG** and embedded inline.

Documentation describes the **system as actually built** (Gemini, Tiptap/ProseMirror, pgvector, Supabase auth, FastAPI RAG service) and **notes original-spec deviations** where relevant. Cover uses **`[Student ID]`, `[Supervisor Name]`, `[Month Year]` placeholders**.

## Tooling approach
- **Diagrams:** Author each diagram as Mermaid source, then render to PNG. Primary: `@mermaid-js/mermaid-cli` (`mmdc`) via `npx`/`bunx` using the system Chrome. If a headless browser isn't available, fall back to the `mermaid.ink` render endpoint (only diagram source is sent — no document content).
- **Document:** Use the `docx` skill (docx-js via Node). Minimal-academic styling. Run `postcheck.py` after generation and fix errors.
- All artifacts go in a new `docs/fyp/` folder (diagrams in `docs/fyp/diagrams/`).

## Document structure

**Front matter** — Cover page (placeholders), Declaration, Acknowledgements, Abstract, Table of Contents, List of Figures, List of Tables.

**Chapter 1 — Introduction** — Problem background (generative AI & cognitive offloading), problem statement (cognitive atrophy, illusion of mastery), research & product questions, aims & objectives, scope (in/out), target users, significance, project contribution to research, report structure, Gantt. *(Diagram: Gantt timeline)*

**Chapter 2 — Literature Review** — Cognitive offloading & automation bias (Risko & Gilbert 2016; Gerlich 2025, n=666; Lee et al. 2025; Stadler et al. 2024; Kosmyna et al. 2025 "cognitive debt"), LLM limits (Bender et al. 2021 stochastic parrots), desirable difficulties / frictional AI (Bjork 1994; Cabitza & Natali 2024), intelligence amplification (Bush 1945; Engelbart 1962), review of existing systems (ChatGPT, Gemini, Grammarly, Elicit, Google Docs), gap analysis, theoretical framework, summary. *(Table: comparative analysis of existing tools)*

**Chapter 3 — Methodology** — SDLC approach: hybrid **Agile + TDD** with 2-week sprints over a 60-day window; TDD regimes (Red-Green-Refactor for net-new, characterization-first for migrations); the 80% coverage gate (`scripts/gate.sh`); research methodology (survey n=33, purposive sampling, semi-structured interviews, document analysis); evaluation methodology (calibrated harness, held-out test split). Justification vs waterfall. *(Diagrams: TDD gate cycle, methodology flow)*

**Chapter 4 — System Analysis** — Requirements gathering (survey results with all % findings, personas P1/P2/P3, use cases UC-1…UC-6, anti-use-cases); functional requirements; non-functional requirements (performance, reliability, usability, security); system constraints & assumptions. *(Diagrams: Use Case diagram, Context/DFD Level 0)*

**Chapter 5 — System Design** — Architecture (Next.js BFF + FastAPI RAG + pgvector + Gemini), design decisions (the 5 ADRs summarised), the non-generation contract & friction modes, data modelling (8 tables at 3NF, full field descriptions), UI/UX decisions (Tiptap, wavy underlines, popovers, "Pixelated Pets", the friction slider), the four AI engines. *(Diagrams: system architecture, component/deployment, ER, DFD Level 1, friction-mode flow, non-generation-contract flowchart)*

**Chapter 6 — Implementation** — Development environment & tools/technologies table, the engines' implementation, RAG pipeline (chunking, embeddings, vector retrieval, verdict guard with re-calibration finding), auth (Supabase + RLS), deployment (Docker multi-arch, setup wizard), how to use (condensed user guide). *(Diagrams: sequence — engine firing; sequence — Citation Sentinel RAG verdict; sequence — PDF ingest; intervention state diagram)*

**Chapter 7 — Testing & Evaluation** — Test strategy (unit/integration/system, 247 tests, coverage 93%+), the calibrated evaluation harness results (**macro-F1 0.773, Recall@5 0.8875**, per-class F1 table, the asymmetric-embedding bug & fix, the calibration finding), interceptor blocking precision (1.000), friction-invariant tests, user testing/acceptance approach, limitations honestly stated. *(Diagrams: evaluation pipeline; charts: per-class F1 bar, recall-by-k line)*

**Chapter 8 — Conclusion** — Summary of achievements vs objectives, research contributions (friction calibration + verdict re-calibration finding), limitations, future work (S4 stress test, smaller chunking, live pgvector round-trip, full SSE for all engines), reflection.

**References** — Harvard/APA-style full bibliographic entries for all cited works (full titles/venues reconstructed).

**Appendices** — A: Survey instrument; B: Evaluation dataset description; C: ADR index; D: API endpoint reference; E: full user guide.

## Diagrams to generate (Mermaid → PNG), ~15
1. Gantt timeline (sprints)  2. SDLC/TDD gate cycle  3. Methodology flow  4. Use Case  5. Context (DFD L0)  6. System architecture  7. Component/deployment  8. ER (8 tables)  9. DFD Level 1  10. Friction modes flow  11. Non-generation contract flowchart  12. Sequence: engine firing  13. Sequence: Citation Sentinel RAG verdict  14. Sequence: PDF ingest  15. Intervention state diagram  (+ 2 charts: per-class F1, recall-by-k)

## Execution steps
1. Create `docs/fyp/diagrams/` and author all Mermaid `.mmd` files.
2. Render each to PNG (mmdc, fallback mermaid.ink); generate the 2 data charts.
3. Build `docs/fyp/Cogdoc_FYP_Documentation.docx` via the docx skill, embedding images and writing all 8 chapters in simple language.
4. Run `postcheck.py`; fix errors; verify output.

## Tone & constraints
- Simple, plain-English explanations throughout (define every technical term on first use).
- Minimal/vanilla academic look — no decorative covers, no color, plain title page.
- Honest about deviations and unmet targets (e.g., the +15pp ablation gap not met), per the project's existing "honestly so" ethos.
- No fabricated metrics — all numbers come from the codebase/eval results.