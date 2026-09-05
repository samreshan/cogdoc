-- Private research-library and IDE data must remain owner scoped even if a
-- browser receives a Supabase token with direct table access.
ALTER TABLE "LibrarySource" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WorkspaceSource" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ResearchNote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SourceAnnotation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ResearchAction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GroundedSynthesis" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SynthesisFinding" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SynthesisFindingPassage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AcademicProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ResearchJob" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "librarysource_owner_all" ON "LibrarySource" FOR ALL
  USING ("userId" = auth.uid()::text)
  WITH CHECK ("userId" = auth.uid()::text);

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['WorkspaceSource', 'ResearchNote', 'SourceAnnotation', 'ResearchAction', 'GroundedSynthesis', 'ResearchJob']
  LOOP
    EXECUTE format('CREATE POLICY %I ON %I FOR ALL USING (EXISTS (SELECT 1 FROM "Project" p WHERE p.id = %I."projectId" AND p."userId" = auth.uid()::text)) WITH CHECK (EXISTS (SELECT 1 FROM "Project" p WHERE p.id = %I."projectId" AND p."userId" = auth.uid()::text))', lower(table_name) || '_owner_all', table_name, table_name, table_name);
  END LOOP;
END $$;

CREATE POLICY "synthesisfinding_owner_all" ON "SynthesisFinding" FOR ALL
  USING (EXISTS (SELECT 1 FROM "GroundedSynthesis" s JOIN "Project" p ON p.id = s."projectId" WHERE s.id = "SynthesisFinding"."synthesisId" AND p."userId" = auth.uid()::text))
  WITH CHECK (EXISTS (SELECT 1 FROM "GroundedSynthesis" s JOIN "Project" p ON p.id = s."projectId" WHERE s.id = "SynthesisFinding"."synthesisId" AND p."userId" = auth.uid()::text));

CREATE POLICY "synthesispassage_owner_all" ON "SynthesisFindingPassage" FOR ALL
  USING (EXISTS (SELECT 1 FROM "SynthesisFinding" f JOIN "GroundedSynthesis" s ON s.id = f."synthesisId" JOIN "Project" p ON p.id = s."projectId" WHERE f.id = "SynthesisFindingPassage"."findingId" AND p."userId" = auth.uid()::text))
  WITH CHECK (EXISTS (SELECT 1 FROM "SynthesisFinding" f JOIN "GroundedSynthesis" s ON s.id = f."synthesisId" JOIN "Project" p ON p.id = s."projectId" WHERE f.id = "SynthesisFindingPassage"."findingId" AND p."userId" = auth.uid()::text));

CREATE POLICY "academicprofile_owner_all" ON "AcademicProfile" FOR ALL
  USING ("userId" = auth.uid()::text AND ("projectId" IS NULL OR EXISTS (SELECT 1 FROM "Project" p WHERE p.id = "AcademicProfile"."projectId" AND p."userId" = auth.uid()::text)))
  WITH CHECK ("userId" = auth.uid()::text AND ("projectId" IS NULL OR EXISTS (SELECT 1 FROM "Project" p WHERE p.id = "AcademicProfile"."projectId" AND p."userId" = auth.uid()::text)));
