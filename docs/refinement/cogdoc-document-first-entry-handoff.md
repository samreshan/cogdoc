# CogDoc document-first entry lane handoff

Date: 5 September 2026

Branch: `codex/document-first-entry`

Worktree: `/Users/samreshan/.codex/worktrees/07f4/cogdoc-workspace`

## Completed scope

- Home uses the charcoal, cool-mineral, white-paper, and violet direction with Geist-compatible typography.
- Start research is an inline topic form. A non-empty topic creates a real research workspace and blank document immediately.
- Goal, prior understanding, and citation style are optional. `Not sure` is accepted without a word-count or answer-count gate.
- Topic and optional context use the existing workspace and investigation APIs. No early draft, source discovery, or plan provider runs at entry.
- A failure to persist optional investigation context does not block the created document. A workspace creation failure keeps all entered text in the form for retry.
- Recent projects resume the actual editor through `setActiveProject` and `setView('editor')` and support real client-side title/description search.
- DOCX import still uses the existing import pipeline and opens the hydrated document. A partially completed import keeps the created project instead of deleting potentially imported content.
- Deletion keeps the existing 30-day recovery behavior and confirmation.
- Home includes explicit loading, list error/retry, empty, filtered-empty, import, open, and delete states.
- Login, authentication loading/setup error, and the optional guide use the same visual language.
- The guide no longer auto-opens. It is manually invoked from Home and does not overlay the editor.

## Removed entry behavior

- Four-word topic minimum.
- Mandatory three-question kickoff.
- Minimum three-section outline.
- Automatic source discovery and citation insertion before writing.
- Automatic generated document scaffold before the user reaches the editor.
- Automatic first-run modal tour.

## Files

- `src/app/page.tsx`
- `src/components/cogdoc/dashboard.tsx`
- `src/components/cogdoc/login.tsx`
- `src/components/cogdoc/auth-gate-state.tsx`
- `src/components/cogdoc/onboarding-tour.tsx`
- `src/components/cogdoc/research-kickoff.tsx`
- `src/components/cogdoc/research-kickoff.test.tsx`
- `src/components/cogdoc/citation-style-controls.test.tsx`

## Verification

- `npm test -- --run src/components/cogdoc/research-kickoff.test.tsx src/components/cogdoc/citation-style-controls.test.tsx`: 2 files, 8 tests passed.
- `npx eslint` on all changed TypeScript/TSX files: passed.
- `npx tsc --noEmit`: passed.
- `git diff --check`: passed.
- No schema or database changes were made. No AI, discovery, retrieval, or live provider was called.

The isolated checkout did not contain `node_modules` or the ignored `src/test/setup.ts` required by `vitest.config.ts`. Verification reused the saved checkout's existing dependency directory through a temporary local symlink and recreated the one-line ignored setup file. These are not part of the commit.

## Integration contract

- The editor-shell lane remains responsible for making the real Tiptap document the default mounted workspace.
- A newly created project has the existing blank `Document` record at revision 0.
- Research context is saved with `api.saveInvestigation(projectId, { topic, purpose, existingUnderstanding })` on a best-effort basis after document creation.
- Investigation-plan assistance is deliberately deferred to the workspace. Entry never calls `planResearchKickoff`, `proposeInvestigationPlan`, `findSources`, or `draftResearchKickoff`.
- Existing imports, projects, documents, citations, auth configuration, and recovery semantics are preserved.

## Known limits for combined verification

- Browser screenshots and end-to-end create/import/resume checks should run after the editor-shell and contextual-dock lanes are integrated, so they exercise the actual combined launch surface.
- The host had 7.1 GiB free during this lane. No Docker or full production build was run.
- If workspace creation succeeds server-side but its HTTP response is lost, the existing create endpoint has no client-supplied idempotency contract. The UI prevents duplicate clicks and reuses a received workspace for downstream retries, but transport-level create idempotency remains a shared API concern.
