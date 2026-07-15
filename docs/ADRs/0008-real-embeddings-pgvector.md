# ADR-0008: Real embeddings + pgvector

- **Status:** Accepted (partial — see "Remaining")
- **Date:** 2026-07-15
- **Sprint:** P4 (gap #5)

## Context

Live retrieval used SQLite keyword-overlap; the FastAPI service used
`HashingEmbedder` (an MD5 hash trick) + an in-memory store. The eval ablation
ran on this surrogate, so the headline scientific result (vector retrieval beats
keyword) was not yet measured on a trained embedder.

## Decision

1. **Embedder.** Add `GeminiEmbedder` behind the existing `Embedder` Protocol.
   Uses `gemini-embedding-001` (the GA model; `text-embedding-004` is
   deprecated/unavailable for many keys) emitting **3072-dim** vectors via the
   Generative Language API (`embedContent`). `HashingEmbedder` stays the default
   so tests/offline dev stay hermetic.

2. **Store.** Add `PgvectorStore` implementing the same `VectorStoreBase`
   interface (ingest/retrieve/list_chunks). Retrieval uses pgvector's cosine
   distance `<=>`, scoped `WHERE "projectId" = $1` so it never leaks across
   users/projects. psycopg is imported lazily so the hermetic path needs no
   dependency. Project-scoped + HNSW-indexed.

3. **Env selection.** `create_app_from_env()` picks embedder + store from
   `EMBEDDING_PROVIDER` / `GEMINI_API_KEY` / `SUPABASE_DB_URL`. This is the
   single env-reading seam in the service.

4. **Migration.** A raw SQL migration (`migrations/0001_pdfchunk_embedding_pgvector.sql`)
   adds `embedding vector(3072)` + an HNSW `vector_cosine_ops` index + a nullable
   `pdfFilename` column. Managed as raw SQL (not Prisma) because Prisma's vector
   support is limited.

## Recorded eval ablation numbers (re-run on real embeddings)

Ground-truth: 8 passages, 9 claims. Verdict classifier: heuristic (no LLM).

| Metric | Surrogate (Hashing dim=256) | Real (gemini-embedding-001, 3072) |
|---|---|---|
| Vector Recall@5 (supported) | 1.00 | **1.00** |
| Keyword Recall@5 (supported) | 1.00 | 1.00 |
| Recall@5 delta (pp) | 0.0 | 0.0 |
| Vector macro-F1 (verdict) | 0.432 | **0.25** |

### Finding — the verdict similarity-floor needs re-calibration for real embeddings

Real embeddings produce high baseline cosine similarity for *everything*
(0.73–0.75 even for unrelated distractor claims like "The Eiffel Tower is in
Tokyo"), so the `similarity_floor=0.30` calibrated for the hashing surrogate is
too low. The heuristic verdict provider mislabels distractors as
`partially_supported` instead of `insufficient_evidence`, dropping macro-F1.

**Retrieval is excellent** (perfect Recall@5). The verdict **threshold** is what
needs tuning — a real-embeddings floor around 0.80 (not 0.30) is indicated.
This is a genuine research finding: switching to real embeddings requires
re-calibrating the verdict guard, not just the retriever.

## Remaining (partial)

- **Live pgvector round-trip not verified in this environment.** This sandbox
  blocks outbound Postgres ports (5432/6543) — the direct/pooler Supabase
  connections time out. The `PgvectorStore` is unit-tested via a mocked cursor
  (SQL shape, project-scoping, `<=>` operator, HNSW) and the adapter is
  production-ready. To activate: apply the SQL migration via the Supabase
  Dashboard SQL editor, set `EMBEDDING_PROVIDER=gemini` + `SUPABASE_DB_URL` +
  `GEMINI_API_KEY`, and the live `TestPgvectorStoreLive` round-trip will run.
- The verdict `similarity_floor` re-calibration (0.30 → ~0.80 for real
  embeddings) is a follow-up tuning task, recorded here.
