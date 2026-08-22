-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "briefText" TEXT,
ADD COLUMN     "citationStyle" TEXT NOT NULL DEFAULT 'harvard',
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "dueAt" TIMESTAMP(3),
ADD COLUMN     "lifecycleState" TEXT NOT NULL DEFAULT 'draft',
ADD COLUMN     "reviewPace" TEXT NOT NULL DEFAULT 'deep',
ADD COLUMN     "workspaceType" TEXT NOT NULL DEFAULT 'research';

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "contentHash" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "revision" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "WorkspaceAsset" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "contentHash" TEXT NOT NULL,
    "storageProvider" TEXT NOT NULL DEFAULT 'filesystem',
    "storageKey" TEXT NOT NULL,
    "warningsJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Requirement" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "required" BOOLEAN NOT NULL DEFAULT false,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Requirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentVersion" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "plainText" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reference" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sourceId" TEXT,
    "rawText" TEXT NOT NULL,
    "style" TEXT NOT NULL,
    "authorsJson" TEXT NOT NULL DEFAULT '[]',
    "year" TEXT,
    "title" TEXT,
    "doi" TEXT,
    "url" TEXT,
    "metadataStatus" TEXT NOT NULL DEFAULT 'unverified',
    "metadataConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "metadataJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Citation" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "documentVersionId" TEXT NOT NULL,
    "referenceId" TEXT,
    "claimId" TEXT,
    "rawText" TEXT NOT NULL,
    "authorsJson" TEXT NOT NULL DEFAULT '[]',
    "year" TEXT,
    "locator" TEXT,
    "anchorJson" TEXT NOT NULL,
    "matchConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Citation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Claim" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "documentVersionId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "riskCategory" TEXT NOT NULL DEFAULT 'general',
    "anchorJson" TEXT NOT NULL,
    "central" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Claim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceLink" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "pdfChunkId" TEXT,
    "codeFileId" TEXT,
    "kind" TEXT NOT NULL,
    "startLine" INTEGER,
    "endLine" INTEGER,
    "excerpt" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "supportStatus" TEXT NOT NULL DEFAULT 'insufficient_evidence',
    "idempotencyKey" TEXT,
    "confirmedByStudent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewRun" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "documentVersionId" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'full',
    "status" TEXT NOT NULL DEFAULT 'queued',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "currentStage" TEXT,
    "errorCode" TEXT,
    "analyzerVersions" TEXT NOT NULL DEFAULT '{}',
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ReviewRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "reviewRunId" TEXT NOT NULL,
    "claimId" TEXT,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "evidenceJson" TEXT NOT NULL DEFAULT '{}',
    "anchorJson" TEXT,
    "state" TEXT NOT NULL DEFAULT 'open',
    "blocksCertification" BOOLEAN NOT NULL DEFAULT false,
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ReviewItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewResponse" (
    "id" TEXT NOT NULL,
    "reviewItemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "responseText" TEXT,
    "beforeText" TEXT,
    "afterText" TEXT,
    "evidenceJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actor" TEXT NOT NULL DEFAULT 'student',
    "payloadJson" TEXT NOT NULL DEFAULT '{}',
    "documentHash" TEXT,
    "modelVersion" TEXT,
    "promptVersion" TEXT,
    "previousHash" TEXT,
    "eventHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodeSnapshot" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "extractedBytes" INTEGER NOT NULL DEFAULT 0,
    "fileCount" INTEGER NOT NULL DEFAULT 0,
    "snapshotHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "warningsJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CodeSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodeFile" (
    "id" TEXT NOT NULL,
    "codeSnapshotId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "language" TEXT,
    "content" TEXT,
    "contentHash" TEXT NOT NULL,
    "lineCount" INTEGER NOT NULL DEFAULT 0,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CodeFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationReport" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "documentVersionId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'scan_report',
    "reportJson" TEXT NOT NULL,
    "reportHash" TEXT NOT NULL,
    "coverageJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Certificate" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "documentVersionId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'valid',
    "payloadJson" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "publicKeyId" TEXT NOT NULL,
    "publicKeyPem" TEXT NOT NULL,
    "docxHash" TEXT,
    "docxStorageProvider" TEXT,
    "docxStorageKey" TEXT,
    "pdfStorageProvider" TEXT,
    "pdfStorageKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersededAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShareGrant" (
    "id" TEXT NOT NULL,
    "certificateId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShareGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertificateRevocationTombstone" (
    "id" TEXT NOT NULL,
    "certificateId" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "publicKeyId" TEXT NOT NULL,
    "shareTokenHashesJson" TEXT NOT NULL DEFAULT '[]',
    "revokedAt" TIMESTAMP(3) NOT NULL,
    "purgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CertificateRevocationTombstone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkspaceAsset_projectId_createdAt_idx" ON "WorkspaceAsset"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "Requirement_projectId_idx" ON "Requirement"("projectId");

-- CreateIndex
CREATE INDEX "DocumentVersion_projectId_createdAt_idx" ON "DocumentVersion"("projectId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentVersion_projectId_sequence_key" ON "DocumentVersion"("projectId", "sequence");

-- CreateIndex
CREATE INDEX "Reference_projectId_idx" ON "Reference"("projectId");

-- CreateIndex
CREATE INDEX "Reference_doi_idx" ON "Reference"("doi");

-- CreateIndex
CREATE INDEX "Citation_projectId_idx" ON "Citation"("projectId");

-- CreateIndex
CREATE INDEX "Citation_documentVersionId_idx" ON "Citation"("documentVersionId");

-- CreateIndex
CREATE INDEX "Claim_projectId_idx" ON "Claim"("projectId");

-- CreateIndex
CREATE INDEX "Claim_documentVersionId_idx" ON "Claim"("documentVersionId");

-- CreateIndex
CREATE INDEX "EvidenceLink_claimId_idx" ON "EvidenceLink"("claimId");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceLink_claimId_idempotencyKey_key" ON "EvidenceLink"("claimId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "ReviewRun_projectId_createdAt_idx" ON "ReviewRun"("projectId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewRun_projectId_idempotencyKey_key" ON "ReviewRun"("projectId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "ReviewItem_projectId_state_idx" ON "ReviewItem"("projectId", "state");

-- CreateIndex
CREATE INDEX "ReviewItem_reviewRunId_idx" ON "ReviewItem"("reviewRunId");

-- CreateIndex
CREATE INDEX "ReviewResponse_reviewItemId_idx" ON "ReviewResponse"("reviewItemId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditEvent_eventHash_key" ON "AuditEvent"("eventHash");

-- CreateIndex
CREATE INDEX "AuditEvent_projectId_createdAt_idx" ON "AuditEvent"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "CodeSnapshot_projectId_createdAt_idx" ON "CodeSnapshot"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "CodeFile_codeSnapshotId_idx" ON "CodeFile"("codeSnapshotId");

-- CreateIndex
CREATE UNIQUE INDEX "CodeFile_codeSnapshotId_path_key" ON "CodeFile"("codeSnapshotId", "path");

-- CreateIndex
CREATE INDEX "VerificationReport_projectId_createdAt_idx" ON "VerificationReport"("projectId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_reportId_key" ON "Certificate"("reportId");

-- CreateIndex
CREATE INDEX "Certificate_projectId_createdAt_idx" ON "Certificate"("projectId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ShareGrant_tokenHash_key" ON "ShareGrant"("tokenHash");

-- CreateIndex
CREATE INDEX "ShareGrant_certificateId_idx" ON "ShareGrant"("certificateId");

-- CreateIndex
CREATE UNIQUE INDEX "CertificateRevocationTombstone_certificateId_key" ON "CertificateRevocationTombstone"("certificateId");

-- CreateIndex
CREATE INDEX "CertificateRevocationTombstone_revokedAt_idx" ON "CertificateRevocationTombstone"("revokedAt");

-- AddForeignKey
ALTER TABLE "WorkspaceAsset" ADD CONSTRAINT "WorkspaceAsset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requirement" ADD CONSTRAINT "Requirement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reference" ADD CONSTRAINT "Reference_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reference" ADD CONSTRAINT "Reference_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Pdf"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Citation" ADD CONSTRAINT "Citation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Citation" ADD CONSTRAINT "Citation_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "DocumentVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Citation" ADD CONSTRAINT "Citation_referenceId_fkey" FOREIGN KEY ("referenceId") REFERENCES "Reference"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Citation" ADD CONSTRAINT "Citation_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "DocumentVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceLink" ADD CONSTRAINT "EvidenceLink_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceLink" ADD CONSTRAINT "EvidenceLink_pdfChunkId_fkey" FOREIGN KEY ("pdfChunkId") REFERENCES "PdfChunk"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceLink" ADD CONSTRAINT "EvidenceLink_codeFileId_fkey" FOREIGN KEY ("codeFileId") REFERENCES "CodeFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewRun" ADD CONSTRAINT "ReviewRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewRun" ADD CONSTRAINT "ReviewRun_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "DocumentVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewItem" ADD CONSTRAINT "ReviewItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewItem" ADD CONSTRAINT "ReviewItem_reviewRunId_fkey" FOREIGN KEY ("reviewRunId") REFERENCES "ReviewRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewItem" ADD CONSTRAINT "ReviewItem_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewResponse" ADD CONSTRAINT "ReviewResponse_reviewItemId_fkey" FOREIGN KEY ("reviewItemId") REFERENCES "ReviewItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewResponse" ADD CONSTRAINT "ReviewResponse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodeSnapshot" ADD CONSTRAINT "CodeSnapshot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodeFile" ADD CONSTRAINT "CodeFile_codeSnapshotId_fkey" FOREIGN KEY ("codeSnapshotId") REFERENCES "CodeSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationReport" ADD CONSTRAINT "VerificationReport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationReport" ADD CONSTRAINT "VerificationReport_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "DocumentVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationReport" ADD CONSTRAINT "VerificationReport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "VerificationReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "DocumentVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareGrant" ADD CONSTRAINT "ShareGrant_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "Certificate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
