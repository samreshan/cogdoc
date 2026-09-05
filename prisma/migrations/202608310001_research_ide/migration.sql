-- Research IDE: private global library, linked notebook, transparent actions,
-- grounded synthesis, academic profiles, and a PostgreSQL-backed job queue.
ALTER TABLE "Pdf" ADD COLUMN "librarySourceId" TEXT;
ALTER TABLE "Reference" ADD COLUMN "workspaceSourceId" TEXT;

CREATE TABLE "LibrarySource" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "title" TEXT NOT NULL,
  "filename" TEXT, "doi" TEXT, "canonicalUrl" TEXT, "contentHash" TEXT,
  "mimeType" TEXT, "sizeBytes" INTEGER NOT NULL DEFAULT 0,
  "parseStatus" TEXT NOT NULL DEFAULT 'queued', "storageProvider" TEXT,
  "storageKey" TEXT, "metadataJson" TEXT NOT NULL DEFAULT '{}',
  "qualityScore" DOUBLE PRECISION NOT NULL DEFAULT 0, "qualityExplanation" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LibrarySource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkspaceSource" (
  "id" TEXT NOT NULL, "projectId" TEXT NOT NULL, "librarySourceId" TEXT NOT NULL,
  "relevance" DOUBLE PRECISION NOT NULL DEFAULT 0, "status" TEXT NOT NULL DEFAULT 'saved',
  "notes" TEXT, "citationUsageCount" INTEGER NOT NULL DEFAULT 0,
  "lastOpenedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkspaceSource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ResearchNote" (
  "id" TEXT NOT NULL, "projectId" TEXT NOT NULL, "workspaceSourceId" TEXT,
  "passageId" TEXT, "kind" TEXT NOT NULL DEFAULT 'note', "title" TEXT,
  "body" TEXT NOT NULL, "exactExcerpt" TEXT, "sourceAnchorJson" TEXT,
  "documentAnchorJson" TEXT, "stale" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ResearchNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SourceAnnotation" (
  "id" TEXT NOT NULL, "projectId" TEXT NOT NULL, "workspaceSourceId" TEXT NOT NULL,
  "passageId" TEXT, "color" TEXT NOT NULL DEFAULT 'ochre', "comment" TEXT,
  "anchorJson" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "SourceAnnotation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ResearchAction" (
  "id" TEXT NOT NULL, "projectId" TEXT NOT NULL, "kind" TEXT NOT NULL,
  "title" TEXT NOT NULL, "detail" TEXT NOT NULL, "state" TEXT NOT NULL DEFAULT 'open',
  "pinned" BOOLEAN NOT NULL DEFAULT false, "snoozedUntil" TIMESTAMP(3),
  "dismissedAt" TIMESTAMP(3), "completedAt" TIMESTAMP(3), "priority" INTEGER NOT NULL DEFAULT 0,
  "priorityFactorsJson" TEXT NOT NULL DEFAULT '{}', "targetKind" TEXT, "targetId" TEXT,
  "documentAnchorJson" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "ResearchAction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GroundedSynthesis" (
  "id" TEXT NOT NULL, "projectId" TEXT NOT NULL, "kind" TEXT NOT NULL,
  "prompt" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'queued', "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GroundedSynthesis_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SynthesisFinding" (
  "id" TEXT NOT NULL, "synthesisId" TEXT NOT NULL, "text" TEXT NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0, "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "SynthesisFinding_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SynthesisFindingPassage" (
  "findingId" TEXT NOT NULL, "passageId" TEXT NOT NULL,
  CONSTRAINT "SynthesisFindingPassage_pkey" PRIMARY KEY ("findingId", "passageId")
);

CREATE TABLE "AcademicProfile" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "projectId" TEXT, "name" TEXT NOT NULL,
  "cslStyle" TEXT NOT NULL DEFAULT 'harvard', "headingJson" TEXT NOT NULL DEFAULT '{}',
  "marginsJson" TEXT NOT NULL DEFAULT '{"top":25.4,"right":25.4,"bottom":25.4,"left":25.4}',
  "spacing" DOUBLE PRECISION NOT NULL DEFAULT 2, "titlePageJson" TEXT NOT NULL DEFAULT '{}',
  "captionJson" TEXT NOT NULL DEFAULT '{}', "tableJson" TEXT NOT NULL DEFAULT '{}',
  "bibliographyJson" TEXT NOT NULL DEFAULT '{}', "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AcademicProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ResearchJob" (
  "id" TEXT NOT NULL, "projectId" TEXT NOT NULL, "kind" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'queued', "payloadJson" TEXT NOT NULL DEFAULT '{}',
  "resultJson" TEXT, "progress" INTEGER NOT NULL DEFAULT 0, "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3, "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leaseOwner" TEXT, "leaseExpiresAt" TIMESTAMP(3), "error" TEXT, "idempotencyKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3), CONSTRAINT "ResearchJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LibrarySource_userId_doi_key" ON "LibrarySource"("userId", "doi");
CREATE UNIQUE INDEX "LibrarySource_userId_canonicalUrl_key" ON "LibrarySource"("userId", "canonicalUrl");
CREATE UNIQUE INDEX "LibrarySource_userId_contentHash_key" ON "LibrarySource"("userId", "contentHash");
CREATE INDEX "LibrarySource_userId_updatedAt_idx" ON "LibrarySource"("userId", "updatedAt");
CREATE UNIQUE INDEX "WorkspaceSource_projectId_librarySourceId_key" ON "WorkspaceSource"("projectId", "librarySourceId");
CREATE INDEX "WorkspaceSource_projectId_status_idx" ON "WorkspaceSource"("projectId", "status");
CREATE INDEX "ResearchNote_projectId_updatedAt_idx" ON "ResearchNote"("projectId", "updatedAt");
CREATE INDEX "ResearchNote_workspaceSourceId_idx" ON "ResearchNote"("workspaceSourceId");
CREATE INDEX "SourceAnnotation_projectId_workspaceSourceId_idx" ON "SourceAnnotation"("projectId", "workspaceSourceId");
CREATE INDEX "ResearchAction_projectId_state_priority_idx" ON "ResearchAction"("projectId", "state", "priority");
CREATE INDEX "ResearchAction_projectId_snoozedUntil_idx" ON "ResearchAction"("projectId", "snoozedUntil");
CREATE INDEX "GroundedSynthesis_projectId_createdAt_idx" ON "GroundedSynthesis"("projectId", "createdAt");
CREATE INDEX "SynthesisFinding_synthesisId_sortOrder_idx" ON "SynthesisFinding"("synthesisId", "sortOrder");
CREATE INDEX "SynthesisFindingPassage_passageId_idx" ON "SynthesisFindingPassage"("passageId");
CREATE INDEX "AcademicProfile_userId_projectId_idx" ON "AcademicProfile"("userId", "projectId");
CREATE UNIQUE INDEX "ResearchJob_projectId_idempotencyKey_key" ON "ResearchJob"("projectId", "idempotencyKey");
CREATE INDEX "ResearchJob_status_availableAt_idx" ON "ResearchJob"("status", "availableAt");
CREATE INDEX "ResearchJob_projectId_createdAt_idx" ON "ResearchJob"("projectId", "createdAt");
CREATE INDEX "Pdf_librarySourceId_idx" ON "Pdf"("librarySourceId");

ALTER TABLE "LibrarySource" ADD CONSTRAINT "LibrarySource_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceSource" ADD CONSTRAINT "WorkspaceSource_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceSource" ADD CONSTRAINT "WorkspaceSource_librarySourceId_fkey" FOREIGN KEY ("librarySourceId") REFERENCES "LibrarySource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResearchNote" ADD CONSTRAINT "ResearchNote_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchNote" ADD CONSTRAINT "ResearchNote_workspaceSourceId_fkey" FOREIGN KEY ("workspaceSourceId") REFERENCES "WorkspaceSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ResearchNote" ADD CONSTRAINT "ResearchNote_passageId_fkey" FOREIGN KEY ("passageId") REFERENCES "PdfChunk"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SourceAnnotation" ADD CONSTRAINT "SourceAnnotation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SourceAnnotation" ADD CONSTRAINT "SourceAnnotation_workspaceSourceId_fkey" FOREIGN KEY ("workspaceSourceId") REFERENCES "WorkspaceSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SourceAnnotation" ADD CONSTRAINT "SourceAnnotation_passageId_fkey" FOREIGN KEY ("passageId") REFERENCES "PdfChunk"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ResearchAction" ADD CONSTRAINT "ResearchAction_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroundedSynthesis" ADD CONSTRAINT "GroundedSynthesis_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SynthesisFinding" ADD CONSTRAINT "SynthesisFinding_synthesisId_fkey" FOREIGN KEY ("synthesisId") REFERENCES "GroundedSynthesis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SynthesisFindingPassage" ADD CONSTRAINT "SynthesisFindingPassage_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "SynthesisFinding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SynthesisFindingPassage" ADD CONSTRAINT "SynthesisFindingPassage_passageId_fkey" FOREIGN KEY ("passageId") REFERENCES "PdfChunk"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AcademicProfile" ADD CONSTRAINT "AcademicProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AcademicProfile" ADD CONSTRAINT "AcademicProfile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchJob" ADD CONSTRAINT "ResearchJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Pdf" ADD CONSTRAINT "Pdf_librarySourceId_fkey" FOREIGN KEY ("librarySourceId") REFERENCES "LibrarySource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Reference" ADD CONSTRAINT "Reference_workspaceSourceId_fkey" FOREIGN KEY ("workspaceSourceId") REFERENCES "WorkspaceSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Preserve every legacy project source and its workspace association. The
-- legacy Pdf and PdfChunk rows remain in place as compatibility adapters.
INSERT INTO "LibrarySource" ("id", "userId", "title", "filename", "contentHash", "sizeBytes", "parseStatus", "metadataJson", "createdAt", "updatedAt")
SELECT 'lib_' || "id", "userId", "filename", "filename", md5("rawText"), "sizeBytes", "parseStatus", '{"migratedFrom":"Pdf"}', "uploadedAt", CURRENT_TIMESTAMP FROM "Pdf";
INSERT INTO "WorkspaceSource" ("id", "projectId", "librarySourceId", "status", "createdAt", "updatedAt")
SELECT 'wsrc_' || "id", "projectId", 'lib_' || "id", 'saved', "uploadedAt", CURRENT_TIMESTAMP FROM "Pdf";
UPDATE "Pdf" SET "librarySourceId" = 'lib_' || "id";
