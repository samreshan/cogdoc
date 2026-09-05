# CogDoc research collaborator implementation sprint prompts

This pack turns the [product refinement requirements](cogdoc-research-collaborator-prd.md) into bounded implementation assignments. The prompts below are instructions for future execution, not a record of work already performed. Each fenced block is self-contained for a fresh agent with repository access: copy one complete block, including its context and handoff requirements. The PRD supplies the full definitions and acceptance criteria; no earlier conversation is needed.

## Usage and readiness

1. Start with Sprint 1. Inspect its handoff and actual changes before dispatching Sprint 2. Continue in order by default. Do not run all prompts simultaneously or give competing agents ownership of the same schema/store/shell files.
2. A sprint is ready when its prerequisite contracts exist, its predecessor's actual tests/limitations have been read, and the next increment can build on persisted behavior. A completed-looking screen alone is insufficient. If a prerequisite is missing, report its exact effect; do not invent a passing handoff.
3. Each implementing agent should create the named handoff under `docs/refinement/handoffs/`. That directory and the handoffs are future deliverables; their absence before execution is expected. New endpoint filenames proposed by the PRD also do not exist yet. The “inspect” lists below are real baseline files; additional paths are discovered through previous handoffs.
4. The user has authorized implementation after these documentation files are complete, using one or two GPT-5.6 Terra tasks coordinated outside this documentation task. These files do not execute implementation. The recommended first task receives the entire Sprint 1 block. No clarification about the confirmed generation policy is needed.
5. Use one implementation task initially. A second Terra task can perform the explicitly bounded read-only audit described below while Sprint 1 runs, then review its output. Do not parallelize Sprint 2 against an unfinished domain contract. After Sprint 3, discovery and reasoning have partly independent behavior, but both touch sources/AI/store; keep sequential execution unless the coordinator establishes non-overlapping file ownership.
6. The user also wants substantially more polished, visually appealing UI without extra complexity. Prefer existing shadcn-compatible/Radix primitives; this is not a library migration. The approved core visual reference is [the generated workspace image](/Users/samreshan/.codex/generated_images/01a070a2-eaee-7a01-a233-a5e8c06effff/exec-6384f8a5-de70-4082-be69-6223fe7abb51.png): charcoal navigation/sidebar, light mineral workspace, restrained periwinkle/violet accents, refined legible typography, sources beside reasoning, contextual questions and a findings strip. The related [planning](/Users/samreshan/.codex/generated_images/01a070a2-eaee-7a01-a233-a5e8c06effff/exec-ed08c0a9-5c76-42de-b9fd-0da1a00584f5.png) and [findings](/Users/samreshan/.codex/generated_images/01a070a2-eaee-7a01-a233-a5e8c06effff/exec-a28945c3-250c-4f9e-9744-8724c38cd834.png) images are extension references only. Do not copy fictional image content into the product. Use the approved core reference as the Sprint 8 styling gate.
7. Do not deploy or contact participants from these prompts. Use disposable data for migration/seed rehearsals. A missing live provider does not block the manual core; a missing database can block actual migration verification and must be reported honestly.

### Current prototype priority

Build the functional prototype first: foundation, topic/plan, owned-source explanation, structured finding, then a minimal explicit manual finding acceptance. Preserve current protections and data, but defer expanded production security, authentication, RLS, concurrency, and operational-hardening work until after this functional path is demonstrable. Do not treat those deferred checks as a blocker for the prototype or remove existing safeguards to move faster.

The product boundary remains immediate work: refined-flow investigation cannot use legacy early-draft endpoints to create article prose, and an unrecognized job kind must not be reported as completed. Complete the full review/invalidation contract before article eligibility. RC-22 is a post-prototype hardening requirement before release. The coordinator may dispatch the manual review transition portion of Sprint 6 directly after Sprint 3; defer its AI analysis and broader dependency work until the functional slice is established.

| Sprint | Prerequisite | Deliverable and handoff | Readiness for next increment |
| --- | --- | --- | --- |
| 1 | Existing code inspection | Additive domain/policy/compatibility foundation; `sprint-01-foundation.md` | Schema/API mapping, migration evidence and flag contract; production hardening deferred |
| 2 | 1 | Persisted topic/question plan; `sprint-02-topic-plan.md` | Reloadable selected question; manual planning fallback; no early draft gate |
| 3 | 1–2 | Complete manual source/explanation/finding journey; `sprint-03-source-finding.md` | Real saved finding and provenance with providers disabled; then demonstrate minimum manual acceptance |
| 4 | 3 plus minimum manual acceptance | Purposeful discovery/access/video fallback; `sprint-04-discovery.md` | Truthful availability and question-linked candidates |
| 5 | 3; 4 for discovery help | Contextual help and controlled proposals; `sprint-05-reasoning.md` | Human wording preserved, skip works, no hidden draft bypass |
| 6 | 3; complete manual acceptance slice before 4–5 | Revision-specific review and invalidation; `sprint-06-review.md` | Server eligibility/freshness contract for articles |
| 7 | 6 | Both article paths, scoped policy, export; `sprint-07-articles.md` | Grounded article artifacts, selective invalidation, no publishing |
| 8 | 2–7 | Integrated simple/accessible experience; `sprint-08-integration.md` | Complete release candidate with recorded defects |
| 9 | 8 | Evaluation, demo and honest report; `sprint-09-evaluation.md` | Evidence-based release decision; UAT outstanding if not conducted |

### Optional independent second task

This bounded audit is safe alongside Sprint 1 because it writes no project files and changes no database. Copy the entire block if a second task is desired.

```text
Perform a read-only readiness audit of CogDoc at /Users/samreshan/Programming/cogdoc-workspace while a separate agent implements Sprint 1. Read applicable AGENTS.md, git status, docs/refinement/cogdoc-research-collaborator-prd.md and docs/refinement/cogdoc-research-collaborator-sprint-prompts.md. Do not edit any file, run migrations/seeds, install packages, deploy, or contact anyone. Read current files even if they are uncommitted; do not assume the other agent's unfinished changes are stable.

Inspect prisma/schema.prisma, src/lib/engine-guard.ts, src/lib/friction.ts, src/lib/ai-service.ts, src/app/api/research-kickoff/route.ts, src/app/api/research-dialogue/route.ts, src/app/api/interventions/[id]/responses/route.ts, src/lib/research-grounding.ts, src/lib/document-content.ts, src/lib/workspace-server.ts, src/lib/auth-supabase.ts, scripts/gate.sh and docs/fyp/final-src/content_ch5.js. Trace relevant callers using rg.

Return a concise evidence-backed audit of (1) existing prose-generation call sites and required operation-policy coverage; (2) migration/data-preservation hazards when adding findings/reviews/articles; (3) tests and fixtures already reusable; (4) exact prerequisite gaps for Sprint 2–3. Cite actual file paths/symbols and distinguish observed code from proposed design. Do not claim tests were run unless you ran an explicitly read-only check; do not run the full suite if it may mutate shared fixtures.

Preserve the confirmed product: structured findings are primary; review is explicit human acceptance of a revision, not truth/comprehension certification; inconclusive findings are valid; no idle-time passivity or answer-count drafting gates; later optional article mode offers both manual outline/writing and AI prose from selected reviewed findings with source/uncertainty preservation and invalidation. Do not argue for restoring a blanket no-prose rule. Initial questionnaire evidence is not UAT and long-term cognitive efficacy is unproven. Report results to the coordinator for integration; do not take ownership of implementation or make new tasks.
```

## Implementation blocks

### Sprint 1 — Additive domain foundation and compatibility contract

```text
SPRINT 1: Additive domain foundation and compatibility contract

You are implementing a bounded CogDoc refinement sprint in the checkout assigned to this task. The saved project is /Users/samreshan/Programming/cogdoc-workspace; if this task runs in an isolated worktree, make all implementation changes in that assigned worktree, not the saved project. Read applicable AGENTS.md files, inspect git status/diff, and preserve all existing user changes, including untracked implementation. Do not reset, clean, mass-format, replace lockfiles unnecessarily, or revert unrelated work. This repository was a dirty local checkout when the specification was written; inspect current code rather than assuming the documented baseline is unchanged.

Read docs/refinement/cogdoc-research-collaborator-prd.md in full and the relevant requirements below. Some docs/uploads are ignored and may be absent from a new worktree: use /Users/samreshan/Programming/cogdoc-workspace as a read-only reference source or locate moved files with rg --files --no-ignore. Never silently assume an isolated checkout contains the uncommitted baseline; compare required source files with the coordinator-provided starting state and report missing prerequisites. The PRD is the product contract; this prompt supplies this sprint's scope. CogDoc is a topic-first human-plus-AI research collaborator, not a multi-user editor. The primary outcome is structured findings linking question, conclusion, evidence/locators, the researcher's explanation, uncertainty, limitations and conflicting evidence. Inconclusive findings are valid. Research loops and branches; do not introduce a rigid wizard, answer-count/word-count comprehension gates, or idle-time passivity judgments. Reviewed means a particular revision was examined and explicitly accepted by the researcher, not AI-certified truth, authorship or understanding, and not completion of the whole investigation.

The confirmed generation policy deliberately evolves the original blanket non-generation rule: investigation supports thinking; a later optional stage permits BOTH an outline the researcher writes and an AI-generated article from selected current reviewed findings. No extra approval for that policy is needed. Article drafts preserve sources and uncertainty, flag new bridging inferences, become review-needed after dependent finding/evidence changes, and never publish automatically. Do not enable early prose generation merely because preliminary questions were answered. Keep original human explanations and existing documents intact.

Reuse Next.js/React/Tiptap, Prisma/PostgreSQL, existing source/library/evidence/auth/storage/job infrastructure and optional FastAPI retrieval. Inspect actual call sites and tests; comments and historical ADRs can be stale. Do not add a second app/framework or conflate SynthesisFinding, document Claim, legacy certification or AI satisfaction with reviewed research findings. Keep old work accessible and use additive migrations. Run migrations only against an identified disposable development/test database; never reset or migrate an unidentified live database. Do not deploy, publish, recruit/contact participants or modify unrelated product areas in this sprint.

Requirements: RC-01 and RC-24. RC-22 is explicitly deferred to post-prototype hardening. Read associated PRD state, flow, policy, migration and evaluation sections, not only the requirements table.

Prerequisites
None. This is the first implementation sprint. Existing schema and user changes are inputs, not work to overwrite.

Actual baseline files to inspect
- prisma/schema.prisma
- prisma/migrations/202608310001_research_ide/
- fastapi/migrations/0005_research_ide_rls.sql
- src/lib/types.ts
- src/lib/store.ts
- src/lib/api-client.ts
- src/lib/workspace-server.ts
- src/lib/auth-supabase.ts
- src/lib/document-content.ts
- src/lib/research-grounding.ts
- src/lib/research-jobs.ts
- src/lib/research-job-policy.ts
- src/lib/engine-guard.ts
- src/lib/friction.ts
- src/lib/ai-service.ts
- src/app/api/research-kickoff/route.ts
- src/app/api/research-dialogue/route.ts
- src/lib/research-migration.test.ts
- src/lib/security-migrations.test.ts
- scripts/gate.sh
Also inspect current files created by prerequisite sprints using their handoff paths. If a listed baseline file moved, locate its replacement with rg before editing.

Scope
Build the durable foundation and a migration rehearsal; do not build the full collaborator UI, discovery, contextual AI, review screens or article generation yet. Define contracts that let Sprint 2 and Sprint 3 implement a real journey without schema guesswork. A safe feature flag/experience version is in scope. Existing production behavior must remain compatible while the new flow is incomplete.

Implementation tasks
1. Inventory the actual Project/Document/source/claim/synthesis/audit relationships and record reuse versus new-model decisions. Inspect earlier migrations and their applied status in the chosen disposable environment. Record existing RLS and server ownership boundaries as compatibility constraints; do not expand them in this prototype sprint or blindly duplicate old SQL.
2. Implement additive models for research context, stable questions, exchanges, findings/revisions/evidence, review decisions and article/dependency snapshots to the extent needed to lock a coherent contract. Keep article content separate from the single legacy Document row. Use validated status values and ownership relations; explain any deferred table rather than silently changing the PRD.
3. Separate finding disposition from review state and project conclusion from finding review. Preserve original explanation/origin fields. Define revision/hash semantics, semantic question revision behavior, source content and bibliographic metadata dependency versions, and explicit review actor fields. Do not create accepted reviews from legacy data.
4. Preserve current authorization/data boundaries and define the minimal server-side relation-validation contract needed for the functional flow. Do not expand authentication, RLS, optimistic-concurrency, or production hardening infrastructure in this prototype sprint. Record the deferred hardening work and its intended release gate. Define only the product-critical job behavior needed now: unknown job kinds fail rather than being reported completed, and later jobs will require pinned-input checks.
5. Define the server AI operation contract and inventory prose call sites, including kickoff/dialogue/restructure/synthesis/autocomplete. This sprint establishes the boundary and tests its capability matrix; actual article drafting belongs to Sprint 7. Default the new collaborator mode to investigation-only. Do not disable existing guards globally or modify old saved drafts.
6. Add feature-controlled exposure and an explicit safe legacy mapping. Existing projects remain readable without entering a new onboarding flow. Backfill only identity/context that is unambiguous. Store original provenance for optional future imports as unreviewed candidates.
7. Create/reuse representative migration fixtures with HTML and ProseMirror documents, citations, shared library source links, notes, synthesis points, archived projects, audits and certificates. Record before/after counts and relevant hashes. Rehearse migration and repeat safe backfill to demonstrate idempotency; document rollback by exposure flag and corrective migration, not dropping user data.
8. Document actual endpoint/model names chosen for the proposed PRD contracts and the initial implementation status of each. This is the readiness contract subsequent agents must read.

Observable acceptance criteria
- Existing Project IDs, document content/revision, citation references, PDF/chunk identities, audit history and certificate payloads are unchanged by migration.
- New objects cannot reference a question/source/finding in another workspace, including another workspace owned by the same user without explicit attachment.
- Drafts can represent incomplete/inconclusive findings; old SynthesisFinding rows never become reviewed automatically.
- Foreign IDs, archive/deletion, stale writes and duplicate creation have deterministic tested behavior.
- Disabling the collaborator exposure leaves existing work accessible and preserves all newly written records.
- The operation policy denies article generation in investigation mode and has a narrowly defined future article capability without claiming that article generation exists yet.

Meaningful sprint-specific verification
Test a migration fixture twice, additive schema/domain shapes, question-parent cycles in the domain layer, policy allow/deny behavior, unknown-job failure, and stable content hashes across both document formats. Record deferred stale-update, duplicate-command, live-RLS and broader ownership-hardening checks for the post-prototype gate. Run Prisma validation/generation as appropriate and report database availability honestly. No provider credentials are required for this sprint.

Verification and deliverables
- Add meaningful unit/API/component or integration tests for the behaviors listed above, following the current test setup. Use real revision/ownership boundaries rather than implementation-mirroring assertions. Identify mocked versus live providers explicitly.
- Run relevant tests, lint/type/build checks for changed code, and the repository gate when the increment is ready. Inspect package.json and scripts/gate.sh for actual commands; record exact commands, outcomes, environment dependencies and pre-existing failures. Do not invent a pass, lower coverage thresholds, or call an unexecuted check passed.
- Rehearse any migration against representative disposable data; verify legacy IDs, document content hashes, citations, source links and audit history are preserved. If no schema change was needed, report that fact and the compatibility checks performed. Do not regenerate historical evidence to fit new terminology.
- Keep the increment demonstrable with saved state, clear empty/error/loading states and a manual recovery path. Report known limitations honestly. If a provider is unavailable, finish deterministic/manual behavior and list live checks separately.
- Deliver source changes and relevant tests plus a concise handoff in docs/refinement/handoffs/ for this sprint. Use the sprint-specific filename below. Include implemented requirement IDs, exact files/API/model changes, migrations and rehearsal evidence, commands/results, manual demo steps, unresolved regressions, feature-flag state, and precise prerequisites for the next sprint. Separate actual results from planned validation and distinguish blocking issues from documented defaults.
- Finish with a user-readable summary of what changed, why, how it was verified and any remaining risks. Do not continue into the next sprint automatically. Do not claim cognitive benefit, UAT success, academic acceptance or authorship certification from software tests.

Handoff filename: docs/refinement/handoffs/sprint-01-foundation.md
```

### Sprint 2 — Topic assessment and editable investigation plan

```text
SPRINT 2: Topic assessment and editable investigation plan

You are implementing a bounded CogDoc refinement sprint in the checkout assigned to this task. The saved project is /Users/samreshan/Programming/cogdoc-workspace; if this task runs in an isolated worktree, make all implementation changes in that assigned worktree, not the saved project. Read applicable AGENTS.md files, inspect git status/diff, and preserve all existing user changes, including untracked implementation. Do not reset, clean, mass-format, replace lockfiles unnecessarily, or revert unrelated work. This repository was a dirty local checkout when the specification was written; inspect current code rather than assuming the documented baseline is unchanged.

Read docs/refinement/cogdoc-research-collaborator-prd.md in full and the relevant requirements below. Some docs/uploads are ignored and may be absent from a new worktree: use /Users/samreshan/Programming/cogdoc-workspace as a read-only reference source or locate moved files with rg --files --no-ignore. Never silently assume an isolated checkout contains the uncommitted baseline; compare required source files with the coordinator-provided starting state and report missing prerequisites. The PRD is the product contract; this prompt supplies this sprint's scope. CogDoc is a topic-first human-plus-AI research collaborator, not a multi-user editor. The primary outcome is structured findings linking question, conclusion, evidence/locators, the researcher's explanation, uncertainty, limitations and conflicting evidence. Inconclusive findings are valid. Research loops and branches; do not introduce a rigid wizard, answer-count/word-count comprehension gates, or idle-time passivity judgments. Reviewed means a particular revision was examined and explicitly accepted by the researcher, not AI-certified truth, authorship or understanding, and not completion of the whole investigation.

The confirmed generation policy deliberately evolves the original blanket non-generation rule: investigation supports thinking; a later optional stage permits BOTH an outline the researcher writes and an AI-generated article from selected current reviewed findings. No extra approval for that policy is needed. Article drafts preserve sources and uncertainty, flag new bridging inferences, become review-needed after dependent finding/evidence changes, and never publish automatically. Do not enable early prose generation merely because preliminary questions were answered. Keep original human explanations and existing documents intact.

Reuse Next.js/React/Tiptap, Prisma/PostgreSQL, existing source/library/evidence/auth/storage/job infrastructure and optional FastAPI retrieval. Inspect actual call sites and tests; comments and historical ADRs can be stale. Do not add a second app/framework or conflate SynthesisFinding, document Claim, legacy certification or AI satisfaction with reviewed research findings. Keep old work accessible and use additive migrations. Run migrations only against an identified disposable development/test database; never reset or migrate an unidentified live database. Do not deploy, publish, recruit/contact participants or modify unrelated product areas in this sprint.

Requirements: RC-02, RC-03, RC-04. Read associated PRD state, flow, policy, migration and evaluation sections, not only the requirements table.

Prerequisites
Sprint 1 handoff accepted: additive schema, context/question contract, operation policy, job behavior and feature flag exist. Read docs/refinement/handoffs/sprint-01-foundation.md; if a required contract is missing, implement only a clearly documented minimal prerequisite or report the exact blocker.

Actual baseline files to inspect
- src/components/cogdoc/dashboard.tsx
- src/components/cogdoc/research-kickoff.tsx
- src/components/cogdoc/research-kickoff.test.tsx
- src/app/api/research-kickoff/route.ts
- src/app/api/research-kickoff/route.test.ts
- src/lib/ai-service.ts
- src/lib/types.ts
- src/lib/store.ts
- src/lib/api-client.ts
- src/app/api/workspaces/route.ts
- src/app/api/workspaces/[id]/route.ts
- prisma/schema.prisma
Also inspect current files created by prerequisite sprints using their handoff paths. If a listed baseline file moved, locate its replacement with rg before editing.

Scope
Deliver a narrow working entry point: save a topic and initial understanding, create/edit an investigation plan, and reopen the selected question. Do not generate article prose, add source discovery, or redesign every existing workspace screen.

Implementation tasks
1. Add a clear Start research action using the collaborator feature path. Persist topic immediately, then purpose/research intent and current understanding, including explicit unknown answers. Do not require a long topic or fixed number of answers; distinguish empty input validation from comprehension tests.
2. Adapt kickoff plan assistance to produce proposed questions with short purposes and optional parent/ordering suggestions. Validate output and label template fallback honestly. Persist a proposal separately from accepted plan content; never replace user edits when an old AI request completes.
3. Implement create, rename, reorder, branch, select and archive operations for questions using stable IDs and expected revisions. Provide keyboard move controls. Prevent cycles and foreign parent references. Explain impact when archiving a question with linked content; preserve that content.
4. Replace early drafting calls in the new kickoff experience with entry into investigation. Inspect the existing minimum-word/count logic and remove it from the collaborator path. Preserve old saved drafts. A completed preliminary assessment must not invoke draftResearchKickoff or grant article eligibility.
5. Build a minimal selected-question workspace view with a next action such as Add a source and a visible empty findings area. Use existing shell/store patterns where sensible. Saving and reloading must return to the same question and preserve partially entered understanding.
6. Handle plan provider timeout, malformed JSON, duplicate clicks, old result arriving after edits, save failures and two-tab revision conflicts. Manual plan creation must work without any AI configuration.
7. Record actual new component/API paths and how the next sprint attaches sources and exchanges to questions. Keep broader navigation changes deferred while this flow remains usable.

Observable acceptance criteria
- A user can create research from a short meaningful topic, answer “not sure,” edit the plan and return after reload without data loss.
- Plan changes retain IDs and linked content; cycles/foreign parents fail at the server.
- Provider outage results in an editable labeled template or manual questions, not an error dead end.
- New kickoff does not generate paragraphs, claim demonstrated understanding, or require three answers to continue.
- Concurrent updates produce an actionable conflict, and delayed proposals do not overwrite accepted questions.

Meaningful sprint-specific verification
Test valid short topics versus blank input, explicit unknowns, plan acceptance/edit/reorder/branch/archive, cycle rejection, ownership, reload persistence, fallback/malformed provider results and stale response races. Component tests must exercise keyboard reordering and error recovery; API tests must cover revision conflicts.

Verification and deliverables
- Add meaningful unit/API/component or integration tests for the behaviors listed above, following the current test setup. Use real revision/ownership boundaries rather than implementation-mirroring assertions. Identify mocked versus live providers explicitly.
- Run relevant tests, lint/type/build checks for changed code, and the repository gate when the increment is ready. Inspect package.json and scripts/gate.sh for actual commands; record exact commands, outcomes, environment dependencies and pre-existing failures. Do not invent a pass, lower coverage thresholds, or call an unexecuted check passed.
- Rehearse any migration against representative disposable data; verify legacy IDs, document content hashes, citations, source links and audit history are preserved. If no schema change was needed, report that fact and the compatibility checks performed. Do not regenerate historical evidence to fit new terminology.
- Keep the increment demonstrable with saved state, clear empty/error/loading states and a manual recovery path. Report known limitations honestly. If a provider is unavailable, finish deterministic/manual behavior and list live checks separately.
- Deliver source changes and relevant tests plus a concise handoff in docs/refinement/handoffs/ for this sprint. Use the sprint-specific filename below. Include implemented requirement IDs, exact files/API/model changes, migrations and rehearsal evidence, commands/results, manual demo steps, unresolved regressions, feature-flag state, and precise prerequisites for the next sprint. Separate actual results from planned validation and distinguish blocking issues from documented defaults.
- Finish with a user-readable summary of what changed, why, how it was verified and any remaining risks. Do not continue into the next sprint automatically. Do not claim cognitive benefit, UAT success, academic acceptance or authorship certification from software tests.

Handoff filename: docs/refinement/handoffs/sprint-02-topic-plan.md
```

### Sprint 3 — First complete source to finding journey

```text
SPRINT 3: First complete source to finding journey

You are implementing a bounded CogDoc refinement sprint in the checkout assigned to this task. The saved project is /Users/samreshan/Programming/cogdoc-workspace; if this task runs in an isolated worktree, make all implementation changes in that assigned worktree, not the saved project. Read applicable AGENTS.md files, inspect git status/diff, and preserve all existing user changes, including untracked implementation. Do not reset, clean, mass-format, replace lockfiles unnecessarily, or revert unrelated work. This repository was a dirty local checkout when the specification was written; inspect current code rather than assuming the documented baseline is unchanged.

Read docs/refinement/cogdoc-research-collaborator-prd.md in full and the relevant requirements below. Some docs/uploads are ignored and may be absent from a new worktree: use /Users/samreshan/Programming/cogdoc-workspace as a read-only reference source or locate moved files with rg --files --no-ignore. Never silently assume an isolated checkout contains the uncommitted baseline; compare required source files with the coordinator-provided starting state and report missing prerequisites. The PRD is the product contract; this prompt supplies this sprint's scope. CogDoc is a topic-first human-plus-AI research collaborator, not a multi-user editor. The primary outcome is structured findings linking question, conclusion, evidence/locators, the researcher's explanation, uncertainty, limitations and conflicting evidence. Inconclusive findings are valid. Research loops and branches; do not introduce a rigid wizard, answer-count/word-count comprehension gates, or idle-time passivity judgments. Reviewed means a particular revision was examined and explicitly accepted by the researcher, not AI-certified truth, authorship or understanding, and not completion of the whole investigation.

The confirmed generation policy deliberately evolves the original blanket non-generation rule: investigation supports thinking; a later optional stage permits BOTH an outline the researcher writes and an AI-generated article from selected current reviewed findings. No extra approval for that policy is needed. Article drafts preserve sources and uncertainty, flag new bridging inferences, become review-needed after dependent finding/evidence changes, and never publish automatically. Do not enable early prose generation merely because preliminary questions were answered. Keep original human explanations and existing documents intact.

Reuse Next.js/React/Tiptap, Prisma/PostgreSQL, existing source/library/evidence/auth/storage/job infrastructure and optional FastAPI retrieval. Inspect actual call sites and tests; comments and historical ADRs can be stale. Do not add a second app/framework or conflate SynthesisFinding, document Claim, legacy certification or AI satisfaction with reviewed research findings. Keep old work accessible and use additive migrations. Run migrations only against an identified disposable development/test database; never reset or migrate an unidentified live database. Do not deploy, publish, recruit/contact participants or modify unrelated product areas in this sprint.

Requirements: RC-06, RC-07, RC-09, RC-11, RC-12 minimum acceptance, RC-29. Read associated PRD state, flow, policy, migration and evaluation sections, not only the requirements table.

Prerequisites
Sprints 1–2 complete: context/question persistence and a working collaborator entry exist. Read sprint-01-foundation.md and sprint-02-topic-plan.md under docs/refinement/handoffs/. No live discovery or AI provider is required.

Actual baseline files to inspect
- src/components/cogdoc/research-library.tsx
- src/components/cogdoc/source-mapper.tsx
- src/components/cogdoc/research-work-pane.tsx
- src/components/cogdoc/research-inspector.tsx
- src/app/api/workspaces/[id]/sources/route.ts
- src/app/api/workspaces/[id]/sources/[sourceId]/content/route.ts
- src/app/api/workspaces/[id]/notebook/route.ts
- src/app/api/projects/[id]/pdfs/route.ts
- src/lib/research-source-server.ts
- src/lib/research-source.ts
- src/lib/source-mapper.ts
- src/lib/research-grounding.ts
- src/lib/private-storage.ts
- src/lib/types.ts
- src/lib/api-client.ts
- prisma/schema.prisma
Also inspect current files created by prerequisite sprints using their handoff paths. If a listed baseline file moved, locate its replacement with rg before editing.

Scope
Deliver the first complete manual vertical slice: topic/question → owned source or lawful excerpt → source inspection → researcher explanation → durable structured finding → explicit manual acceptance or retained uncertainty. Keep it small and usable. AI dialogue, live discovery, AI review analysis, dependency invalidation sophistication and articles are outside this sprint.

Implementation tasks
1. Allow a question to attach an existing owned library resource or import a supported source through existing upload/storage logic. Preserve DOI/URL/hash deduplication and allow multiple question links to the same workspace source with different learning/evidence roles.
2. Represent content availability explicitly: metadata only, abstract available, manual excerpt, extracted text, and indexing status must not be conflated. Show the basis available to CogDoc and a useful fallback for corrupt/scanned/unavailable text.
3. Present an accessible passage reader with source identity, exact excerpt and locator. Preserve page/chunk identifiers and content hash/revision when attaching evidence. Current PdfChunk.pageApprox is approximate/simulated, not an exact printed page: store and show locator precision/origin, handle changed chunk IDs, and never export an approximate location as exact. For lawful manual pasted text, record that it was supplied by the researcher and whether the original locator has been checked. Do not invent page numbers.
4. Persist the researcher's explanation as an exchange linked to the question and referenced source(s). Save it before any future AI call. Keep original wording and provenance. Ensure switching question/source and reloading cannot lose it.
5. Implement draft finding creation/editing: conclusion or explicit inconclusive answer, question, researcher explanation, evidence links with support/challenge/context role, uncertainty, limitations and conflicts. Progressive fields may be incomplete while drafting. Allow an honest no-available-evidence statement; do not reuse validateGroundedFindings unchanged if it forbids all evidence-free inconclusive drafts.
6. Add a minimum explicit manual review action for the current finding revision: the researcher may accept it or retain it with uncertainty, and the saved decision shows its exact finding revision and time. The action is never triggered by AI, a word count, a source open, or legacy intervention satisfaction. It does not make the whole workspace complete and does not make the finding article-eligible until Sprint 6 hardening.
7. Keep a compact findings view visible alongside the active investigation and a detail view with source links. Show draft, accepted-for-now and retained-with-uncertainty states plainly. Existing notes/synthesis can be referenced or explicitly copied into an unreviewed candidate with origin intact, never silently promoted.
8. Implement save pending/success/failure, local recoverable draft or equivalent loss prevention, source parse failure and no sources. Record deferred multi-tab/stale-write/idempotency hardening for the post-prototype release gate; do not build a new concurrency/security subsystem in this sprint. Scope recovery by user/workspace and clear it appropriately on logout/deletion.
9. Add a small lawfully usable fixture and demonstration instructions for one complete research journey without AI or vector retrieval. Include an inconclusive example as well as a supported-with-limits example; label all synthetic material.

Observable acceptance criteria
- A fresh user can complete topic → source → explanation → saved finding → explicit manual acceptance or retained uncertainty and reopen the exact data with AI and FastAPI disabled.
- Source content availability is accurate; a metadata-only item cannot masquerade as an inspected passage.
- Duplicate imports preserve library identity; cross-workspace evidence attachment fails.
- A finding retains original human explanation, exact evidence locator and uncertainty/conflicts; incomplete or inconclusive drafts save without a word-count hurdle.
- Switching questions or recovering from save failure does not silently lose work.
- Only the researcher can create the explicit accepted-for-now or retained-with-uncertainty decision. It does not resolve other questions, enable article generation, or claim truth/understanding.

Meaningful sprint-specific verification
Exercise source upload/link/deduplication, manual excerpt provenance, parse/index outage, save/reload of every finding field, inconclusive/no-evidence states, explicit acceptance/retained-uncertainty persistence, and legacy notes/source compatibility. Record deferred two-tab conflict and duplicate-request hardening. Use an integration/component journey for the whole slice, not only isolated field rendering tests.

Verification and deliverables
- Add meaningful unit/API/component or integration tests for the behaviors listed above, following the current test setup. Use real revision/ownership boundaries rather than implementation-mirroring assertions. Identify mocked versus live providers explicitly.
- Run relevant tests, lint/type/build checks for changed code, and the repository gate when the increment is ready. Inspect package.json and scripts/gate.sh for actual commands; record exact commands, outcomes, environment dependencies and pre-existing failures. Do not invent a pass, lower coverage thresholds, or call an unexecuted check passed.
- Rehearse any migration against representative disposable data; verify legacy IDs, document content hashes, citations, source links and audit history are preserved. If no schema change was needed, report that fact and the compatibility checks performed. Do not regenerate historical evidence to fit new terminology.
- Keep the increment demonstrable with saved state, clear empty/error/loading states and a manual recovery path. Report known limitations honestly. If a provider is unavailable, finish deterministic/manual behavior and list live checks separately.
- Deliver source changes and relevant tests plus a concise handoff in docs/refinement/handoffs/ for this sprint. Use the sprint-specific filename below. Include implemented requirement IDs, exact files/API/model changes, migrations and rehearsal evidence, commands/results, manual demo steps, unresolved regressions, feature-flag state, and precise prerequisites for the next sprint. Separate actual results from planned validation and distinguish blocking issues from documented defaults.
- Finish with a user-readable summary of what changed, why, how it was verified and any remaining risks. Do not continue into the next sprint automatically. Do not claim cognitive benefit, UAT success, academic acceptance or authorship certification from software tests.

Handoff filename: docs/refinement/handoffs/sprint-03-source-finding.md
```

### Sprint 4 — Purposeful discovery and content access transparency

```text
SPRINT 4: Purposeful discovery and content access transparency

You are implementing a bounded CogDoc refinement sprint in the checkout assigned to this task. The saved project is /Users/samreshan/Programming/cogdoc-workspace; if this task runs in an isolated worktree, make all implementation changes in that assigned worktree, not the saved project. Read applicable AGENTS.md files, inspect git status/diff, and preserve all existing user changes, including untracked implementation. Do not reset, clean, mass-format, replace lockfiles unnecessarily, or revert unrelated work. This repository was a dirty local checkout when the specification was written; inspect current code rather than assuming the documented baseline is unchanged.

Read docs/refinement/cogdoc-research-collaborator-prd.md in full and the relevant requirements below. Some docs/uploads are ignored and may be absent from a new worktree: use /Users/samreshan/Programming/cogdoc-workspace as a read-only reference source or locate moved files with rg --files --no-ignore. Never silently assume an isolated checkout contains the uncommitted baseline; compare required source files with the coordinator-provided starting state and report missing prerequisites. The PRD is the product contract; this prompt supplies this sprint's scope. CogDoc is a topic-first human-plus-AI research collaborator, not a multi-user editor. The primary outcome is structured findings linking question, conclusion, evidence/locators, the researcher's explanation, uncertainty, limitations and conflicting evidence. Inconclusive findings are valid. Research loops and branches; do not introduce a rigid wizard, answer-count/word-count comprehension gates, or idle-time passivity judgments. Reviewed means a particular revision was examined and explicitly accepted by the researcher, not AI-certified truth, authorship or understanding, and not completion of the whole investigation.

The confirmed generation policy deliberately evolves the original blanket non-generation rule: investigation supports thinking; a later optional stage permits BOTH an outline the researcher writes and an AI-generated article from selected current reviewed findings. No extra approval for that policy is needed. Article drafts preserve sources and uncertainty, flag new bridging inferences, become review-needed after dependent finding/evidence changes, and never publish automatically. Do not enable early prose generation merely because preliminary questions were answered. Keep original human explanations and existing documents intact.

Reuse Next.js/React/Tiptap, Prisma/PostgreSQL, existing source/library/evidence/auth/storage/job infrastructure and optional FastAPI retrieval. Inspect actual call sites and tests; comments and historical ADRs can be stale. Do not add a second app/framework or conflate SynthesisFinding, document Claim, legacy certification or AI satisfaction with reviewed research findings. Keep old work accessible and use additive migrations. Run migrations only against an identified disposable development/test database; never reset or migrate an unidentified live database. Do not deploy, publish, recruit/contact participants or modify unrelated product areas in this sprint.

Requirements: RC-05, RC-08; extend RC-06 and RC-07. Read associated PRD state, flow, policy, migration and evaluation sections, not only the requirements table.

Prerequisites
Sprint 3 manual journey demonstrable with preserved source/explanation/finding state. Read sprint-03-source-finding.md and the schema/API mappings from Sprint 1. Discovery provider credentials may be absent; deterministic adapters and manual fallback must still work.

Actual baseline files to inspect
- src/app/api/find-sources/route.ts
- src/app/api/find-sources/route.test.ts
- src/components/cogdoc/sources-results.tsx
- src/components/cogdoc/research-library.tsx
- src/components/cogdoc/source-mapper.tsx
- src/lib/research-source.ts
- src/lib/research-source-server.ts
- src/lib/source-mapper.ts
- src/lib/retrieval.ts
- src/app/api/workspaces/[id]/source-map/route.ts
- src/app/api/workspaces/[id]/sources/[sourceId]/content/route.ts
- src/lib/research-jobs.ts
- scripts/research-worker.mjs
Also inspect current files created by prerequisite sprints using their handoff paths. If a listed baseline file moved, locate its replacement with rg before editing.

Scope
Add question-focused recommendations to the working manual journey. Reuse actual scholarly/provider code and access metadata; do not build a new search engine, bulk ingestion system or universal transcript scraper. Video support is a truthful URL/manual-timestamp fallback; automated transcript acquisition is optional and must not delay core delivery.

Implementation tasks
1. Adapt discovery inputs from claim-only language to selected question, purpose and optional current uncertainty. Preserve ownership checks and guard provider budgets. Inspect the actual parallel provider calls rather than relying on comments about fallback order.
2. Return up to three useful initial candidates with title, known author/date, medium, contextual learning/evidence role, relevance explanation, record provider, access state and basis used for the rationale. Permit fewer than three; do not fabricate items or pad results. Add explicit Find more/refine controls.
3. Separate relevance from credibility and evidence support. Existing DOI/authorship/full-text quality scores measure available signals, not truth. Explain what is known about authority/method/date where available and what has not been assessed. Never claim a method was inspected from title/metadata alone.
4. Distinguish full text accessible, abstract only, metadata only, manual excerpt and failed/pending parsing. Show legal open-access links with provenance. Saving a result creates/reuses source identity and links it to the question; it does not mark it read or accept evidence.
5. Integrate source search results into the passage/explanation/finding loop without discarding the selected question or unsaved text. Support existing owned sources as a first-class alternative to discovery.
6. Add basic video resource handling with URL/title when supplied or known, transcript availability and optional researcher-provided timestamped excerpts. If no transcript is available, say so; treat supplied notes as notes and do not imply the full video was watched. Validate timestamp ranges and provenance without inventing transcript text.
7. Handle provider partial failure, all-provider failure, zero matches, malformed metadata, duplicate DOI/URL, unavailable full text and parser failure. Respect existing safe external fetch boundaries; extend SSRF/file protections if new acquisition is added.
8. Report which providers were exercised live, which were mocked, and which are unavailable. Keep fixtures versioned and independent of unstable live rankings.

Observable acceptance criteria
- Each recommended item states why it is useful to this question and whether that judgment came from metadata, abstract or inspected content.
- Three is a default maximum batch, not a mandatory minimum; zero results and outages have different messages and useful manual recovery.
- The same source can teach background for one question and be evidence for another without duplicate library records.
- Missing full text or transcript cannot produce a fabricated passage/evidence link.
- Saving and opening candidates preserves the active explanation and finding draft.
- Video without transcript works as a saved resource with labeled manual timestamp notes.

Meaningful sprint-specific verification
Test merged duplicates, missing authors/year, metadata-only rationale, partial/all provider outages, zero results, corrupted PDF, video with and without supplied transcript/excerpt, invalid timestamp, malicious URL and foreign workspace IDs. Verify recommendation origin and evidence eligibility through API and UI, not only prompt strings.

Verification and deliverables
- Add meaningful unit/API/component or integration tests for the behaviors listed above, following the current test setup. Use real revision/ownership boundaries rather than implementation-mirroring assertions. Identify mocked versus live providers explicitly.
- Run relevant tests, lint/type/build checks for changed code, and the repository gate when the increment is ready. Inspect package.json and scripts/gate.sh for actual commands; record exact commands, outcomes, environment dependencies and pre-existing failures. Do not invent a pass, lower coverage thresholds, or call an unexecuted check passed.
- Rehearse any migration against representative disposable data; verify legacy IDs, document content hashes, citations, source links and audit history are preserved. If no schema change was needed, report that fact and the compatibility checks performed. Do not regenerate historical evidence to fit new terminology.
- Keep the increment demonstrable with saved state, clear empty/error/loading states and a manual recovery path. Report known limitations honestly. If a provider is unavailable, finish deterministic/manual behavior and list live checks separately.
- Deliver source changes and relevant tests plus a concise handoff in docs/refinement/handoffs/ for this sprint. Use the sprint-specific filename below. Include implemented requirement IDs, exact files/API/model changes, migrations and rehearsal evidence, commands/results, manual demo steps, unresolved regressions, feature-flag state, and precise prerequisites for the next sprint. Separate actual results from planned validation and distinguish blocking issues from documented defaults.
- Finish with a user-readable summary of what changed, why, how it was verified and any remaining risks. Do not continue into the next sprint automatically. Do not claim cognitive benefit, UAT success, academic acceptance or authorship certification from software tests.

Handoff filename: docs/refinement/handoffs/sprint-04-discovery.md
```

### Sprint 5 — Contextual reasoning help and finding proposals

```text
SPRINT 5: Contextual reasoning help and finding proposals

You are implementing a bounded CogDoc refinement sprint in the checkout assigned to this task. The saved project is /Users/samreshan/Programming/cogdoc-workspace; if this task runs in an isolated worktree, make all implementation changes in that assigned worktree, not the saved project. Read applicable AGENTS.md files, inspect git status/diff, and preserve all existing user changes, including untracked implementation. Do not reset, clean, mass-format, replace lockfiles unnecessarily, or revert unrelated work. This repository was a dirty local checkout when the specification was written; inspect current code rather than assuming the documented baseline is unchanged.

Read docs/refinement/cogdoc-research-collaborator-prd.md in full and the relevant requirements below. Some docs/uploads are ignored and may be absent from a new worktree: use /Users/samreshan/Programming/cogdoc-workspace as a read-only reference source or locate moved files with rg --files --no-ignore. Never silently assume an isolated checkout contains the uncommitted baseline; compare required source files with the coordinator-provided starting state and report missing prerequisites. The PRD is the product contract; this prompt supplies this sprint's scope. CogDoc is a topic-first human-plus-AI research collaborator, not a multi-user editor. The primary outcome is structured findings linking question, conclusion, evidence/locators, the researcher's explanation, uncertainty, limitations and conflicting evidence. Inconclusive findings are valid. Research loops and branches; do not introduce a rigid wizard, answer-count/word-count comprehension gates, or idle-time passivity judgments. Reviewed means a particular revision was examined and explicitly accepted by the researcher, not AI-certified truth, authorship or understanding, and not completion of the whole investigation.

The confirmed generation policy deliberately evolves the original blanket non-generation rule: investigation supports thinking; a later optional stage permits BOTH an outline the researcher writes and an AI-generated article from selected current reviewed findings. No extra approval for that policy is needed. Article drafts preserve sources and uncertainty, flag new bridging inferences, become review-needed after dependent finding/evidence changes, and never publish automatically. Do not enable early prose generation merely because preliminary questions were answered. Keep original human explanations and existing documents intact.

Reuse Next.js/React/Tiptap, Prisma/PostgreSQL, existing source/library/evidence/auth/storage/job infrastructure and optional FastAPI retrieval. Inspect actual call sites and tests; comments and historical ADRs can be stale. Do not add a second app/framework or conflate SynthesisFinding, document Claim, legacy certification or AI satisfaction with reviewed research findings. Keep old work accessible and use additive migrations. Run migrations only against an identified disposable development/test database; never reset or migrate an unidentified live database. Do not deploy, publish, recruit/contact participants or modify unrelated product areas in this sprint.

Requirements: RC-10, RC-23; extend RC-09 and RC-11. Read associated PRD state, flow, policy, migration and evaluation sections, not only the requirements table.

Prerequisites
Sprint 3 is required; Sprint 4 should be accepted before using discovery-dependent help. Read sprint-03-source-finding.md and sprint-04-discovery.md. Manual explanations/findings and scoped AI operation helpers already exist.

Actual baseline files to inspect
- src/components/cogdoc/research-dialogue.tsx
- src/components/cogdoc/floating-interventions.tsx
- src/components/cogdoc/action-queue.tsx
- src/components/cogdoc/research-inspector.tsx
- src/app/api/research-dialogue/route.ts
- src/app/api/interventions/[id]/responses/route.ts
- src/lib/ai-service.ts
- src/lib/engine-guard.ts
- src/lib/friction.ts
- src/lib/use-engine-firing.ts
- src/lib/content-analyzer.ts
- src/lib/intervention-dedupe.ts
- src/lib/intervention-language.ts
- src/lib/research-grounding.ts
- src/lib/research-jobs.ts
- scripts/research-worker.mjs
Also inspect current files created by prerequisite sprints using their handoff paths. If a listed baseline file moved, locate its replacement with rg before editing.

Scope
Add assistive conversation to the existing durable research loop. Do not create a fixed exam, automatically reviewed findings or early working/article drafts. The minimum human acceptance transition already exists from Sprint 3; full finding review analysis, stale-state handling and invalidation belong to Sprint 6. Article generation belongs to Sprint 7.

Implementation tasks
1. Implement an explicit contextual-help request using selected question, persisted human explanation, current finding revision and legitimately available passages. Minimize transmitted context and include provenance. Persist human text before the call; a failed call cannot erase it.
2. Return one focused concern/question by default with its basis and an actionable follow-up. Support user-requested hints, plain-language passage explanation, clearly hypothetical examples, alternative perspectives and next investigation suggestions. Each output must remain grounded in the actual supplied context or label its hypothetical/general nature. Include a no-useful-gap case: an adequate explanation can proceed to finding capture without a manufactured challenge.
3. Offer skip, save for later/snooze and continue controls where relevant. Deduplicate repeated concerns for unchanged target revision. Suppress automatic repetition after dismissal until meaningful context changes. User-requested more help remains available.
4. Audit idle-related engine triggers and remove passivity/comprehension interpretations from the collaborator flow. Do not trigger mandatory questions because of inactivity or treat a short/pasted explanation as proof of poor understanding. Preserve compatible legacy user work and avoid unrelated engine rewrites.
5. Implement optional proposal to organize the researcher's explanation into finding fields. Show a preview/diff or clearly distinguish proposed text; explicit incorporation records AI assistance while preserving original wording. No automatic acceptance, overwriting or reviewed state.
6. Enforce operation-specific output validation, allowed source/passage IDs, ownership and prompt-injection boundaries. Treat retrieved text as evidence data, not instructions. Provider output cannot create actions beyond the validated help/proposal operation or forge a review decision.
7. Inventory and remove collaborator access to fixed-answer drafting in research-dialogue and intervention restructuring as appropriate. Existing saved drafts remain available; bounded wording suggestions cannot be used as a hidden path to a complete article. Record exact compatibility handling.
8. Add timeout/cancel/retry and stale-analysis handling. Avoid submitting older context as current after a question/finding changes. Keep manual explanation/finding editing available if the provider fails.

Observable acceptance criteria
- A help request cites a real context-specific concern and can provide a hint/example without generating a completed research answer.
- An unchanged dismissed concern does not recur automatically; idle time alone produces no intervention or passivity label.
- Human explanations remain unchanged unless the researcher explicitly incorporates a proposal, and the original remains retrievable.
- Foreign/unknown passage IDs and malicious source instructions cannot create evidence, reviews or article generation requests.
- A provider outage/malformed response shows a recoverable failure and does not block saving findings.
- No fixed number or length of answers is required to leave the dialogue or continue research.

Meaningful sprint-specific verification
Test user-requested help, contradiction context, hypothetical example labeling, skip/snooze/deduplication, material-context reset, fake timer idle behavior, original wording preservation, prompt injection and unknown IDs. Include stale response arrival and provider failure cases. Separate deterministic contract tests from any live semantic evaluation; do not report AI satisfaction as human comprehension.

Verification and deliverables
- Add meaningful unit/API/component or integration tests for the behaviors listed above, following the current test setup. Use real revision/ownership boundaries rather than implementation-mirroring assertions. Identify mocked versus live providers explicitly.
- Run relevant tests, lint/type/build checks for changed code, and the repository gate when the increment is ready. Inspect package.json and scripts/gate.sh for actual commands; record exact commands, outcomes, environment dependencies and pre-existing failures. Do not invent a pass, lower coverage thresholds, or call an unexecuted check passed.
- Rehearse any migration against representative disposable data; verify legacy IDs, document content hashes, citations, source links and audit history are preserved. If no schema change was needed, report that fact and the compatibility checks performed. Do not regenerate historical evidence to fit new terminology.
- Keep the increment demonstrable with saved state, clear empty/error/loading states and a manual recovery path. Report known limitations honestly. If a provider is unavailable, finish deterministic/manual behavior and list live checks separately.
- Deliver source changes and relevant tests plus a concise handoff in docs/refinement/handoffs/ for this sprint. Use the sprint-specific filename below. Include implemented requirement IDs, exact files/API/model changes, migrations and rehearsal evidence, commands/results, manual demo steps, unresolved regressions, feature-flag state, and precise prerequisites for the next sprint. Separate actual results from planned validation and distinguish blocking issues from documented defaults.
- Finish with a user-readable summary of what changed, why, how it was verified and any remaining risks. Do not continue into the next sprint automatically. Do not claim cognitive benefit, UAT success, academic acceptance or authorship certification from software tests.

Handoff filename: docs/refinement/handoffs/sprint-05-reasoning.md
```

### Sprint 6 — Explicit finding review and revision dependencies

```text
SPRINT 6: Explicit finding review and revision dependencies

You are implementing a bounded CogDoc refinement sprint in the checkout assigned to this task. The saved project is /Users/samreshan/Programming/cogdoc-workspace; if this task runs in an isolated worktree, make all implementation changes in that assigned worktree, not the saved project. Read applicable AGENTS.md files, inspect git status/diff, and preserve all existing user changes, including untracked implementation. Do not reset, clean, mass-format, replace lockfiles unnecessarily, or revert unrelated work. This repository was a dirty local checkout when the specification was written; inspect current code rather than assuming the documented baseline is unchanged.

Read docs/refinement/cogdoc-research-collaborator-prd.md in full and the relevant requirements below. Some docs/uploads are ignored and may be absent from a new worktree: use /Users/samreshan/Programming/cogdoc-workspace as a read-only reference source or locate moved files with rg --files --no-ignore. Never silently assume an isolated checkout contains the uncommitted baseline; compare required source files with the coordinator-provided starting state and report missing prerequisites. The PRD is the product contract; this prompt supplies this sprint's scope. CogDoc is a topic-first human-plus-AI research collaborator, not a multi-user editor. The primary outcome is structured findings linking question, conclusion, evidence/locators, the researcher's explanation, uncertainty, limitations and conflicting evidence. Inconclusive findings are valid. Research loops and branches; do not introduce a rigid wizard, answer-count/word-count comprehension gates, or idle-time passivity judgments. Reviewed means a particular revision was examined and explicitly accepted by the researcher, not AI-certified truth, authorship or understanding, and not completion of the whole investigation.

The confirmed generation policy deliberately evolves the original blanket non-generation rule: investigation supports thinking; a later optional stage permits BOTH an outline the researcher writes and an AI-generated article from selected current reviewed findings. No extra approval for that policy is needed. Article drafts preserve sources and uncertainty, flag new bridging inferences, become review-needed after dependent finding/evidence changes, and never publish automatically. Do not enable early prose generation merely because preliminary questions were answered. Keep original human explanations and existing documents intact.

Reuse Next.js/React/Tiptap, Prisma/PostgreSQL, existing source/library/evidence/auth/storage/job infrastructure and optional FastAPI retrieval. Inspect actual call sites and tests; comments and historical ADRs can be stale. Do not add a second app/framework or conflate SynthesisFinding, document Claim, legacy certification or AI satisfaction with reviewed research findings. Keep old work accessible and use additive migrations. Run migrations only against an identified disposable development/test database; never reset or migrate an unidentified live database. Do not deploy, publish, recruit/contact participants or modify unrelated product areas in this sprint.

Requirements: RC-12, RC-13, RC-14. Read associated PRD state, flow, policy, migration and evaluation sections, not only the requirements table.

Prerequisites
Sprint 3 core data and its minimum manual acceptance path are complete. Sprint 5 assistance is optional input, not a prerequisite: review hardening must work without any provider. Read sprint-03-source-finding.md and, if present, sprint-05-reasoning.md.

Actual baseline files to inspect
- src/lib/workspace-server.ts
- src/lib/research-grounding.ts
- src/lib/research-jobs.ts
- src/lib/research-job-policy.ts
- src/lib/types.ts
- src/lib/store.ts
- src/components/cogdoc/research-work-pane.tsx
- src/components/cogdoc/research-inspector.tsx
- src/components/cogdoc/research-history.tsx
- src/app/api/workspaces/[id]/history/route.ts
- src/app/api/workspaces/[id]/sources/[sourceId]/route.ts
- src/app/api/workspaces/[id]/review-items/route.ts
- src/app/api/review-items/[id]/recheck/route.ts
- prisma/schema.prisma
Also inspect current files created by prerequisite sprints using their handoff paths. If a listed baseline file moved, locate its replacement with rg before editing.

Scope
Harden the minimum explicit researcher decision from Sprint 3 into revision-aware review and dependency invalidation. Existing document verification concepts are reference material, not the new review model. AI analysis is optional assistance and must not be needed for the manual path. Do not generate articles or change historical certification records.

Implementation tasks
1. Implement review analysis for a pinned finding/evidence/question snapshot: whether conclusion matches evidence, missing reasoning, assumptions, contradictions, uncertainty and limitations. Findings with unavailable evidence must produce honest limitations. Keep analysis advisory and record target revisions and provider status.
2. Build review controls for revise, investigate further, accept current revision, or retain with uncertainty. Check structural completeness rather than an AI grade or minimum words. Permit reviewed inconclusive findings with explicit evidence gap and researcher explanation. Record server-derived researcher identity, exact revision, dependencies and decision time.
3. Reject stale acceptance if finding/evidence/question semantics changed after review opened. AI success cannot call the human review transition; a failed AI analysis does not prevent explicit manual review and must not become a fake clean result.
4. Implement dependency invalidation for edited findings, relevant question meaning, source text, locator, removal and cited metadata. Preserve old accepted snapshots and show what changed. Unrelated source/finding changes leave unaffected objects alone. Handle archive/restore without deleting history or automatically restoring review. Support explicit withdrawal of acceptance and propagate its dependency invalidation; keep the old review historical.
5. Keep finding review state separate from disposition and workspace state. Add explicit pause/conclude/reopen controls where needed with unresolved question summary. Accepting one finding does not conclude the workspace, require all questions resolved or imply truth.
6. Show findings alongside the investigation with filters for question/state and a clear evidence detail view. Make change/review history available without requiring a separate primary workflow. Never relabel old certification events as researcher finding reviews.
7. Define and test dependency manifest read/check helpers that Sprint 7 will use for articles, including a pre-generation/pre-export freshness check. Do not create empty article functionality solely to advertise it.
8. Make revision, invalidation and audit writes atomic; ensure concurrent source edit and acceptance cannot leave a falsely current reviewed state. Document transaction/locking or compare-and-swap strategy.

Observable acceptance criteria
- Only explicit authenticated researcher action can create a reviewed revision, including valid inconclusive findings.
- AI-unavailable manual review is clearly recorded and fully usable; AI success alone never changes review state.
- A source/locator or meaningful question change marks only dependent current findings review-needed with a visible reason.
- A stale accept request returns a conflict and retains both old review history and new work.
- Accepting a finding does not resolve other questions or complete the investigation.
- The reviewed snapshot and dependency helpers are ready for server-side article eligibility checks.

Meaningful sprint-specific verification
Test all state transitions in the PRD: incomplete draft, analyzed but unaccepted, manual acceptance, retain uncertainty, edit after acceptance, source/metadata/locator change, question semantic change, archive/restore, unrelated changes, and concurrent edit/accept. Test server actor enforcement and immutable review history, not only review badges.

Verification and deliverables
- Add meaningful unit/API/component or integration tests for the behaviors listed above, following the current test setup. Use real revision/ownership boundaries rather than implementation-mirroring assertions. Identify mocked versus live providers explicitly.
- Run relevant tests, lint/type/build checks for changed code, and the repository gate when the increment is ready. Inspect package.json and scripts/gate.sh for actual commands; record exact commands, outcomes, environment dependencies and pre-existing failures. Do not invent a pass, lower coverage thresholds, or call an unexecuted check passed.
- Rehearse any migration against representative disposable data; verify legacy IDs, document content hashes, citations, source links and audit history are preserved. If no schema change was needed, report that fact and the compatibility checks performed. Do not regenerate historical evidence to fit new terminology.
- Keep the increment demonstrable with saved state, clear empty/error/loading states and a manual recovery path. Report known limitations honestly. If a provider is unavailable, finish deterministic/manual behavior and list live checks separately.
- Deliver source changes and relevant tests plus a concise handoff in docs/refinement/handoffs/ for this sprint. Use the sprint-specific filename below. Include implemented requirement IDs, exact files/API/model changes, migrations and rehearsal evidence, commands/results, manual demo steps, unresolved regressions, feature-flag state, and precise prerequisites for the next sprint. Separate actual results from planned validation and distinguish blocking issues from documented defaults.
- Finish with a user-readable summary of what changed, why, how it was verified and any remaining risks. Do not continue into the next sprint automatically. Do not claim cognitive benefit, UAT success, academic acceptance or authorship certification from software tests.

Handoff filename: docs/refinement/handoffs/sprint-06-review.md
```

### Sprint 7 — Dual article paths and scoped generation policy

```text
SPRINT 7: Dual article paths and scoped generation policy

You are implementing a bounded CogDoc refinement sprint in the checkout assigned to this task. The saved project is /Users/samreshan/Programming/cogdoc-workspace; if this task runs in an isolated worktree, make all implementation changes in that assigned worktree, not the saved project. Read applicable AGENTS.md files, inspect git status/diff, and preserve all existing user changes, including untracked implementation. Do not reset, clean, mass-format, replace lockfiles unnecessarily, or revert unrelated work. This repository was a dirty local checkout when the specification was written; inspect current code rather than assuming the documented baseline is unchanged.

Read docs/refinement/cogdoc-research-collaborator-prd.md in full and the relevant requirements below. Some docs/uploads are ignored and may be absent from a new worktree: use /Users/samreshan/Programming/cogdoc-workspace as a read-only reference source or locate moved files with rg --files --no-ignore. Never silently assume an isolated checkout contains the uncommitted baseline; compare required source files with the coordinator-provided starting state and report missing prerequisites. The PRD is the product contract; this prompt supplies this sprint's scope. CogDoc is a topic-first human-plus-AI research collaborator, not a multi-user editor. The primary outcome is structured findings linking question, conclusion, evidence/locators, the researcher's explanation, uncertainty, limitations and conflicting evidence. Inconclusive findings are valid. Research loops and branches; do not introduce a rigid wizard, answer-count/word-count comprehension gates, or idle-time passivity judgments. Reviewed means a particular revision was examined and explicitly accepted by the researcher, not AI-certified truth, authorship or understanding, and not completion of the whole investigation.

The confirmed generation policy deliberately evolves the original blanket non-generation rule: investigation supports thinking; a later optional stage permits BOTH an outline the researcher writes and an AI-generated article from selected current reviewed findings. No extra approval for that policy is needed. Article drafts preserve sources and uncertainty, flag new bridging inferences, become review-needed after dependent finding/evidence changes, and never publish automatically. Do not enable early prose generation merely because preliminary questions were answered. Keep original human explanations and existing documents intact.

Reuse Next.js/React/Tiptap, Prisma/PostgreSQL, existing source/library/evidence/auth/storage/job infrastructure and optional FastAPI retrieval. Inspect actual call sites and tests; comments and historical ADRs can be stale. Do not add a second app/framework or conflate SynthesisFinding, document Claim, legacy certification or AI satisfaction with reviewed research findings. Keep old work accessible and use additive migrations. Run migrations only against an identified disposable development/test database; never reset or migrate an unidentified live database. Do not deploy, publish, recruit/contact participants or modify unrelated product areas in this sprint.

Requirements: RC-15, RC-16, RC-17, RC-18, RC-19. Read associated PRD state, flow, policy, migration and evaluation sections, not only the requirements table.

Prerequisites
Sprint 6 review/invalidation contract accepted; selected finding revisions and freshness helpers exist. Read sprint-01-foundation.md, sprint-05-reasoning.md and sprint-06-review.md. Do not substitute answer counts or legacy certified status for reviewed finding eligibility.

Actual baseline files to inspect
- src/lib/ai-service.ts
- src/lib/engine-guard.ts
- src/lib/engine-guard.test.ts
- src/lib/friction.ts
- src/app/api/research-kickoff/route.ts
- src/app/api/research-dialogue/route.ts
- src/app/api/interventions/[id]/responses/route.ts
- src/app/api/autocomplete/route.ts
- src/app/api/workspaces/[id]/syntheses/route.ts
- src/lib/research-jobs.ts
- scripts/research-worker.mjs
- src/components/cogdoc/editor-tiptap.tsx
- src/components/cogdoc/research-work-pane.tsx
- src/lib/document-content.ts
- src/lib/citation-insertion.ts
- src/lib/bibliography.ts
- src/lib/docx.ts
- src/app/api/projects/[id]/export/route.ts
- src/lib/extensions/citation-node.ts
- prisma/schema.prisma
Also inspect current files created by prerequisite sprints using their handoff paths. If a listed baseline file moved, locate its replacement with rg before editing.

Scope
Implement both optional article paths from selected current reviewed findings, with provenance and review-needed semantics. The user has explicitly accepted AI prose at this later stage. Do not reimpose the report's blanket ban or ask permission for the product policy again. Do not enable auto-publishing, grade guarantees or early research drafting.

Implementation tasks
1. Add article selection UI with eligible finding revisions, audience/purpose and visible uncertainty. Explain that the researcher may stop at findings or choose only a subset. Server-fetch all inputs and reject unreviewed, stale, archived, unknown or unowned selections before calling a provider.
2. Implement the manual path: editable outline linked to selected findings and an empty/human-written prose editor using existing Tiptap/citation infrastructure. Structural suggestions are explicit. This path must work with AI disabled and must not silently insert generated prose.
3. Implement the generated path as a separate article artifact and durable job. Pin an input manifest including finding/evidence/question/metadata revisions, policy/model/prompt versions and allowed reference IDs. Bound context; input-too-large errors offer a smaller selection instead of silently dropping uncertainty.
4. Generate grounded expression of selected findings. Preserve qualifications and conflicting evidence; allow an inconclusive article that states what is unknown. Require claim-to-input mapping and identify new bridging inferences as review concerns. Deterministically reject unknown citations/passages and preserve unresolved semantic support issues visibly. No invented source or unsupported factual claim may be treated as grounded merely because output JSON is valid.
5. Complete scoped policy migration across current prose-producing routes and jobs. Investigation remains assistive; legitimate article prose bypasses the old blanket paragraph heuristic only through server-validated article authorization. Friction/review pace and forged client modes cannot grant access. Legacy kickoff/dialogue drafting in collaborator mode directs users to finding/article selection; existing saved content remains readable.
6. Keep generated drafts review-needed until explicit researcher review of current article revision and concerns. Allow edit/remove/return-to-finding actions. Do not claim publishability or cognitive/academic/authorship certification. Preserve original human article edits; regeneration creates a new draft/version for comparison. Recheck/invalidate claim-to-evidence mappings when human edits change substantive statements; partial streaming output cannot be accepted as a completed article.
7. Check dependencies at generation request, worker completion, readiness acknowledgement and export. Upstream edits during generation or afterward mark only affected articles review-needed with reasons. Late/cancelled/retried jobs must not overwrite newer content or create duplicate artifacts.
8. Reuse export/citation/bibliography utilities for the selected article artifact instead of exporting the legacy project Document accidentally. Include actual current citations/locators and relevant draft/review-needed status. Provide explicit download; raw draft export may remain available with honest status. Do not invoke public certificate sharing or publication.
9. Update scoped policy documentation/comments and tests that would otherwise falsely assert all prose is forbidden. Preserve historical report source for Sprint 9's accurately described narrative update. Record compatibility behavior and concrete route coverage.

Observable acceptance criteria
- Both choices work from the same reviewed selection; the manual path makes no generation call.
- Direct API requests with unreviewed/foreign/stale IDs fail before provider execution; preliminary answers and legacy certificates do not grant eligibility.
- Generated output preserves source links/locators and uncertainty, flags new bridging inferences, and starts review-needed.
- Investigation endpoints cannot generate an article through a forged mode, while legitimate reviewed-finding article prose is not replaced by the old generic guard fallback.
- Changed selected finding/evidence invalidates dependent articles; unrelated changes do not. Change during generation or export is detected.
- Regeneration/retries/cancellation preserve human edits and newest revisions.
- Explicit export downloads the selected article with correct bibliography/status; nothing publishes or claims external acceptance.

Meaningful sprint-specific verification
Test policy matrix at API boundaries, every old draft route reachable from collaborator mode, malicious/unknown citation output, purely inconclusive input, lost uncertainty, stale generation completion, cancel/lease retry, human edit versus regeneration, selective invalidation and export of the right artifact. Perform a manual citation/locator round trip through Tiptap and DOCX/Markdown/HTML as supported. Mark mock versus live generation results and inspect at least one actual generated output if credentials are available.

Verification and deliverables
- Add meaningful unit/API/component or integration tests for the behaviors listed above, following the current test setup. Use real revision/ownership boundaries rather than implementation-mirroring assertions. Identify mocked versus live providers explicitly.
- Run relevant tests, lint/type/build checks for changed code, and the repository gate when the increment is ready. Inspect package.json and scripts/gate.sh for actual commands; record exact commands, outcomes, environment dependencies and pre-existing failures. Do not invent a pass, lower coverage thresholds, or call an unexecuted check passed.
- Rehearse any migration against representative disposable data; verify legacy IDs, document content hashes, citations, source links and audit history are preserved. If no schema change was needed, report that fact and the compatibility checks performed. Do not regenerate historical evidence to fit new terminology.
- Keep the increment demonstrable with saved state, clear empty/error/loading states and a manual recovery path. Report known limitations honestly. If a provider is unavailable, finish deterministic/manual behavior and list live checks separately.
- Deliver source changes and relevant tests plus a concise handoff in docs/refinement/handoffs/ for this sprint. Use the sprint-specific filename below. Include implemented requirement IDs, exact files/API/model changes, migrations and rehearsal evidence, commands/results, manual demo steps, unresolved regressions, feature-flag state, and precise prerequisites for the next sprint. Separate actual results from planned validation and distinguish blocking issues from documented defaults.
- Finish with a user-readable summary of what changed, why, how it was verified and any remaining risks. Do not continue into the next sprint automatically. Do not claim cognitive benefit, UAT success, academic acceptance or authorship certification from software tests.

Handoff filename: docs/refinement/handoffs/sprint-07-articles.md
```

### Sprint 8 — Integrated navigation accessibility privacy and recovery

```text
SPRINT 8: Integrated navigation accessibility privacy and recovery

You are implementing a bounded CogDoc refinement sprint in the checkout assigned to this task. The saved project is /Users/samreshan/Programming/cogdoc-workspace; if this task runs in an isolated worktree, make all implementation changes in that assigned worktree, not the saved project. Read applicable AGENTS.md files, inspect git status/diff, and preserve all existing user changes, including untracked implementation. Do not reset, clean, mass-format, replace lockfiles unnecessarily, or revert unrelated work. This repository was a dirty local checkout when the specification was written; inspect current code rather than assuming the documented baseline is unchanged.

Read docs/refinement/cogdoc-research-collaborator-prd.md in full and the relevant requirements below. Some docs/uploads are ignored and may be absent from a new worktree: use /Users/samreshan/Programming/cogdoc-workspace as a read-only reference source or locate moved files with rg --files --no-ignore. Never silently assume an isolated checkout contains the uncommitted baseline; compare required source files with the coordinator-provided starting state and report missing prerequisites. The PRD is the product contract; this prompt supplies this sprint's scope. CogDoc is a topic-first human-plus-AI research collaborator, not a multi-user editor. The primary outcome is structured findings linking question, conclusion, evidence/locators, the researcher's explanation, uncertainty, limitations and conflicting evidence. Inconclusive findings are valid. Research loops and branches; do not introduce a rigid wizard, answer-count/word-count comprehension gates, or idle-time passivity judgments. Reviewed means a particular revision was examined and explicitly accepted by the researcher, not AI-certified truth, authorship or understanding, and not completion of the whole investigation.

The confirmed generation policy deliberately evolves the original blanket non-generation rule: investigation supports thinking; a later optional stage permits BOTH an outline the researcher writes and an AI-generated article from selected current reviewed findings. No extra approval for that policy is needed. Article drafts preserve sources and uncertainty, flag new bridging inferences, become review-needed after dependent finding/evidence changes, and never publish automatically. Do not enable early prose generation merely because preliminary questions were answered. Keep original human explanations and existing documents intact.

Reuse Next.js/React/Tiptap, Prisma/PostgreSQL, existing source/library/evidence/auth/storage/job infrastructure and optional FastAPI retrieval. Inspect actual call sites and tests; comments and historical ADRs can be stale. Do not add a second app/framework or conflate SynthesisFinding, document Claim, legacy certification or AI satisfaction with reviewed research findings. Keep old work accessible and use additive migrations. Run migrations only against an identified disposable development/test database; never reset or migrate an unidentified live database. Do not deploy, publish, recruit/contact participants or modify unrelated product areas in this sprint.

Requirements: RC-20, RC-21, RC-28; integration verification of RC-10, RC-14, RC-18, RC-29. Read associated PRD state, flow, policy, migration and evaluation sections, not only the requirements table.

Prerequisites
Sprints 2–7 demonstrable, including both article paths and invalidation. Read all completed handoffs, especially sprint-07-articles.md. Do not use integration as permission to rebuild data models or remove legacy features destructively.

Actual baseline files to inspect
- src/components/cogdoc/dashboard.tsx
- src/components/cogdoc/editor-shell.tsx
- src/components/cogdoc/research-navigator.tsx
- src/components/cogdoc/research-work-pane.tsx
- src/components/cogdoc/research-inspector.tsx
- src/components/cogdoc/research-history.tsx
- src/components/cogdoc/workspace-home.tsx
- src/components/cogdoc/verification-workspace.tsx
- src/components/cogdoc/onboarding-tour.tsx
- src/components/cogdoc/review-pace-selector.tsx
- src/lib/store.ts
- src/lib/research-shortcuts.ts
- src/app/globals.css
- src/lib/private-storage.ts
- src/lib/auth-supabase.ts
- scripts/purge-deleted-workspaces.js
- src/app/api/workspaces/[id]/route.ts
Also inspect current files created by prerequisite sprints using their handoff paths. If a listed baseline file moved, locate its replacement with rg before editing.

Scope
Unify the already working increments into a comprehensible, substantially more polished and visually appealing collaborator experience. Simplify primary navigation and fix end-to-end accessibility, privacy and recovery gaps. The user prefers shadcn components for a clean look; the repository already has shadcn-compatible/Radix primitives in src/components/ui/, so reuse/refine them rather than migrate libraries. Implement the approved core reference at `/Users/samreshan/.codex/generated_images/01a070a2-eaee-7a01-a233-a5e8c06effff/exec-6384f8a5-de70-4082-be69-6223fe7abb51.png`: charcoal sidebar, light mineral workspace, restrained periwinkle/violet accents, legible refined type, source-and-reasoning workspace and a visible findings strip. The planning and findings extension images named in Usage and readiness are supporting references only. Record the core artifact/version in the handoff. Do not copy fictional depicted research content or add decorative dashboards, new research modes, real-time coauthoring or complexity to make the interface appear advanced.

Implementation tasks
1. Audit the actual complete journey and list competing primary entry points. Implement Investigate, Findings, Sources and optional Write & share (or documented equivalent wording). Show active question, saved state and durable findings near the conversation. A returning user should see where to continue.
2. Move notebook/annotations into source/question context, evidence map into finding details, references into source/article tools and history into secondary activity access. Preserve direct/legacy access and user data; do not delete backend concepts because they are no longer primary navigation.
3. Remove verification/certification language from the collaborator path and isolate legacy assignment tools in a secondary menu with accurate labels. A legacy certified project remains accessible without being treated as reviewed findings. No onboarding must force migration or rewrite existing documents.
4. Ensure every earlier sprint's screens share question selection, draft persistence, source links and review-state language. Fix stale panels, duplicated guidance and accidental navigation to the wrong artifact. Keep the manual no-AI journey first-class.
5. Test and fix keyboard operation, focus return, readable field labels, non-color status, error associations, live-region announcements, reduced motion, 200% zoom and narrow viewport behavior. Provide non-drag question reordering and preserve source/explanation/finding state when switching panels on mobile.
6. Check save failure, provider outage, zero sources, parsing, job cancellation, two-tab conflict, changed evidence and deleted workspace across integrated screens. Never show saved/success on failure. Make draft recovery scoped to authenticated user/workspace and purge it on relevant deletion/logout paths.
7. Explain selected content processing by AI and keep payloads minimal. Inspect logs/analytics for raw research text and remove unnecessary leakage in new functionality. Extend deletion/retention to new records and derived caches using existing policies; preserve allowed audit lineage without falsifying old hashes. Do not invent provider retention or compliance guarantees.
8. Update onboarding/help copy to explain findings, scoped review and optional articles in ordinary language. Do not make users learn engine names, chunk IDs, friction tiers or certificate mechanics to finish research.
9. Apply the approved core visual reference with deliberate typography, spacing, hierarchy, readable source content, findings presentation and coherent interaction states. Inspect existing src/components/ui/ primitives and extend their use consistently. Compare representative empty/populated/loading/error/review-needed and narrow-screen states against the approved core reference; test that polish preserves obvious primary actions and progressive disclosure. Treat the extension images as supporting consistency checks, not added requirements.
10. Produce a release-candidate walkthrough and record accessibility checks with actual results and remaining defects. Include visual comparison evidence and the selected reference/version; do not equate library usage or passing tests with visual quality.

Observable acceptance criteria
- The complete research journey requires no separate mandatory notebook/evidence-map/history/verification stages.
- Findings remain easy to find and inspect alongside investigation; article work remains optional.
- Legacy document/source/history access works with the new experience on or off, without content rewriting.
- Keyboard and narrow-screen users can plan, inspect evidence, explain, save/review findings, select article inputs and export with preserved focus/data.
- Save errors, stale evidence and failed jobs are accurately represented with recovery actions.
- New logs/analytics do not contain raw research text by default; new persisted/local data follows documented access/deletion behavior.
- The interface follows the approved core visual reference, with consistent typography/spacing/component states and readable evidence/findings. Visual polish introduces no extra mandatory workflow steps.
- Copy makes no claims of preventing cognitive atrophy, demonstrated comprehension or certified authorship.

Meaningful sprint-specific verification
Run the full integrated component/API journey plus focused keyboard/focus and storage/deletion tests. Manually inspect 200% zoom, narrow viewport, reduced motion and status announcements; distinguish actual assistive-technology checks from code inspection. Recheck legacy routes and both feature-flag states. Do not declare accessibility compliance from automated tests alone.

Verification and deliverables
- Add meaningful unit/API/component or integration tests for the behaviors listed above, following the current test setup. Use real revision/ownership boundaries rather than implementation-mirroring assertions. Identify mocked versus live providers explicitly.
- Run relevant tests, lint/type/build checks for changed code, and the repository gate when the increment is ready. Inspect package.json and scripts/gate.sh for actual commands; record exact commands, outcomes, environment dependencies and pre-existing failures. Do not invent a pass, lower coverage thresholds, or call an unexecuted check passed.
- Rehearse any migration against representative disposable data; verify legacy IDs, document content hashes, citations, source links and audit history are preserved. If no schema change was needed, report that fact and the compatibility checks performed. Do not regenerate historical evidence to fit new terminology.
- Keep the increment demonstrable with saved state, clear empty/error/loading states and a manual recovery path. Report known limitations honestly. If a provider is unavailable, finish deterministic/manual behavior and list live checks separately.
- Deliver source changes and relevant tests plus a concise handoff in docs/refinement/handoffs/ for this sprint. Use the sprint-specific filename below. Include implemented requirement IDs, exact files/API/model changes, migrations and rehearsal evidence, commands/results, manual demo steps, unresolved regressions, feature-flag state, and precise prerequisites for the next sprint. Separate actual results from planned validation and distinguish blocking issues from documented defaults.
- Finish with a user-readable summary of what changed, why, how it was verified and any remaining risks. Do not continue into the next sprint automatically. Do not claim cognitive benefit, UAT success, academic acceptance or authorship certification from software tests.

Handoff filename: docs/refinement/handoffs/sprint-08-integration.md
```

### Sprint 9 — Evaluation UAT demo and accurate academic reporting

```text
SPRINT 9: Evaluation UAT demo and accurate academic reporting

You are implementing a bounded CogDoc refinement sprint in the checkout assigned to this task. The saved project is /Users/samreshan/Programming/cogdoc-workspace; if this task runs in an isolated worktree, make all implementation changes in that assigned worktree, not the saved project. Read applicable AGENTS.md files, inspect git status/diff, and preserve all existing user changes, including untracked implementation. Do not reset, clean, mass-format, replace lockfiles unnecessarily, or revert unrelated work. This repository was a dirty local checkout when the specification was written; inspect current code rather than assuming the documented baseline is unchanged.

Read docs/refinement/cogdoc-research-collaborator-prd.md in full and the relevant requirements below. Some docs/uploads are ignored and may be absent from a new worktree: use /Users/samreshan/Programming/cogdoc-workspace as a read-only reference source or locate moved files with rg --files --no-ignore. Never silently assume an isolated checkout contains the uncommitted baseline; compare required source files with the coordinator-provided starting state and report missing prerequisites. The PRD is the product contract; this prompt supplies this sprint's scope. CogDoc is a topic-first human-plus-AI research collaborator, not a multi-user editor. The primary outcome is structured findings linking question, conclusion, evidence/locators, the researcher's explanation, uncertainty, limitations and conflicting evidence. Inconclusive findings are valid. Research loops and branches; do not introduce a rigid wizard, answer-count/word-count comprehension gates, or idle-time passivity judgments. Reviewed means a particular revision was examined and explicitly accepted by the researcher, not AI-certified truth, authorship or understanding, and not completion of the whole investigation.

The confirmed generation policy deliberately evolves the original blanket non-generation rule: investigation supports thinking; a later optional stage permits BOTH an outline the researcher writes and an AI-generated article from selected current reviewed findings. No extra approval for that policy is needed. Article drafts preserve sources and uncertainty, flag new bridging inferences, become review-needed after dependent finding/evidence changes, and never publish automatically. Do not enable early prose generation merely because preliminary questions were answered. Keep original human explanations and existing documents intact.

Reuse Next.js/React/Tiptap, Prisma/PostgreSQL, existing source/library/evidence/auth/storage/job infrastructure and optional FastAPI retrieval. Inspect actual call sites and tests; comments and historical ADRs can be stale. Do not add a second app/framework or conflate SynthesisFinding, document Claim, legacy certification or AI satisfaction with reviewed research findings. Keep old work accessible and use additive migrations. Run migrations only against an identified disposable development/test database; never reset or migrate an unidentified live database. Do not deploy, publish, recruit/contact participants or modify unrelated product areas in this sprint.

Requirements: RC-25, RC-26, RC-27, RC-30; release verification of all P0 requirements. Read associated PRD state, flow, policy, migration and evaluation sections, not only the requirements table.

Prerequisites
Sprint 8 integrated candidate ready and known defects listed. Read all handoffs. Access to raw questionnaire/interview/UAT records is needed only for claims based on them; absence does not block creating evaluation instruments or truthful reports. Participant recruitment/contact requires authorization.

Actual baseline files to inspect
- docs/refinement/cogdoc-research-collaborator-prd.md
- upload/Samreshan_Sahani_NP069749_Cogdoc_IR_Report (1) (1).docx
- docs/fyp/final-src/content_ch1.js
- docs/fyp/final-src/content_ch2.js
- docs/fyp/final-src/content_ch3.js
- docs/fyp/final-src/content_ch4.js
- docs/fyp/final-src/content_ch5.js
- docs/fyp/final-src/content_ch6.js
- docs/fyp/final-src/content_refs_appendices.js
- docs/fyp/final-src/generate.js
- docs/ADRs/0000-spec-vs-build-reconciliation.md
- docs/ADRs/0010-production-research-assistance-and-ux.md
- docs/deployment/release-readiness.md
- docs/implementation/research-demo.md
- scripts/research-demo-fixture.js
- scripts/seed-research-demo.js
- scripts/verify-research-demo.js
- scripts/gate.sh
- package.json
Also inspect current files created by prerequisite sprints using their handoff paths. If a listed baseline file moved, locate its replacement with rg before editing.

Scope
Evaluate and document the implemented refinement accurately. Build executable functional/AI evaluation fixtures, a reproducible demo, UAT instruments and a truthful academic narrative. Do not invent participant records, reuse old test counts as current, claim long-term efficacy, change the historical investigation report or deploy. If real UAT cannot be conducted, finish all independent materials and mark empirical results outstanding.

Implementation tasks
1. Reconcile every RC requirement with actual implementation and handoff evidence. Record implemented, tested, failed, deferred or unverified separately. Run current functional/build/gate checks in the available environment and report exact revision, commands, counts and failures. Historical Chapter 5 results are not current test evidence.
2. Create a versioned lawful corpus and AI evaluation harness covering supporting/contradictory/irrelevant passages, abstract-only content, false locators, missing sources, prompt injection, inconclusive findings, article bridging inferences and attempts to draft during investigation. Separate deterministic provenance/policy tests from live model semantic evaluation; record model/prompt/policy versions.
3. Define a human review rubric for evidence-to-conclusion fit, explanation specificity, uncertainty, conflicting evidence and meaningful revision. Record denominators, scoring guidance, examples and reviewer disagreements. Interaction counts or dwell time must not become learning scores.
4. Prepare a consent script, pseudonymous participant log, neutral task script, observation form, assistance/interruption log and post-task questions. Proposed first round is at least three intended users for formative feedback, not statistical efficacy. Cover topic/plan changes, source inspection, explanation, inconclusive finding, skipping guidance, review, both article paths and changed-source warning.
5. Conduct or analyze UAT only with authorized participants and actual records. Distinguish unassisted completion, assisted completion, failure and unattempted task. Report task time, errors/recovery, perceived interruption burden and user interpretation of reviewed. If no sessions occurred, explicitly keep UAT outstanding and deliver ready-to-run instruments; do not create fake result rows.
6. Reconcile the original investigation report's inconsistent questionnaire counts/percentages and interview completion language against raw records if provided. Record denominators/missingness and provenance. If absent, explain unresolved discrepancies and omit unreliable percentages. The 33-response preliminary questionnaire is requirements evidence, not efficacy or post-build acceptance.
7. Extend the labeled synthetic demo to show topic → question → source → researcher explanation → finding → explicit review, both article paths, and selective upstream invalidation. Inspect seed scripts before running and use a disposable demo database; never run a reset/seed against an unidentified database. Keep fixtures distinct from real participant data and real-world factual evidence.
8. Update relevant final-report source and reconciliation/ADR documentation to describe actual implemented scope and the deliberate policy change: thinking support during investigation and optional grounded prose after finding review. Remove unsupported earned/demonstrated understanding claims. Keep outstanding limitations explicit; update screenshots/results only from actual runs.
9. If regenerating a DOCX/report artifact, use the relevant document skill, render and inspect the result, and preserve unrelated report assets. Do not overwrite the historical uploaded investigation report. Do not update statistical charts from guessed corrections.
10. Produce a release decision note mapping P0 criteria to evidence, migration readiness, privacy/accessibility risks, known failures and remaining UAT status. Recommend next action without asserting deployment, academic acceptance or long-term cognitive improvement.

Observable acceptance criteria
- Requirement coverage shows actual evidence and all unexecuted/failed checks explicitly.
- Current software results are reproducible and distinguish mocked/live AI evaluation.
- UAT materials are complete; any participant results have real provenance/consent records, otherwise the report clearly says outstanding.
- Questionnaire discrepancies and interview status are reconciled with raw records or transparently unresolved; no unverified percentages are asserted as fact.
- Demo demonstrates the full finding-first journey, both article paths and changed-input warnings with labeled fixtures.
- Academic narrative states the scoped generation evolution and separates requirements, functional correctness, usability and unproven long-term cognition.

Meaningful sprint-specific verification
Run evaluation harness and actual repository checks; manually execute the demo and inspect exported citations/locators. Validate report links/requirements and any generated artifact layout. Do not count a planned participant session as completed or a synthetic fixture as user evidence. Record exact environment blockers without stopping independent documentation work.

Verification and deliverables
- Add meaningful unit/API/component or integration tests for the behaviors listed above, following the current test setup. Use real revision/ownership boundaries rather than implementation-mirroring assertions. Identify mocked versus live providers explicitly.
- Run relevant tests, lint/type/build checks for changed code, and the repository gate when the increment is ready. Inspect package.json and scripts/gate.sh for actual commands; record exact commands, outcomes, environment dependencies and pre-existing failures. Do not invent a pass, lower coverage thresholds, or call an unexecuted check passed.
- Rehearse any migration against representative disposable data; verify legacy IDs, document content hashes, citations, source links and audit history are preserved. If no schema change was needed, report that fact and the compatibility checks performed. Do not regenerate historical evidence to fit new terminology.
- Keep the increment demonstrable with saved state, clear empty/error/loading states and a manual recovery path. Report known limitations honestly. If a provider is unavailable, finish deterministic/manual behavior and list live checks separately.
- Deliver source changes and relevant tests plus a concise handoff in docs/refinement/handoffs/ for this sprint. Use the sprint-specific filename below. Include implemented requirement IDs, exact files/API/model changes, migrations and rehearsal evidence, commands/results, manual demo steps, unresolved regressions, feature-flag state, and precise prerequisites for the next sprint. Separate actual results from planned validation and distinguish blocking issues from documented defaults.
- Finish with a user-readable summary of what changed, why, how it was verified and any remaining risks. Do not continue into the next sprint automatically. Do not claim cognitive benefit, UAT success, academic acceptance or authorship certification from software tests.

Handoff filename: docs/refinement/handoffs/sprint-09-evaluation.md
```

## Requirement ownership check

| Requirement IDs | Primary sprint | Later verification |
| --- | --- | --- |
| RC-01, RC-24 | 1 | Migration/data-preservation regressions throughout; 9 release reconciliation |
| RC-22 | Post-prototype hardening | Complete before release; preserve existing protections during prototype |
| RC-02, RC-03, RC-04 | 2 | 3 first journey; 8 integration; 9 UAT |
| RC-06, RC-07, RC-09, RC-11, RC-12 minimum acceptance, RC-29 | 3 | 4 source extension; 5 assistance; 6 review hardening; 8 recovery |
| RC-05, RC-08 | 4 | 9 source/AI evaluation |
| RC-10, RC-23 | 5 | 7 policy; 8 interruption controls; 9 semantic evaluation |
| RC-12 hardening, RC-13, RC-14 | 6 | 7 article eligibility/invalidation; 9 transition tests |
| RC-15, RC-16, RC-17, RC-18, RC-19 | 7 | 8 integration; 9 output traceability |
| RC-20, RC-21, RC-28 | 8 | 9 usability and release review |
| RC-25, RC-26, RC-27, RC-30 | 9 | Explicit follow-up if participant evidence remains outstanding |

## Blocking decisions versus defaults

The canonical pair uses RC-01–RC-30; do not mix requirement IDs or handoff names from the superseded isolated draft. Its useful locator/review/control details have been incorporated. No unresolved product decision blocks Sprint 1. The confirmed scoped generation decision is settled. Proposed defaults for English text, individual use, three-source recommendation batches, one contextual concern, navigation wording and manual video fallback are sufficient to implement and later test.

Final visual styling has an approved core input: `/Users/samreshan/.codex/generated_images/01a070a2-eaee-7a01-a233-a5e8c06effff/exec-6384f8a5-de70-4082-be69-6223fe7abb51.png`. It does not block foundations or the first functional journey; Sprint 8 applies it after the underlying journey works. Actual operational blockers include: inability to identify a safe development/test database blocks migration execution; missing prerequisite models/revision contracts block dependent sprint code; inaccessible raw survey or participant records block claims based on those records; absent provider credentials block live provider validation only. Record these precisely. Continue independent code, deterministic tests, manual behavior or evaluation materials where useful. Do not ask the user to decide routine schema names or reapprove the article policy.

For an isolated-worktree dispatch, start from the saved working tree including the existing user changes, or explicitly transfer its required files before implementation. Commit or otherwise transfer the two canonical documents from the saved project: ignored files do not appear in worktrees automatically. The documentation task stages only these two files for durable inclusion; it does not commit unrelated changes. Baseline commit 9bcb1b8 alone is insufficient to reproduce the inspected code.

The initial coordinator dispatch should contain the complete Sprint 1 block above and request the named handoff before the next sprint. The optional second task is the read-only audit block. Later implementation must follow actual completed handoffs, not assume these prompts themselves prove readiness.
