#!/usr/bin/env node
/* Read-only verification for an applied Supabase security deployment. */
const { existsSync, readFileSync } = require('node:fs')
const path = require('node:path')

function loadEnvFile(filename) {
  const full = path.join(process.cwd(), filename)
  if (!existsSync(full)) return
  for (const line of readFileSync(full, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!match || process.env[match[1]] !== undefined) continue
    let value = match[2]
    if (value.startsWith('"') && value.endsWith('"') || value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1)
    }
    process.env[match[1]] = value
  }
}

loadEnvFile('.env.local')
loadEnvFile('.env')

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required. Point it at the Supabase Postgres deployment to verify.')
  process.exit(1)
}

const { PrismaClient } = require('@prisma/client')
const db = new PrismaClient()

const requiredTables = [
  'User', 'Project', 'WorkspaceAsset', 'Document', 'Requirement', 'DocumentVersion',
  'Pdf', 'PdfChunk', 'Reference', 'Citation', 'Claim', 'EvidenceLink', 'ReviewRun',
  'ReviewItem', 'ReviewResponse', 'AuditEvent', 'CodeSnapshot', 'CodeFile',
  'VerificationReport', 'Certificate', 'ShareGrant', 'CertificateRevocationTombstone',
  'Intervention', 'InterventionEvidence', 'PromptTemplate',
]

const requiredPolicies = [
  'users_self_select', 'projects_owner_all', 'workspaceasset_owner_all',
  'documents_owner_all', 'requirement_owner_all', 'documentversion_owner_all',
  'pdfs_owner_all', 'pdfchunks_owner_all', 'reference_owner_all',
  'citation_owner_all', 'claim_owner_all', 'evidence_links_owner_all',
  'reviewrun_owner_all', 'reviewitem_owner_all', 'review_responses_owner_all',
  'audits_owner_select', 'audits_owner_insert', 'codesnapshot_owner_all',
  'code_files_owner_all', 'verificationreport_owner_all', 'certificate_owner_all',
  'share_grants_owner_all', 'interventions_owner_all', 'intervention_evidence_owner_all',
]

async function main() {
  const tables = await db.$queryRawUnsafe(`
    SELECT c.relname AS "tableName", c.relrowsecurity AS "rlsEnabled"
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
  `)
  const rls = new Map(tables.map((row) => [row.tableName, row.rlsEnabled]))
  const missingRls = requiredTables.filter((table) => rls.get(table) !== true)

  const policies = await db.$queryRawUnsafe(`
    SELECT schemaname, tablename, policyname, permissive, roles::text AS roles
    FROM pg_policies
    WHERE schemaname IN ('public', 'storage')
  `)
  const policyNames = new Set(policies.filter((row) => row.schemaname === 'public').map((row) => row.policyname))
  const missingPolicies = requiredPolicies.filter((policy) => !policyNames.has(policy))
  const unexpectedServiceTablePolicies = policies.filter((row) =>
    row.schemaname === 'public'
    && ['PromptTemplate', 'CertificateRevocationTombstone'].includes(row.tablename),
  )

  const storageSchema = await db.$queryRawUnsafe(`SELECT to_regclass('storage.buckets')::text AS name`)
  const errors = []
  if (missingRls.length) errors.push(`RLS is not enabled: ${missingRls.join(', ')}`)
  if (missingPolicies.length) errors.push(`Required policies are missing: ${missingPolicies.join(', ')}`)
  if (unexpectedServiceTablePolicies.length) {
    errors.push('PromptTemplate or CertificateRevocationTombstone has an unexpected browser policy')
  }
  if (!storageSchema[0]?.name) {
    errors.push('Supabase storage schema is unavailable; this is not a complete Supabase deployment')
  } else {
    const bucket = process.env.COGDOC_STORAGE_BUCKET || 'cogdoc-private'
    const buckets = await db.$queryRawUnsafe(
      `SELECT id, public, file_size_limit AS "fileSizeLimit" FROM storage.buckets WHERE id = $1`,
      bucket,
    )
    if (!buckets[0] || buckets[0].public !== false) errors.push(`Private storage bucket ${bucket} is missing or public`)
    const storagePolicy = policies.find((row) =>
      row.schemaname === 'storage'
      && row.tablename === 'objects'
      && row.policyname === 'cogdoc_private_service_only',
    )
    if (!storagePolicy || storagePolicy.permissive !== 'RESTRICTIVE') {
      errors.push('Restrictive browser-deny policy cogdoc_private_service_only is missing')
    }
  }

  if (errors.length) {
    console.error('Cogdoc security verification failed:')
    for (const error of errors) console.error(`- ${error}`)
    process.exitCode = 1
    return
  }
  console.log(`Cogdoc security verification passed: ${requiredTables.length} RLS tables, ${requiredPolicies.length} required policies, private storage enforced.`)
}

main()
  .catch((error) => {
    console.error(`Cogdoc security verification could not run: ${error.message}`)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
