-- Allow the existing exchange ledger to hold document-level collaborator
-- turns before a researcher chooses or creates an investigation question.
-- Question-scoped exchanges retain the same relation and cascade semantics.
ALTER TABLE "ResearchExchange" ALTER COLUMN "questionId" DROP NOT NULL;
