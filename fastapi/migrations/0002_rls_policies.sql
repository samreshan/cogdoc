-- ADR Phase 6 (gap #7): Row-Level Security for multi-user isolation.
--
-- Enables RLS + per-table USING (userId = auth.uid()) policies on every
-- user-scoped table so cross-user access is blocked at the database layer.
-- Applies to Supabase Postgres only (RLS doesn't exist on SQLite). Run in the
-- Supabase Dashboard SQL editor.
--
-- Prerequisite: users sign in via @supabase/ssr (the Login UI). auth.uid()
-- resolves to the authenticated user's id, which matches the userId columns.
--
-- Idempotent: safe to re-run.

-- 1. Enable RLS on all user-scoped tables.
ALTER TABLE "Project" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Document" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Pdf" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PdfChunk" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Intervention" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InterventionEvidence" ENABLE ROW LEVEL SECURITY;

-- 2. Project — a user sees only their own projects.
DROP POLICY IF EXISTS "projects_owner_all" ON "Project";
CREATE POLICY "projects_owner_all" ON "Project"
  FOR ALL USING ("userId" = auth.uid()) WITH CHECK ("userId" = auth.uid());

-- 3. Document — one per project, scoped via the project's userId.
DROP POLICY IF EXISTS "documents_owner_all" ON "Document";
CREATE POLICY "documents_owner_all" ON "Document"
  FOR ALL
  USING (EXISTS (SELECT 1 FROM "Project" p WHERE p.id = "Document"."projectId" AND p."userId" = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM "Project" p WHERE p.id = "Document"."projectId" AND p."userId" = auth.uid()));

-- 4. Pdf — scoped via the project's userId.
DROP POLICY IF EXISTS "pdfs_owner_all" ON "Pdf";
CREATE POLICY "pdfs_owner_all" ON "Pdf"
  FOR ALL
  USING (EXISTS (SELECT 1 FROM "Project" p WHERE p.id = "Pdf"."projectId" AND p."userId" = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM "Project" p WHERE p.id = "Pdf"."projectId" AND p."userId" = auth.uid()));

-- 5. PdfChunk — scoped via Pdf → Project's userId. Includes the embedding
--    column (ADR-0008): retrieval is project-scoped AND user-scoped.
DROP POLICY IF EXISTS "pdfchunks_owner_all" ON "PdfChunk";
CREATE POLICY "pdfchunks_owner_all" ON "PdfChunk"
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM "Pdf" f
    JOIN "Project" p ON p.id = f."projectId"
    WHERE f.id = "PdfChunk"."pdfId" AND p."userId" = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "Pdf" f
    JOIN "Project" p ON p.id = f."projectId"
    WHERE f.id = "PdfChunk"."pdfId" AND p."userId" = auth.uid()
  ));

-- 6. Intervention — a user sees only their own interventions.
DROP POLICY IF EXISTS "interventions_owner_all" ON "Intervention";
CREATE POLICY "interventions_owner_all" ON "Intervention"
  FOR ALL USING ("userId" = auth.uid()) WITH CHECK ("userId" = auth.uid());

-- 7. InterventionEvidence — scoped via Intervention's userId.
DROP POLICY IF EXISTS "intervention_evidence_owner_all" ON "InterventionEvidence";
CREATE POLICY "intervention_evidence_owner_all" ON "InterventionEvidence"
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM "Intervention" i WHERE i.id = "InterventionEvidence"."interventionId" AND i."userId" = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "Intervention" i WHERE i.id = "InterventionEvidence"."interventionId" AND i."userId" = auth.uid()
  ));

-- Note: when EMBEDDING_PROVIDER=gemini, the FastAPI service writes PdfChunk
-- rows via the PgvectorStore using a service-role connection (bypassing RLS).
-- That's intentional for server-side ingest; the BFF's user-scoped queries
-- still enforce RLS on reads. Ensure the FastAPI service uses the service-role
-- key (not the publishable key) for its connection.
