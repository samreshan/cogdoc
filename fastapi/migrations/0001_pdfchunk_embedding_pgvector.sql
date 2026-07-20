-- ADR-0008: pgvector migration for real embeddings.
--
-- Enables the pgvector extension and adds a vector(3072) column to PdfChunk
-- (gemini-embedding-001 emits 3072-dim). Managed via raw SQL because Prisma's
-- vector support is limited (the column is declared Unsupported in
-- schema.postgres.prisma). Run in the Supabase SQL editor or via psql.
--
-- NOTE: the camelCase identifiers ("PdfChunk") match Prisma's Postgres
-- mapping. Project scoping + filename are NOT denormalised onto PdfChunk —
-- the PgvectorStore JOINs "Pdf" (Pdf.projectId / Pdf.filename), matching the
-- actual Prisma schema.
--
-- INDEXING: no ANN index yet, deliberately. pgvector caps hnsw/ivfflat
-- indexes at 2000 dimensions, and this column is 3072 — a plain
--   CREATE INDEX ... USING hnsw (embedding vector_cosine_ops)
-- fails. Exact scan is correct and fast at the current corpus scale; the
-- retrieval stress test (PRODUCT.md S4, future work) can add a half-precision
-- expression index if needed, with the matching cast in the query:
--   CREATE INDEX pdfchunk_embedding_hnsw_halfvec
--     ON "PdfChunk" USING hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops);
--
-- Idempotent: safe to re-run (IF NOT EXISTS).

-- 1. Enable pgvector (Supabase ships it; CREATE EXTENSION needs the role).
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Add the embedding column (3072-dim to match gemini-embedding-001).
ALTER TABLE "PdfChunk"
  ADD COLUMN IF NOT EXISTS embedding vector(3072);
