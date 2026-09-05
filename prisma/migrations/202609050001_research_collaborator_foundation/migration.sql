-- Research collaborator foundation. This is additive: legacy Project,
-- Document, Claim, SynthesisFinding, audit, certificate and source rows stay
-- untouched. Existing work only opts into the new experience through its flag.

CREATE TABLE "ResearchContext" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "topic" TEXT NOT NULL DEFAULT '',
  "purpose" TEXT,
  "existingUnderstanding" TEXT,
  "scope" TEXT,
  "selectedQuestionId" TEXT,
  "lifecycleState" TEXT NOT NULL DEFAULT 'exploring',
  "revision" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ResearchContext_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ResearchQuestion" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "contextId" TEXT NOT NULL,
  "parentId" TEXT,
  "wording" TEXT NOT NULL,
  "rationale" TEXT,
  "state" TEXT NOT NULL DEFAULT 'open',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ResearchQuestion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QuestionResource" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "workspaceSourceId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'evidence_candidate',
  "rationale" TEXT,
  "rationaleBasis" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "QuestionResource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ResearchFinding" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "disposition" TEXT NOT NULL DEFAULT 'tentative',
  "reviewState" TEXT NOT NULL DEFAULT 'draft',
  "currentRevision" INTEGER NOT NULL DEFAULT 0,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ResearchFinding_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FindingRevision" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "findingId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "conclusion" TEXT,
  "researcherExplanation" TEXT,
  "uncertainty" TEXT,
  "limitations" TEXT,
  "conflicts" TEXT,
  "evidenceUnavailable" BOOLEAN NOT NULL DEFAULT false,
  "evidenceScope" TEXT,
  "contentHash" TEXT NOT NULL,
  "origin" TEXT NOT NULL DEFAULT 'researcher',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FindingRevision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FindingEvidence" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "findingRevisionId" TEXT NOT NULL,
  "workspaceSourceId" TEXT,
  "passageId" TEXT,
  "sourceFingerprint" TEXT,
  "contentFingerprint" TEXT,
  "excerpt" TEXT,
  "locatorType" TEXT,
  "locatorValue" TEXT,
  "locatorPrecision" TEXT,
  "acquisition" TEXT NOT NULL DEFAULT 'workspace_source',
  "role" TEXT NOT NULL DEFAULT 'supports',
  "interpretation" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FindingEvidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FindingReview" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "findingRevisionId" TEXT NOT NULL,
  "reviewerId" TEXT NOT NULL,
  "decision" TEXT NOT NULL,
  "dependencyHash" TEXT NOT NULL,
  "note" TEXT,
  "commandKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FindingReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ResearchArticle" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "contextId" TEXT NOT NULL,
  "title" TEXT,
  "path" TEXT NOT NULL,
  "content" TEXT NOT NULL DEFAULT '',
  "revision" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'outline',
  "generationStatus" TEXT,
  "policyVersion" TEXT,
  "commandKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ResearchArticle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ArticleInput" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "articleId" TEXT NOT NULL,
  "findingId" TEXT NOT NULL,
  "findingRevisionId" TEXT NOT NULL,
  "dependencyHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ArticleInput_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ResearchExchange" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "findingRevisionId" TEXT,
  "speaker" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "origin" TEXT NOT NULL DEFAULT 'researcher',
  "referencedIdsJson" TEXT NOT NULL DEFAULT '[]',
  "operation" TEXT,
  "modelVersion" TEXT,
  "promptVersion" TEXT,
  "commandKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ResearchExchange_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ResearchContext_projectId_key" ON "ResearchContext"("projectId");
CREATE INDEX "ResearchContext_projectId_lifecycleState_idx" ON "ResearchContext"("projectId", "lifecycleState");
CREATE INDEX "ResearchQuestion_projectId_state_sortOrder_idx" ON "ResearchQuestion"("projectId", "state", "sortOrder");
CREATE INDEX "ResearchQuestion_contextId_parentId_idx" ON "ResearchQuestion"("contextId", "parentId");
CREATE UNIQUE INDEX "QuestionResource_questionId_workspaceSourceId_key" ON "QuestionResource"("questionId", "workspaceSourceId");
CREATE INDEX "QuestionResource_projectId_questionId_idx" ON "QuestionResource"("projectId", "questionId");
CREATE INDEX "QuestionResource_projectId_workspaceSourceId_idx" ON "QuestionResource"("projectId", "workspaceSourceId");
CREATE INDEX "ResearchFinding_projectId_reviewState_updatedAt_idx" ON "ResearchFinding"("projectId", "reviewState", "updatedAt");
CREATE INDEX "ResearchFinding_questionId_currentRevision_idx" ON "ResearchFinding"("questionId", "currentRevision");
CREATE UNIQUE INDEX "FindingRevision_findingId_revision_key" ON "FindingRevision"("findingId", "revision");
CREATE INDEX "FindingRevision_projectId_findingId_revision_idx" ON "FindingRevision"("projectId", "findingId", "revision");
CREATE INDEX "FindingEvidence_projectId_findingRevisionId_idx" ON "FindingEvidence"("projectId", "findingRevisionId");
CREATE INDEX "FindingEvidence_projectId_workspaceSourceId_idx" ON "FindingEvidence"("projectId", "workspaceSourceId");
CREATE INDEX "FindingEvidence_projectId_passageId_idx" ON "FindingEvidence"("projectId", "passageId");
CREATE UNIQUE INDEX "FindingReview_projectId_commandKey_key" ON "FindingReview"("projectId", "commandKey");
CREATE INDEX "FindingReview_projectId_findingRevisionId_createdAt_idx" ON "FindingReview"("projectId", "findingRevisionId", "createdAt");
CREATE INDEX "FindingReview_reviewerId_createdAt_idx" ON "FindingReview"("reviewerId", "createdAt");
CREATE UNIQUE INDEX "ResearchArticle_projectId_commandKey_key" ON "ResearchArticle"("projectId", "commandKey");
CREATE INDEX "ResearchArticle_projectId_status_updatedAt_idx" ON "ResearchArticle"("projectId", "status", "updatedAt");
CREATE UNIQUE INDEX "ArticleInput_articleId_findingRevisionId_key" ON "ArticleInput"("articleId", "findingRevisionId");
CREATE INDEX "ArticleInput_projectId_articleId_idx" ON "ArticleInput"("projectId", "articleId");
CREATE INDEX "ArticleInput_projectId_findingId_idx" ON "ArticleInput"("projectId", "findingId");
CREATE UNIQUE INDEX "ResearchExchange_projectId_commandKey_key" ON "ResearchExchange"("projectId", "commandKey");
CREATE INDEX "ResearchExchange_projectId_questionId_createdAt_idx" ON "ResearchExchange"("projectId", "questionId", "createdAt");

ALTER TABLE "ResearchContext" ADD CONSTRAINT "ResearchContext_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchQuestion" ADD CONSTRAINT "ResearchQuestion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchQuestion" ADD CONSTRAINT "ResearchQuestion_contextId_fkey" FOREIGN KEY ("contextId") REFERENCES "ResearchContext"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchQuestion" ADD CONSTRAINT "ResearchQuestion_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ResearchQuestion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "QuestionResource" ADD CONSTRAINT "QuestionResource_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "ResearchQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuestionResource" ADD CONSTRAINT "QuestionResource_workspaceSourceId_fkey" FOREIGN KEY ("workspaceSourceId") REFERENCES "WorkspaceSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchFinding" ADD CONSTRAINT "ResearchFinding_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchFinding" ADD CONSTRAINT "ResearchFinding_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "ResearchQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FindingRevision" ADD CONSTRAINT "FindingRevision_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "ResearchFinding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FindingEvidence" ADD CONSTRAINT "FindingEvidence_findingRevisionId_fkey" FOREIGN KEY ("findingRevisionId") REFERENCES "FindingRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FindingEvidence" ADD CONSTRAINT "FindingEvidence_workspaceSourceId_fkey" FOREIGN KEY ("workspaceSourceId") REFERENCES "WorkspaceSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FindingEvidence" ADD CONSTRAINT "FindingEvidence_passageId_fkey" FOREIGN KEY ("passageId") REFERENCES "PdfChunk"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FindingReview" ADD CONSTRAINT "FindingReview_findingRevisionId_fkey" FOREIGN KEY ("findingRevisionId") REFERENCES "FindingRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FindingReview" ADD CONSTRAINT "FindingReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchArticle" ADD CONSTRAINT "ResearchArticle_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchArticle" ADD CONSTRAINT "ResearchArticle_contextId_fkey" FOREIGN KEY ("contextId") REFERENCES "ResearchContext"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArticleInput" ADD CONSTRAINT "ArticleInput_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "ResearchArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArticleInput" ADD CONSTRAINT "ArticleInput_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "ResearchFinding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArticleInput" ADD CONSTRAINT "ArticleInput_findingRevisionId_fkey" FOREIGN KEY ("findingRevisionId") REFERENCES "FindingRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResearchExchange" ADD CONSTRAINT "ResearchExchange_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchExchange" ADD CONSTRAINT "ResearchExchange_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "ResearchQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchExchange" ADD CONSTRAINT "ResearchExchange_findingRevisionId_fkey" FOREIGN KEY ("findingRevisionId") REFERENCES "FindingRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;
