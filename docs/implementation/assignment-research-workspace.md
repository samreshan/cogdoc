# Assignment and research workspace implementation

This update turns the legacy Project editor into a student-facing Workspace while preserving the physical `Project` table for migration safety.

## Shipped product flow

- Dashboard entry points: New Assignment, New Research Workspace, and Import DOCX.
- Optional deadline/context setup; rubric, sources, and code remain skippable.
- Workspace Home with document/source/code/review/certificate status and DOCX compatibility warnings.
- Tiptap editor with 1.5-second optimistic autosave, IndexedDB recovery, explicit offline/recovery/conflict states, and base-revision conflict handling.
- Rapid, Guided, and Deep review pace. The pace changes interruption cadence, never certificate invariants.
- Persistent Critical / Improve / Completed action queue with a three-item critical preview.
- Harvard/APA author-date parsing, citation/reference pairing, DOI registry lookup, metadata confirmation, claim risk classification, evidence candidates, and student-confirmed passage/code links.
- Risk-weighted comprehension responses that are recorded in the audit trail and never inserted into the assignment.
- Semantic DOCX import and normalized academic DOCX export. The original upload is retained privately and compatibility degradation is disclosed.
- Static ZIP inspection with traversal, symlink, nested archive/macro, secret, dependency, binary, file-count, compressed-size, and extracted-size defenses. Archives are never executed.
- Immutable document versions, reports, hash-chained audit events, Ed25519 certificate payloads, QR PDFs, revocable private shares, exact local DOCX comparison, supersession, and 30-day retention cleanup.

## Certificate invariants

`process_verified` is produced only when all of the following are true for one immutable version:

1. Every in-text citation is paired with a bibliography entry.
2. Every cited reference has high-confidence registry metadata or an explicit student confirmation.
3. Direct quotations have a locator.
4. Section-central, direct-quotation, numerical, and causal claims have either a student-confirmed source passage classified as supported, or a student-confirmed code range/test artifact where the gate is link traceability rather than semantic correctness.
5. The required comprehension sample is complete.
6. Every blocking review item is resolved by the appropriate invariant action; a generic note cannot bypass structural or evidence checks.
7. The mutable document hash still matches the reviewed version.
8. The append-only audit-event hash chain passes integrity verification.

The signed payload independently binds the canonical document hash, report hash, normalized DOCX hash, and captured code-snapshot hashes. It explicitly disclaims authorship, AI-free writing, correctness, originality, legal-signature status, and institutional approval.

## Database and deployment

- `prisma/schema.prisma` is the canonical PostgreSQL schema.
- `prisma/migrations/202608220001_assignment_research_workspace/migration.sql` upgrades the legacy PostgreSQL schema. Fresh environments can use `prisma db push`; existing deployments should back up and apply the reviewed migration.
- `fastapi/migrations/0003_workspace_rls.sql` enables ownership policies for the new tables and makes audit events append-only for authenticated users.
- `scripts/migrate-legacy-workspaces.js` maps old projects to Research workspaces, maps assistant/coach/socratic to Rapid/Guided/Deep, and records legacy interventions as audit events.
- `scripts/purge-deleted-workspaces.js` is intended for a daily scheduler and removes workspaces past 30 days after writing certificate revocation tombstones.
- Docker persists an Ed25519 key in `/data` when an operator-provided key is absent.

## Operational boundaries

The code implements the usable vertical slice and its security/integrity boundaries. These rollout activities still require deployment infrastructure or human research and cannot be completed by a repository change alone:

- deploy a continuously running Postgres-backed analysis worker; the current review request persists runs and versions but executes the deterministic first pass inside the request;
- connect an organization-approved malware scanner for uploaded originals (archive structural defenses are already enforced);
- provision private Supabase Storage and apply its bucket policy;
- schedule retention cleanup and key-rotation operations;
- build and label the 50-file DOCX, 300-example citation, claim-entailment, and tamper corpora;
- conduct incident interviews, accessibility/usability sessions, the consented pilot, load exercises, and statistical acceptance evaluation;
- keep certificate issuance feature-flagged until those external thresholds pass.

## Validation completed in this repository

- Prisma schema validation succeeds.
- Strict TypeScript validation succeeds; Next no longer ignores type errors.
- The optimized Next.js production build succeeds.
- The complete Vitest suite passes, including new review parsing, canonical document, archive safety, URL isolation, certificate signing/tampering, and exact-hash tests.
- The FastAPI test suite passes; two environment-dependent tests remain explicitly skipped.
