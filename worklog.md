# Cogdoc MVP — Worklog

---
Task ID: 1
Agent: Super Z (main)
Task: Build the full Cogdoc MVP web app implementing the architecture design document — all 4 AI engines (Interceptor, Socratic Spacer, Citation Sentinel, Living Margin), usable UI, persistent storage.

Work Log:
- Loaded the fullstack-dev skill and initialized the Next.js 16 + TypeScript + Tailwind + shadcn/ui project.
- Designed the Prisma schema (8 models: User, Project, Document, Pdf, PdfChunk, Intervention, InterventionEvidence, PromptTemplate) mirroring the 3NF data model from the architecture PDF. Pushed to SQLite and seeded the 4 behaviour-tagged prompt templates ([The Spark Gap], [Provocation], [Lens], [Structural Scaffold]) plus a default writer user.
- Built the AI Service Layer (`src/lib/ai-service.ts`) — a provider abstraction (AIService interface + ZAIAdapter concrete impl) backed by `z-ai-web-dev-sdk`. Engines never touch the SDK directly; swapping to another LLM is one new adapter class. Includes heuristic pre-check for delegative prompts to save token budget.
- Built the keyword-overlap retrieval module (`src/lib/retrieval.ts`) — simulates pgvector cosine similarity using Jaccard overlap on tokenized text (stop-word filtered). Architecture is vector-DB-ready; this is the MVP approximation.
- Built 9 API routes: projects CRUD, document save (auto-save), PDF upload (file via pdf-parse + paste-text), interceptor, socratic-spacer, citation-sentinel, scaffold, interventions list/patch, analytics. All persisted interventions create audit-trail rows.
- Built the frontend with Zustand store + 5 React components:
  - `dashboard.tsx` — project list with create/delete dialogs, hero pitch cards.
  - `editor-shell.tsx` — top bar + editor + right panel with Margin/Library/Stats tabs.
  - `editor.tsx` — contenteditable writing surface with auto-save (1.5s debounce), 45s idle detector that fires Socratic Spacer, prompt input that fires Interceptor, text-selection that exposes Verify Claim button.
  - `living-margin.tsx` — renders active interventions as cards with Engage/Dismiss actions, citation evidence dialogs.
  - `research-library.tsx` — drag-drop PDF upload + paste-text indexing with status badges.
  - `analytics-panel.tsx` — total interventions, engagement rate, breakdowns by engine/action/verdict.
- Verified end-to-end with agent-browser:
  - Dashboard renders empty state, create-project dialog works.
  - Editor loads with auto-saved content; typing triggers auto-save (visible "Saving..." → "Saved" indicator).
  - Submitting "write a paragraph about cognitive offloading" → Interceptor fires → Socratic reframing appears in Margin: "What specific concerns does cognitive offloading raise for academic writing?"
  - Socratic Spacer fired after 45s idle: "If cognitive offloading is inherently negative, isn't outsourcing calculations to calculators also a concern?"
  - Pasted Gerlich 2025 abstract into Library → indexed as 1 chunk.
  - Selected draft text + clicked Verify Claim → Citation Sentinel returned "Partially Supported" verdict with cited evidence excerpt and 6% match score.
  - Engage button on intervention → correctly resolved and removed from active margin (count 3 → 2).
  - Stats tab shows total=3, by-engine breakdown, engagement rate, verdict breakdown.
  - Back to dashboard → project list shows the test project with intervention count badge.
- Lint passes clean (0 errors, 0 warnings). No errors in dev.log during full test cycle.

Stage Summary:
- All 4 AI engines from the architecture doc are implemented and verified working end-to-end.
- The MVP is a usable, polished web app — not a demo. Persistent storage, auto-save, full audit trail, real LLM calls.
- Single deviation from the architecture doc: pgvector is replaced with keyword-overlap retrieval (SQLite has no vector type). This is documented in code comments; the retrieval interface is vector-DB-ready.
- Single-user prototype (no auth) per ADR-02's "Supabase Auth + 1 role" decision — the MVP simplifies further by using a default writer user, since Supabase isn't available in this sandbox.
