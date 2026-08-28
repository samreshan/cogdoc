# Release readiness and acceptance

This checklist is the authoritative release handoff for Cogdoc. It separates
repository evidence from deployment checks and human evaluation. Passing the
automated suite proves the covered software contracts; it does not prove that a
particular deployment is secure, accessible, usable, or educationally effective.

## Release posture

| Target | Current posture | Required evidence |
|---|---|---|
| Local development or supervised demonstration | Ready after the automated gate and setup smoke test pass | Commands in this document |
| Private single-user installation | Conditional | Private network boundary, backups, retention job, upload controls, and operator smoke test |
| Shared authenticated pilot | Not ready by code checks alone | Supabase Auth/RLS/storage verification, malware scanning, recovery and provider-failover exercises, accessibility/usability sessions |
| Public or institutional release | No-go until external gates pass | Shared-pilot evidence plus privacy/legal review, load testing, incident procedures, and consented learning-outcome evaluation |

`COGDOC_SINGLE_USER_MODE=1` is only for a private one-person installation. It
must never be used to make a shared deployment appear ready.

## Automated repository gate

Run from a clean checkout with the intended lockfile:

```bash
npm ci
npm test
npm run lint
npx tsc --noEmit
npm run build
git diff --check
```

At the 2026-08-28 checkpoint, the gate passed with 67 Vitest files and 484
tests. Later releases must record their own output instead of relying on that
historical count.

The automated suite covers these production-critical contracts:

| Contract | Representative evidence |
|---|---|
| Underline matching and accessible decoration attributes | `src/lib/sentence-highlight.test.ts`, `src/lib/extensions/intervention-highlight.test.ts` |
| Hover/focus intervention dialog and named actions | `src/components/cogdoc/sentence-popover.test.tsx` |
| Grouped right-pane overview, passage navigation, and action persistence | `src/components/cogdoc/action-queue.test.tsx`, `src/lib/editor-focus.test.ts` |
| Selection-aware formatting and source search | `src/components/cogdoc/editor-toolbar.test.tsx`, `src/components/cogdoc/sources-results.test.tsx` |
| OpenAlex/Crossref/Semantic Scholar failover and CSL metadata | `src/app/api/find-sources/route.test.ts` |
| Reference verification, style changes, and author-controlled reference lists | `src/app/api/references-route.test.ts`, `src/app/api/workspace-settings-route.test.ts`, `src/components/cogdoc/research-library.test.tsx` |
| First-login onboarding and tutorial replay | `src/components/cogdoc/onboarding-tour.test.tsx`, `src/app/api/misc-routes.test.ts` |
| Local/hosted assistant configuration and degraded status | `src/lib/ai-service.test.ts`, `src/components/cogdoc/assistant-status.test.tsx` |
| Structured normalized academic DOCX output | `src/lib/docx.test.ts`, `src/app/api/projects/[id]/export/route.test.ts` |
| Authentication, ownership, private assets, reports, and certificate integrity | Full API/security/certificate test suites and `scripts/verify-security-policies.js` |

## Environment and database acceptance

1. Copy `.env.example` to the deployment environment and supply secrets through
   the platform secret store, not a committed file.
2. Start PostgreSQL with pgvector and create the extension before schema push:

   ```bash
   docker compose -f docker-compose.dev.yml up -d postgres
   docker compose -f docker-compose.dev.yml exec -T postgres \
     psql -U cogdoc -d cogdoc -c 'CREATE EXTENSION IF NOT EXISTS vector;'
   npm run db:push
   npm run seed
   ```

3. For a shared deployment, follow
   [Production authentication, RLS, and private storage](security.md), apply all
   migrations in order, then run `npm run security:verify` against the deployed
   Supabase database.
4. Confirm `/api/auth/config` returns only the public Supabase URL and
   publishable key. Database, service-role, JWT, storage, and AI secrets must not
   appear in the browser, response body, or logs.
5. Verify the private asset bucket, backup restore procedure, certificate key
   persistence/rotation, and scheduled `npm run cleanup:retention` operation.

## Research-provider acceptance

Configure courteous contact identities even where anonymous access works:

```env
OPENALEX_API_KEY="optional-free-key"
OPENALEX_MAILTO="research@example.org"
CROSSREF_MAILTO="research@example.org"
SEMANTIC_SCHOLAR_API_KEY="optional-free-key"
UNPAYWALL_EMAIL="research@example.org"
```

Exercise each condition and retain redacted logs:

1. OpenAlex returns scholarly records and the interface names OpenAlex.
2. OpenAlex is unavailable or empty and Crossref returns records.
3. OpenAlex and Crossref are unavailable or empty and Semantic Scholar returns
   records.
4. A DOI has a legal open-access location and the interface labels the access
   provider separately from the metadata provider.
5. Gemini returns 429 or is unconfigured while scholarly-index search remains
   usable.
6. Every result opens the original record, and every displayed reference warns
   the author to verify authors, date, venue, DOI, and locators.

Provider quotas are external state. A model-list readiness check is not proof
that completion quota remains available.

## Assistant acceptance

For hosted testing, configure Gemini through existing `AI_*`/`GEMINI_*`
variables. For local inference:

```bash
ollama pull qwen3:8b
ollama serve
```

```env
AI_PROVIDER="ollama"
AI_BASE_URL="http://127.0.0.1:11434/v1"
AI_MODEL="qwen3:8b"
```

Confirm Assistant status distinguishes ready, quota-limited, unavailable, and
unreachable states without returning secrets. Run fixed academic-integrity,
latency, prompt-injection, and non-generation evaluations on the exact hosted or
local model before enabling it for a pilot. Model substitution requires a new
evaluation record.

## Manual interaction and accessibility script

Run at desktop and narrow viewport sizes with keyboard-only input, VoiceOver or
NVDA, reduced motion, and 200% zoom. Record browser/assistive-technology versions
and defects.

1. A first-time account receives onboarding; completing or skipping it persists,
   and Tutorial reopens it from every authenticated view.
2. Create Assignment and Research workspaces, choose APA and Harvard, import a
   DOCX, and recover an interrupted draft.
3. Tab to an intervention underline. Its accessible label announces the count;
   focus, Enter, and Space expose the same intervention dialog as hover/click.
4. Use the grouped Action queue to locate a passage in a long document. Confirm
   focus, selection, scrolling, stale-anchor messaging, Mark addressed, and
   Dismiss.
5. Select text across inline formatting, start Find sources in one action, open
   the original, save metadata, upload a lawful PDF, and link a supporting
   passage.
6. Operate every formatting command, undo/redo, tables, autosave, offline
   recovery, and conflict resolution without a mouse.
7. Change citation style and inspect the reported reformatted/manual-review
   counts. Copy one reference and the alphabetized saved-reference list.
8. Export DOCX and inspect it in supported Word/LibreOffice versions for margins,
   font, spacing, headings, links, tables, quotations, code, and page numbers.
9. Run review, resolve a blocking issue through its required action, generate a
   report, and verify that certificates remain unavailable for stale or failing
   snapshots.

Automated DOM tests do not replace this assistive-technology pass.

## Upload, recovery, and operations gates

Before a shared pilot:

- connect an organization-approved malware scanner for uploaded PDF, DOCX, and
  ZIP files;
- test maximum-size, corrupt, encrypted, malicious, and decompression-bomb
  fixtures without executing uploads;
- test database, private-object, and certificate-key backup restoration;
- schedule retention cleanup and monitor failed jobs;
- run concurrent autosave/conflict, source-provider failover, AI quota, process
  restart, database outage, and storage outage exercises;
- define alerts, incident ownership, key rotation, dependency patching, and
  rollback criteria;
- run load tests using representative document/source sizes and concurrency.

## SDG 4 claim boundary

Cogdoc is designed to support research literacy, source evaluation, independent
argumentation, and transparent revision, which aligns the product with SDG 4.
Do not claim measured educational impact, equitable outcomes, authorship proof,
plagiarism detection, detector evasion, correctness, or institutional approval.
Those claims require appropriately consented, representative evaluation and
independent review.

The release owner signs off only when every gate required for the intended
target is supported by current evidence. Missing evidence is a failed gate, not
an assumption of success.
