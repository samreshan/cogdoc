-- Cogdoc workspace/review/certificate RLS policies.
-- Apply after Prisma has created the v1 workspace tables. Idempotent.

ALTER TABLE "WorkspaceAsset" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Requirement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DocumentVersion" ENABLE ROW LEVEL SECURITY;
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

-- Tables carrying projectId share the same ownership predicate.
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'WorkspaceAsset', 'Requirement', 'DocumentVersion', 'Reference', 'Citation',
    'Claim', 'ReviewRun', 'ReviewItem', 'CodeSnapshot', 'VerificationReport', 'Certificate'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', lower(table_name) || '_owner_all', table_name);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL USING (EXISTS (SELECT 1 FROM "Project" p WHERE p.id = %I."projectId" AND p."userId" = auth.uid()::text)) WITH CHECK (EXISTS (SELECT 1 FROM "Project" p WHERE p.id = %I."projectId" AND p."userId" = auth.uid()::text))',
      lower(table_name) || '_owner_all', table_name, table_name, table_name
    );
  END LOOP;
END $$;

DROP POLICY IF EXISTS "evidence_links_owner_all" ON "EvidenceLink";
CREATE POLICY "evidence_links_owner_all" ON "EvidenceLink" FOR ALL
  USING (EXISTS (SELECT 1 FROM "Claim" c JOIN "Project" p ON p.id = c."projectId" WHERE c.id = "EvidenceLink"."claimId" AND p."userId" = auth.uid()::text))
  WITH CHECK (EXISTS (SELECT 1 FROM "Claim" c JOIN "Project" p ON p.id = c."projectId" WHERE c.id = "EvidenceLink"."claimId" AND p."userId" = auth.uid()::text));

DROP POLICY IF EXISTS "review_responses_owner_all" ON "ReviewResponse";
CREATE POLICY "review_responses_owner_all" ON "ReviewResponse" FOR ALL
  USING (EXISTS (SELECT 1 FROM "ReviewItem" i JOIN "Project" p ON p.id = i."projectId" WHERE i.id = "ReviewResponse"."reviewItemId" AND p."userId" = auth.uid()::text))
  WITH CHECK (EXISTS (SELECT 1 FROM "ReviewItem" i JOIN "Project" p ON p.id = i."projectId" WHERE i.id = "ReviewResponse"."reviewItemId" AND p."userId" = auth.uid()::text));

DROP POLICY IF EXISTS "code_files_owner_all" ON "CodeFile";
CREATE POLICY "code_files_owner_all" ON "CodeFile" FOR ALL
  USING (EXISTS (SELECT 1 FROM "CodeSnapshot" s JOIN "Project" p ON p.id = s."projectId" WHERE s.id = "CodeFile"."codeSnapshotId" AND p."userId" = auth.uid()::text))
  WITH CHECK (EXISTS (SELECT 1 FROM "CodeSnapshot" s JOIN "Project" p ON p.id = s."projectId" WHERE s.id = "CodeFile"."codeSnapshotId" AND p."userId" = auth.uid()::text));

DROP POLICY IF EXISTS "share_grants_owner_all" ON "ShareGrant";
CREATE POLICY "share_grants_owner_all" ON "ShareGrant" FOR ALL
  USING (EXISTS (SELECT 1 FROM "Certificate" c JOIN "Project" p ON p.id = c."projectId" WHERE c.id = "ShareGrant"."certificateId" AND p."userId" = auth.uid()::text))
  WITH CHECK (EXISTS (SELECT 1 FROM "Certificate" c JOIN "Project" p ON p.id = c."projectId" WHERE c.id = "ShareGrant"."certificateId" AND p."userId" = auth.uid()::text));

-- Audit events are append-only for authenticated users: no UPDATE or DELETE policy.
DROP POLICY IF EXISTS "audits_owner_all" ON "AuditEvent";
DROP POLICY IF EXISTS "audits_owner_select" ON "AuditEvent";
DROP POLICY IF EXISTS "audits_owner_insert" ON "AuditEvent";
CREATE POLICY "audits_owner_select" ON "AuditEvent" FOR SELECT
  USING (EXISTS (SELECT 1 FROM "Project" p WHERE p.id = "AuditEvent"."projectId" AND p."userId" = auth.uid()::text));
CREATE POLICY "audits_owner_insert" ON "AuditEvent" FOR INSERT
  WITH CHECK ("userId" = auth.uid()::text AND EXISTS (SELECT 1 FROM "Project" p WHERE p.id = "AuditEvent"."projectId" AND p."userId" = auth.uid()::text));

-- Object storage remains private. The BFF uses service-role signed access;
-- no browser-readable storage.objects policy is intentionally created here.
