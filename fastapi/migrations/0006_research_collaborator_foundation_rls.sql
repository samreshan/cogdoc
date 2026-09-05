-- Baseline ownership policy for the additive research collaborator domain.
-- The API still validates every nested relation before writes; these policies
-- keep direct Supabase access scoped to the owning workspace.
ALTER TABLE "ResearchContext" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ResearchQuestion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "QuestionResource" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ResearchExchange" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ResearchFinding" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FindingRevision" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FindingEvidence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FindingReview" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ResearchArticle" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ArticleInput" ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'ResearchContext', 'ResearchQuestion', 'QuestionResource', 'ResearchExchange',
    'ResearchFinding', 'FindingRevision', 'FindingEvidence', 'FindingReview',
    'ResearchArticle', 'ArticleInput'
  ]
  LOOP
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL USING (EXISTS (SELECT 1 FROM "Project" p WHERE p.id = %I."projectId" AND p."userId" = auth.uid()::text)) WITH CHECK (EXISTS (SELECT 1 FROM "Project" p WHERE p.id = %I."projectId" AND p."userId" = auth.uid()::text))',
      lower(table_name) || '_owner_all', table_name, table_name, table_name
    );
  END LOOP;
END $$;
