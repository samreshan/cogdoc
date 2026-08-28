# Production-readiness objective audit

**Audit date:** 2026-08-28

**Scope:** the persistent Cogdoc research-assistant, usability, onboarding,
model, source-discovery, formatting, SDG 4, documentation, and release objective

This audit maps each requested outcome to authoritative repository evidence. It
does not convert an automated test into a claim about a rendered browser,
assistive technology, a deployed provider, or an educational outcome.

## Status vocabulary

- **Automated evidence:** implementation and a directly relevant automated
  contract have been inspected and pass.
- **Implemented, rendered check pending:** source and DOM contracts exist, but
  the interaction or visual quality still requires a supported browser/device
  check.
- **Deployment gate:** completion depends on deployed infrastructure, external
  services, people, or institutional policy rather than another repository edit.

## Requirement evidence

| Requested outcome | Current evidence | Status |
|---|---|---|
| Underlined passages show their interventions on hover | `editor-tiptap.tsx` delegates hover, focus, click, Enter, and Space from `.cogdoc-mark` decorations to the passage popover. `intervention-highlight.test.ts` proves labelled, focusable decoration attributes; `sentence-popover.test.tsx` proves the named dialog and actions. | Automated evidence; pointer placement still needs rendered checking |
| Interventions are grouped in the right pane | `action-queue.tsx` deterministically groups Evidence checks, Claim clarity, Reasoning prompts, and Structure. `action-queue.test.tsx` proves order, filtering, stable within-group ordering, and rendered controls. | Automated evidence |
| Clicking a review item locates the underlined content | `action-queue.tsx` sends the anchored quote through the store; `editor-tiptap.tsx` resolves the exact ProseMirror range, focuses, selects, and scrolls it into view. `action-queue.test.tsx` and `editor-focus.test.ts` cover the handoff and range matching. Stale anchors produce an explicit message. | Automated evidence; long-document scroll needs rendered checking |
| Users can act from the review pane | Intervention actions support Locate, Find sources, Mark addressed, and Dismiss. Document-review actions support evidence linking, author notes, recheck, record, and dismissal with certificate blockers kept unresolved. The source query has a persistent label and icon-only review actions have accessible names. | Automated evidence; end-to-end deployed action cycle pending |
| Source uploads and source discovery are convenient | The right pane and Research Library upload lawful PDFs. Selection-based Find sources opens with the selected passage and searches immediately. Discovery fails over across OpenAlex, Crossref, Semantic Scholar, and only then Gemini; legal open-access resolution is separate. Route, toolbar, results, library, and API tests cover these contracts. | Automated evidence; live provider failover is a deployment gate |
| Citation suggestions and references are useful but author-controlled | Structured metadata is rendered through CSL for APA 7 or Harvard. Authors can copy in-text citations, one reference, or an alphabetized saved-reference list; Cogdoc never inserts prose or silently appends a bibliography. Registry and author verification remain distinct. | Automated evidence |
| Visible document formatting and academic export | The toolbar exposes semantic paragraphs/headings, emphasis, code, lists, quotations, dividers, tables, clear formatting, undo, and redo. Normalized DOCX export applies deterministic academic layout and keeps structure editable. Toolbar and DOCX suites cover the behavior. | Automated evidence; Word/LibreOffice visual inspection pending |
| A simple first-use homepage | The unauthenticated page now combines a concise capability explanation with sign-in/signup, visible labels, announced validation, honest product boundaries, and responsive dynamic viewport layout. Loading and setup errors are explicit. | Implemented, rendered check pending |
| First-login onboarding and persistent tutorial replay | Account-level `onboardingCompletedAt` opens the four-step tutorial once; the fixed Tutorial control reopens it on authenticated screens. API and component tests cover persistence, completion, skip, and replay. | Automated evidence; narrow-screen and assistive-tech checking pending |
| Hosted test model with a local-model path | The provider-neutral service supports Gemini and OpenAI-compatible Ollama, Groq, or custom endpoints. Ollama defaults to `qwen3:8b`; the UI reports readiness and degraded states without exposing secrets. `ai-service.test.ts` and `assistant-status.test.tsx` cover configuration and status. | Automated evidence; hardware-specific local evaluation is a deployment gate |
| Current high-throughput Gemini test default | Google currently lists stable `gemini-3.5-flash-lite` as its fastest, most cost-effective Gemini 3.5 model and documents Search grounding support. Cogdoc uses that stable ID rather than a hot-swapped `latest` alias. Google states active rate limits are project/tier-specific, visible in AI Studio, and not guaranteed, so Cogdoc makes no fixed free-quota promise. | Verified against official documentation on the audit date; live quota remains external state |
| SDG 4 is a defensible product alignment | Product copy and documentation connect Cogdoc to research literacy, source evaluation, independent argumentation, and transparent revision. They explicitly avoid claims of measured educational impact, authorship proof, plagiarism detection, or detector evasion. | Implemented boundary; learning outcomes require consented evaluation |
| Existing environment variables and documented additions | `.env.example`, README, developer documentation, ADR-0010, and the release checklist cover the provider, scholarly-index, auth, storage, and operational variables. Runtime status endpoints return bounded public configuration only. Local secret files are excluded from commits. | Automated/documented evidence; deployment values remain operator-supplied |
| Deviations and end-to-end decisions are documented | ADR-0000 reconciles specification versus build. ADRs 0006 through 0011 cover the editor, streaming boundary, embeddings, canonical content, research UX/model choices, and auth/RLS boundaries. Release readiness separates code evidence from operational acceptance. | Documented evidence |

## Current Gemini evidence

- [Google Gemini API models](https://ai.google.dev/gemini-api/docs/models)
  lists `gemini-3.5-flash-lite` as stable and identifies the current model IDs.
- [Gemini 3.5 Flash-Lite model page](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite)
  documents its high-throughput positioning, stable ID, token window, and Search
  grounding capability.
- [Google Gemini API rate limits](https://ai.google.dev/gemini-api/docs/rate-limits)
  states that limits are applied per project, vary by model, tier, and account
  status, and should be checked in AI Studio. A successful model-list probe is
  therefore not proof of remaining completion quota.

## Evidence still required before a shared or public release

1. Rendered desktop and narrow-viewport walkthrough of login, onboarding,
   editor, hover/focus popovers, grouped queue navigation, source flow, and
   export using a supported browser controller.
2. Keyboard-only, reduced-motion, 200% zoom, VoiceOver, and NVDA sessions with
   recorded browser and assistive-technology versions.
3. Live OpenAlex, Crossref, Semantic Scholar, Unpaywall, and Gemini failover and
   quota exercises against the intended deployment.
4. Supabase RLS/private-storage verification, malware scanning, retention,
   backup restore, key rotation, outage recovery, and representative load tests.
5. Human usability sessions and appropriately consented learning-outcome
   evaluation before making outcome or accessibility-conformance claims.

Until the gates applicable to the intended target pass, the honest posture is
the one in `docs/deployment/release-readiness.md`: local demonstration is
supported, while shared and public release remain conditional.

## Local operational checkpoint

The 2026-08-28 local checkpoint produced the following evidence:

- `docker compose -f docker-compose.dev.yml ps` reported the PostgreSQL service
  healthy, and a direct catalog query confirmed the `vector` extension exists.
- `npm audit --omit=dev --omit=optional` reported zero known vulnerabilities in
  the deployable dependency set.
- `npm run security:verify` correctly rejected the plain local Compose database:
  required Supabase RLS policies were absent and the Supabase private-storage
  schema was unavailable. This expected failure is evidence that the verifier
  does not mistake local development infrastructure for a complete shared
  deployment. It must pass against the intended Supabase deployment before a
  shared pilot.
