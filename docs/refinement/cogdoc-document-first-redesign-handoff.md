# CogDoc document-first redesign handoff

Date: 5 September 2026

Branch: `codex/document-first-redesign`

Worktree: `/Users/samreshan/.codex/worktrees/4096/cogdoc-workspace`

## Delivered scope

- Reframed Home around a topic-first **Start writing** action, with optional goal/prior-context fields, direct resume/import, truthful loading/error states, and no automatic onboarding interruption.
- Replaced the research-screen switcher with a document-primary workspace: a compact charcoal project rail, permanently mounted Tiptap document, one contextual dock, focus mode, responsive mobile tool navigation, secondary History/References views, and a source reader.
- Added the canonical typed collaborator boundary in `src/lib/document-collaborator-contract.ts` and a thin document workspace adapter in `src/lib/document-workspace-contract.ts`.
- Added explicit document-selection identity using project, document, revision, range, exact text, and a SHA-256 text fingerprint.
- Removed automatic sentence, paragraph, and idle interventions from the editor. **Ask CogDoc** and **Find sources** now act only on explicit user intent.
- Added collaborator, sources, findings, plan, and share/article sections that remain mounted after first visit. Context chips include only the active question, current selection, and sources the researcher chose.
- Added preview-before-apply document proposals with stale-revision and stale-selection rejection; collaborator proposals never silently edit the document.
- Preserved source access/provenance distinctions and verified citation insertion. The source reader labels extracted PDF page locations as approximate.
- Added the collaborator API/client/service path and additive nullable `ResearchExchange.questionId` migration at `prisma/migrations/202609050002_document_collaborator/migration.sql`.
- Unified the runtime visual language around charcoal, cool mineral, white paper, restrained violet, readable editorial typography, visible focus, and reduced-motion handling.

The product and interaction contract is documented in `docs/refinement/cogdoc-document-first-redesign.md`.

## Verification evidence

- `npm test`: **128 files passed, 697 tests passed**. Vitest prints harmless refused `localhost:3000` fetch diagnostics from mocked UI tests; exit status is 0.
- `./node_modules/.bin/tsc --noEmit`: passed.
- Targeted ESLint over the changed shell/editor/Home/contract files: passed.
- `git diff --check`: passed.
- `npm run build`: passed with Next.js 16.3.3, including the new `/api/workspaces/[id]/collaborator` route.
- Production browser smoke check at `http://localhost:3000`: confirmed the configured single-user landing page renders the new document-first entry, topic field, optional context, import action, recent-documents area, and optional guide.

## Verification boundaries

- Docker was intentionally left stopped. PostgreSQL at `localhost:5432` was therefore unavailable, so browser verification could not create/resume a project or exercise the authenticated document workspace against live data.
- The additive Prisma migration was reviewed and build-tested but **not applied**.
- No database was reset or reseeded. No Docker image, volume, or cache was pruned.
- AI/provider behavior is covered by deterministic/mocked tests; no live-provider UAT was claimed.
- Final responsive, keyboard, citation, stale-proposal, failure-recovery, and live-provider acceptance remains manual UAT for the user after services are restored.
- No merge, push, deploy, or main-worktree change was performed.

## Launch and UAT

From this worktree, restore the project's normal environment and database services using the repository's established procedure. Then:

1. Apply the additive Prisma migration using the team's normal deployment/migration workflow.
2. Run `npm ci` if dependencies are absent, followed by `npm run build` and `npm start` (or `npm run dev` for local iteration).
3. Exercise create, import, resume, refresh, selection-to-collaborator, explicit proposal preview/apply, stale proposal rejection, source passage/citation, finding review/insertion, export/article, mobile return path, keyboard focus, and failure recovery.
4. Verify a real configured AI provider separately from the deterministic fallback.

## Integration history

- `74d1170` — document-first product/interaction contract
- `a637c33` — document-primary shell and editor
- `7a893d3` — topic-first Home and onboarding integration
- `5c95b50` — workspace tokens and test setup
- `24317bd` — contextual research dock, API, service, and migration
- `f14b43f` — controlled dock navigation while preserving mounted panels

The final verification/test-alignment commit follows these integration commits. Preserve the user-owned untracked `system-visualizer.html` and `walkthrough.md` when integrating.
