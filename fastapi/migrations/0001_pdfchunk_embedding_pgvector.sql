-- ADR-0008: pgvector migration for real embeddings.
--
-- Adds a vector(3072) column to PdfChunk (gemini-embedding-001 emits 3072-dim),
-- enables the pgvector extension, and builds an HNSW cosine index. Manage via
-- raw SQL because Prisma's vector support is limited (the column is declared
-- Unsupported in schema.postgres.prisma). Run this in the Supabase SQL editor.
--
-- NOTE: the camelCase column names ("projectId", "pdfId", "pageApprox") match
-- Prisma's Postgres mapping. The "PdfChunk" table name is Prisma's model name.
--
-- Idempotent: safe to re-run (IF NOT EXISTS / OR REPLACE).

-- 1. Enable pgvector (Supabase ships it; CREATE EXTENSION needs the role).
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Add the embedding column (3072-dim to match gemini-embedding-001).
ALTER TABLE "PdfChunk"
  ADD COLUMN IF NOT EXISTS embedding vector(3072);

-- 3. HNSW index with cosine ops for fast ANN retrieval (§11.2).
--    Project-scoping happens at query time (WHERE "projectId" = $1); a
--    composite partial index could be added later if a single project grows
--    large. The global HNSW is the right starting point for the corpus size.
CREATE INDEX IF NOT EXISTS pdfchunk_embedding_hnsw_cosine
  ON "PdfChunk"
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 4. pdfFilename is referenced by the PgvectorStore retrieve query but the
--    in-memory store derives it from pdf_id. Add a nullable column so the
--    query works; a JOIN to "Pdf".filename is the production-correct source.
ALTER TABLE "PdfChunk"
  ADD COLUMN IF NOT EXISTS "pdfFilename" text;
