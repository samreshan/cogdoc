-- Cogdoc production security hardening for Supabase Postgres.
--
-- Apply after 0002_rls_policies.sql and 0003_workspace_rls.sql. This migration:
--   * enables RLS on every Prisma application table;
--   * prevents child/link rows from crossing workspace boundaries;
--   * keeps user provisioning, prompt templates, and revocation tombstones
--     service-role-only;
--   * creates the private Cogdoc Storage bucket; and
--   * explicitly denies anon/authenticated browser access to that bucket.
--
-- The Next.js BFF and ingest worker use trusted database/service-role
-- credentials and must still scope every request by the acting user. Do not
-- FORCE ROW LEVEL SECURITY: server-side Prisma connections do not set
-- auth.uid(), and Supabase's service role must retain its documented bypass.
--
-- Supabase-only and idempotent. Run through the Supabase SQL editor or CLI,
-- never against the plain local-development Postgres image.

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Project" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WorkspaceAsset" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Document" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Requirement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DocumentVersion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Pdf" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PdfChunk" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Reference" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Citation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Claim" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EvidenceLink" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReviewRun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReviewItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReviewResponse" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CodeSnapshot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CodeFile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VerificationReport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Certificate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ShareGrant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CertificateRevocationTombstone" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Intervention" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InterventionEvidence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PromptTemplate" ENABLE ROW LEVEL SECURITY;

-- Browser clients can read only their own profile. Profile provisioning and
-- mutations remain BFF/service-role operations so a browser cannot increase
-- its token budget or change protected account fields directly.
DROP POLICY IF EXISTS "users_self_select" ON "User";
CREATE POLICY "users_self_select" ON "User" FOR SELECT
  USING (id = auth.uid()::text);

DROP POLICY IF EXISTS "projects_owner_all" ON "Project";
CREATE POLICY "projects_owner_all" ON "Project" FOR ALL
  USING ("userId" = auth.uid()::text)
  WITH CHECK ("userId" = auth.uid()::text);

DROP POLICY IF EXISTS "documents_owner_all" ON "Document";
CREATE POLICY "documents_owner_all" ON "Document" FOR ALL
  USING (EXISTS (
    SELECT 1 FROM "Project" p
    WHERE p.id = "Document"."projectId" AND p."userId" = auth.uid()::text
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "Project" p
    WHERE p.id = "Document"."projectId" AND p."userId" = auth.uid()::text
  ));

DROP POLICY IF EXISTS "workspaceasset_owner_all" ON "WorkspaceAsset";
CREATE POLICY "workspaceasset_owner_all" ON "WorkspaceAsset" FOR ALL
  USING (EXISTS (
    SELECT 1 FROM "Project" p
    WHERE p.id = "WorkspaceAsset"."projectId" AND p."userId" = auth.uid()::text
  ))
  WITH CHECK (
    "storageKey" LIKE "WorkspaceAsset"."projectId" || '/%'
    AND EXISTS (
      SELECT 1 FROM "Project" p
      WHERE p.id = "WorkspaceAsset"."projectId" AND p."userId" = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "requirement_owner_all" ON "Requirement";
CREATE POLICY "requirement_owner_all" ON "Requirement" FOR ALL
  USING (EXISTS (
    SELECT 1 FROM "Project" p
    WHERE p.id = "Requirement"."projectId" AND p."userId" = auth.uid()::text
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "Project" p
    WHERE p.id = "Requirement"."projectId" AND p."userId" = auth.uid()::text
  ));

DROP POLICY IF EXISTS "documentversion_owner_all" ON "DocumentVersion";
CREATE POLICY "documentversion_owner_all" ON "DocumentVersion" FOR ALL
  USING (EXISTS (
    SELECT 1 FROM "Project" p
    WHERE p.id = "DocumentVersion"."projectId" AND p."userId" = auth.uid()::text
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "Project" p
    WHERE p.id = "DocumentVersion"."projectId" AND p."userId" = auth.uid()::text
  ));

DROP POLICY IF EXISTS "pdfs_owner_all" ON "Pdf";
CREATE POLICY "pdfs_owner_all" ON "Pdf" FOR ALL
  USING (
    "userId" = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM "Project" p
      WHERE p.id = "Pdf"."projectId" AND p."userId" = auth.uid()::text
    )
  )
  WITH CHECK (
    "userId" = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM "Project" p
      WHERE p.id = "Pdf"."projectId" AND p."userId" = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "pdfchunks_owner_all" ON "PdfChunk";
CREATE POLICY "pdfchunks_owner_all" ON "PdfChunk" FOR ALL
  USING (EXISTS (
    SELECT 1 FROM "Pdf" f
    JOIN "Project" p ON p.id = f."projectId"
    WHERE f.id = "PdfChunk"."pdfId"
      AND f."userId" = auth.uid()::text
      AND p."userId" = auth.uid()::text
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "Pdf" f
    JOIN "Project" p ON p.id = f."projectId"
    WHERE f.id = "PdfChunk"."pdfId"
      AND f."userId" = auth.uid()::text
      AND p."userId" = auth.uid()::text
  ));

DROP POLICY IF EXISTS "reference_owner_all" ON "Reference";
CREATE POLICY "reference_owner_all" ON "Reference" FOR ALL
  USING (EXISTS (
    SELECT 1 FROM "Project" p
    WHERE p.id = "Reference"."projectId" AND p."userId" = auth.uid()::text
  ))
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "Project" p
      WHERE p.id = "Reference"."projectId" AND p."userId" = auth.uid()::text
    )
    AND (
      "sourceId" IS NULL OR EXISTS (
        SELECT 1 FROM "Pdf" f
        WHERE f.id = "Reference"."sourceId"
          AND f."projectId" = "Reference"."projectId"
          AND f."userId" = auth.uid()::text
      )
    )
  );

DROP POLICY IF EXISTS "claim_owner_all" ON "Claim";
CREATE POLICY "claim_owner_all" ON "Claim" FOR ALL
  USING (EXISTS (
    SELECT 1 FROM "Project" p
    WHERE p.id = "Claim"."projectId" AND p."userId" = auth.uid()::text
  ))
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "Project" p
      WHERE p.id = "Claim"."projectId" AND p."userId" = auth.uid()::text
    )
    AND EXISTS (
      SELECT 1 FROM "DocumentVersion" d
      WHERE d.id = "Claim"."documentVersionId" AND d."projectId" = "Claim"."projectId"
    )
  );

DROP POLICY IF EXISTS "citation_owner_all" ON "Citation";
CREATE POLICY "citation_owner_all" ON "Citation" FOR ALL
  USING (EXISTS (
    SELECT 1 FROM "Project" p
    WHERE p.id = "Citation"."projectId" AND p."userId" = auth.uid()::text
  ))
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "Project" p
      WHERE p.id = "Citation"."projectId" AND p."userId" = auth.uid()::text
    )
    AND EXISTS (
      SELECT 1 FROM "DocumentVersion" d
      WHERE d.id = "Citation"."documentVersionId" AND d."projectId" = "Citation"."projectId"
    )
    AND (
      "referenceId" IS NULL OR EXISTS (
        SELECT 1 FROM "Reference" r
        WHERE r.id = "Citation"."referenceId" AND r."projectId" = "Citation"."projectId"
      )
    )
    AND (
      "claimId" IS NULL OR EXISTS (
        SELECT 1 FROM "Claim" c
        WHERE c.id = "Citation"."claimId" AND c."projectId" = "Citation"."projectId"
      )
    )
  );

DROP POLICY IF EXISTS "evidence_links_owner_all" ON "EvidenceLink";
CREATE POLICY "evidence_links_owner_all" ON "EvidenceLink" FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "Claim" c
      JOIN "Project" p ON p.id = c."projectId"
      WHERE c.id = "EvidenceLink"."claimId" AND p."userId" = auth.uid()::text
    )
    AND (
      "pdfChunkId" IS NULL OR EXISTS (
        SELECT 1 FROM "Claim" c
        JOIN "PdfChunk" pc ON pc.id = "EvidenceLink"."pdfChunkId"
        JOIN "Pdf" f ON f.id = pc."pdfId" AND f."projectId" = c."projectId"
        WHERE c.id = "EvidenceLink"."claimId" AND f."userId" = auth.uid()::text
      )
    )
    AND (
      "codeFileId" IS NULL OR EXISTS (
        SELECT 1 FROM "Claim" c
        JOIN "CodeFile" cf ON cf.id = "EvidenceLink"."codeFileId"
        JOIN "CodeSnapshot" s ON s.id = cf."codeSnapshotId" AND s."projectId" = c."projectId"
        WHERE c.id = "EvidenceLink"."claimId"
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "Claim" c
      JOIN "Project" p ON p.id = c."projectId"
      WHERE c.id = "EvidenceLink"."claimId" AND p."userId" = auth.uid()::text
    )
    AND (
      "pdfChunkId" IS NULL OR EXISTS (
        SELECT 1 FROM "Claim" c
        JOIN "PdfChunk" pc ON pc.id = "EvidenceLink"."pdfChunkId"
        JOIN "Pdf" f ON f.id = pc."pdfId" AND f."projectId" = c."projectId"
        WHERE c.id = "EvidenceLink"."claimId" AND f."userId" = auth.uid()::text
      )
    )
    AND (
      "codeFileId" IS NULL OR EXISTS (
        SELECT 1 FROM "Claim" c
        JOIN "CodeFile" cf ON cf.id = "EvidenceLink"."codeFileId"
        JOIN "CodeSnapshot" s ON s.id = cf."codeSnapshotId" AND s."projectId" = c."projectId"
        WHERE c.id = "EvidenceLink"."claimId"
      )
    )
  );

DROP POLICY IF EXISTS "reviewrun_owner_all" ON "ReviewRun";
CREATE POLICY "reviewrun_owner_all" ON "ReviewRun" FOR ALL
  USING (EXISTS (
    SELECT 1 FROM "Project" p
    WHERE p.id = "ReviewRun"."projectId" AND p."userId" = auth.uid()::text
  ))
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "Project" p
      WHERE p.id = "ReviewRun"."projectId" AND p."userId" = auth.uid()::text
    )
    AND EXISTS (
      SELECT 1 FROM "DocumentVersion" d
      WHERE d.id = "ReviewRun"."documentVersionId" AND d."projectId" = "ReviewRun"."projectId"
    )
  );

DROP POLICY IF EXISTS "reviewitem_owner_all" ON "ReviewItem";
CREATE POLICY "reviewitem_owner_all" ON "ReviewItem" FOR ALL
  USING (EXISTS (
    SELECT 1 FROM "Project" p
    WHERE p.id = "ReviewItem"."projectId" AND p."userId" = auth.uid()::text
  ))
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "Project" p
      WHERE p.id = "ReviewItem"."projectId" AND p."userId" = auth.uid()::text
    )
    AND EXISTS (
      SELECT 1 FROM "ReviewRun" r
      WHERE r.id = "ReviewItem"."reviewRunId" AND r."projectId" = "ReviewItem"."projectId"
    )
    AND (
      "claimId" IS NULL OR EXISTS (
        SELECT 1 FROM "Claim" c
        WHERE c.id = "ReviewItem"."claimId" AND c."projectId" = "ReviewItem"."projectId"
      )
    )
  );

DROP POLICY IF EXISTS "review_responses_owner_all" ON "ReviewResponse";
CREATE POLICY "review_responses_owner_all" ON "ReviewResponse" FOR ALL
  USING (
    "userId" = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM "ReviewItem" i
      JOIN "Project" p ON p.id = i."projectId"
      WHERE i.id = "ReviewResponse"."reviewItemId" AND p."userId" = auth.uid()::text
    )
  )
  WITH CHECK (
    "userId" = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM "ReviewItem" i
      JOIN "Project" p ON p.id = i."projectId"
      WHERE i.id = "ReviewResponse"."reviewItemId" AND p."userId" = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "audits_owner_all" ON "AuditEvent";
DROP POLICY IF EXISTS "audits_owner_select" ON "AuditEvent";
DROP POLICY IF EXISTS "audits_owner_insert" ON "AuditEvent";
CREATE POLICY "audits_owner_select" ON "AuditEvent" FOR SELECT
  USING (
    "userId" = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM "Project" p
      WHERE p.id = "AuditEvent"."projectId" AND p."userId" = auth.uid()::text
    )
  );
CREATE POLICY "audits_owner_insert" ON "AuditEvent" FOR INSERT
  WITH CHECK (
    "userId" = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM "Project" p
      WHERE p.id = "AuditEvent"."projectId" AND p."userId" = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "codesnapshot_owner_all" ON "CodeSnapshot";
CREATE POLICY "codesnapshot_owner_all" ON "CodeSnapshot" FOR ALL
  USING (EXISTS (
    SELECT 1 FROM "Project" p
    WHERE p.id = "CodeSnapshot"."projectId" AND p."userId" = auth.uid()::text
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "Project" p
    WHERE p.id = "CodeSnapshot"."projectId" AND p."userId" = auth.uid()::text
  ));

DROP POLICY IF EXISTS "code_files_owner_all" ON "CodeFile";
CREATE POLICY "code_files_owner_all" ON "CodeFile" FOR ALL
  USING (EXISTS (
    SELECT 1 FROM "CodeSnapshot" s
    JOIN "Project" p ON p.id = s."projectId"
    WHERE s.id = "CodeFile"."codeSnapshotId" AND p."userId" = auth.uid()::text
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "CodeSnapshot" s
    JOIN "Project" p ON p.id = s."projectId"
    WHERE s.id = "CodeFile"."codeSnapshotId" AND p."userId" = auth.uid()::text
  ));

DROP POLICY IF EXISTS "verificationreport_owner_all" ON "VerificationReport";
CREATE POLICY "verificationreport_owner_all" ON "VerificationReport" FOR ALL
  USING (EXISTS (
    SELECT 1 FROM "Project" p
    WHERE p.id = "VerificationReport"."projectId" AND p."userId" = auth.uid()::text
  ))
  WITH CHECK (
    "createdById" = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM "Project" p
      WHERE p.id = "VerificationReport"."projectId" AND p."userId" = auth.uid()::text
    )
    AND EXISTS (
      SELECT 1 FROM "DocumentVersion" d
      WHERE d.id = "VerificationReport"."documentVersionId"
        AND d."projectId" = "VerificationReport"."projectId"
    )
  );

DROP POLICY IF EXISTS "certificate_owner_all" ON "Certificate";
CREATE POLICY "certificate_owner_all" ON "Certificate" FOR ALL
  USING (EXISTS (
    SELECT 1 FROM "Project" p
    WHERE p.id = "Certificate"."projectId" AND p."userId" = auth.uid()::text
  ))
  WITH CHECK (
    "createdById" = auth.uid()::text
    AND ("docxStorageKey" IS NULL OR "docxStorageKey" LIKE "Certificate"."projectId" || '/%')
    AND ("pdfStorageKey" IS NULL OR "pdfStorageKey" LIKE "Certificate"."projectId" || '/%')
    AND EXISTS (
      SELECT 1 FROM "Project" p
      WHERE p.id = "Certificate"."projectId" AND p."userId" = auth.uid()::text
    )
    AND EXISTS (
      SELECT 1 FROM "VerificationReport" r
      WHERE r.id = "Certificate"."reportId" AND r."projectId" = "Certificate"."projectId"
    )
    AND EXISTS (
      SELECT 1 FROM "DocumentVersion" d
      WHERE d.id = "Certificate"."documentVersionId" AND d."projectId" = "Certificate"."projectId"
    )
  );

DROP POLICY IF EXISTS "share_grants_owner_all" ON "ShareGrant";
CREATE POLICY "share_grants_owner_all" ON "ShareGrant" FOR ALL
  USING (EXISTS (
    SELECT 1 FROM "Certificate" c
    JOIN "Project" p ON p.id = c."projectId"
    WHERE c.id = "ShareGrant"."certificateId" AND p."userId" = auth.uid()::text
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "Certificate" c
    JOIN "Project" p ON p.id = c."projectId"
    WHERE c.id = "ShareGrant"."certificateId" AND p."userId" = auth.uid()::text
  ));

DROP POLICY IF EXISTS "interventions_owner_all" ON "Intervention";
CREATE POLICY "interventions_owner_all" ON "Intervention" FOR ALL
  USING (
    "userId" = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM "Project" p
      WHERE p.id = "Intervention"."projectId" AND p."userId" = auth.uid()::text
    )
  )
  WITH CHECK (
    "userId" = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM "Project" p
      WHERE p.id = "Intervention"."projectId" AND p."userId" = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "intervention_evidence_owner_all" ON "InterventionEvidence";
CREATE POLICY "intervention_evidence_owner_all" ON "InterventionEvidence" FOR ALL
  USING (EXISTS (
    SELECT 1 FROM "Intervention" i
    JOIN "PdfChunk" pc ON pc.id = "InterventionEvidence"."chunkId"
    JOIN "Pdf" f ON f.id = pc."pdfId" AND f."projectId" = i."projectId"
    WHERE i.id = "InterventionEvidence"."interventionId"
      AND i."userId" = auth.uid()::text
      AND f."userId" = auth.uid()::text
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "Intervention" i
    JOIN "PdfChunk" pc ON pc.id = "InterventionEvidence"."chunkId"
    JOIN "Pdf" f ON f.id = pc."pdfId" AND f."projectId" = i."projectId"
    WHERE i.id = "InterventionEvidence"."interventionId"
      AND i."userId" = auth.uid()::text
      AND f."userId" = auth.uid()::text
  ));

-- No anon/authenticated policies are created for PromptTemplate or
-- CertificateRevocationTombstone. With RLS enabled they are service-role-only.

-- Provision and continually reassert the private storage bucket settings.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'cogdoc-private',
  'cogdoc-private',
  false,
  52428800,
  ARRAY[
    'application/pdf',
    'application/zip',
    'application/x-zip-compressed',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Policies are OR-combined by default. A RESTRICTIVE policy is deliberately
-- used so an unrelated future permissive policy cannot expose this bucket to
-- the browser roles. service_role bypasses RLS and remains the only data path.
DROP POLICY IF EXISTS "cogdoc_private_service_only" ON storage.objects;
CREATE POLICY "cogdoc_private_service_only" ON storage.objects
  AS RESTRICTIVE FOR ALL TO anon, authenticated
  USING (bucket_id <> 'cogdoc-private')
  WITH CHECK (bucket_id <> 'cogdoc-private');
