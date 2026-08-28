# Production authentication, RLS, and private storage

Cogdoc has two intentional deployment modes. A shared or public deployment
must use Supabase Auth. A private installation used by one person may set
`COGDOC_SINGLE_USER_MODE=1`. Production fails closed with HTTP 503 when neither
choice is configured; `COGDOC_DEV_FALLBACK` is always ignored in production.

Single-user mode maps every request to the seeded default user. It is not an
authentication system and must not be exposed to multiple people or an
untrusted network.

## Supabase deployment order

1. Create the Supabase project and set the PostgreSQL `DATABASE_URL`.
2. Apply the Prisma schema with `npm run db:push`.
3. Enable the vector extension and apply `fastapi/migrations/0001_pgvector.sql`.
4. Apply `0002_rls_policies.sql`, `0003_workspace_rls.sql`, then
   `0004_security_hardening.sql` in order through the Supabase SQL editor or
   CLI. Migration 0004 is Supabase-only because it references `auth.uid()` and
   the `storage` schema.
5. Configure `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and the server-only
   `SUPABASE_SERVICE_ROLE_KEY`.
6. Run `npm run security:verify` against the deployed Supabase database. This
   read-only check must pass before accepting user documents.

The browser receives the Supabase URL and publishable key through
`/api/auth/config` at runtime. These values are intentionally public. The
service-role key, database URL, JWT secret, AI keys, and storage credentials
are never returned by that endpoint.

## Enforcement boundaries

- RLS protects direct Supabase browser access. It is enabled on every Prisma
  application table.
- The Next.js BFF commonly connects with a database owner/pooler credential,
  and Supabase service-role requests bypass RLS. Every BFF query must therefore
  retain its explicit acting-user or workspace-owner predicate.
- `PromptTemplate` and `CertificateRevocationTombstone` have RLS but no browser
  policy. They are server-only.
- Browser clients may select their own `User` profile but cannot update it
  directly. Provisioning and profile mutation remain BFF operations.
- `cogdoc-private` is created as a non-public 50 MB bucket. A restrictive
  `storage.objects` policy denies both `anon` and `authenticated` roles even if
  a future permissive policy is added. The BFF accesses objects only with the
  service role.
- RLS is deliberately not forced because Prisma server connections do not set
  `auth.uid()` and trusted workers require the service-role bypass.

Never place `SUPABASE_SERVICE_ROLE_KEY` in a `NEXT_PUBLIC_*` variable, client
bundle, log, or browser request. Rotate it immediately if it is exposed.

## Verification and rollback

`npm run security:verify` checks every application table, required ownership
policies, server-only tables, the private bucket, and the restrictive storage
policy. It does not mutate the database.

Before applying the migration, take a database backup and record existing
`pg_policies` and storage bucket settings. If a policy prevents a production
workflow, roll back the application deployment first. Restore only the
specific prior policy from the recorded definition; do not broadly disable RLS
or make the bucket public. The service-role BFF remains available for recovery
while browser roles are denied.

The migration intentionally does not delete stored objects or application
rows. Re-running it is idempotent and reasserts private bucket settings.

The architectural rationale and deviations from the original transition plan
are recorded in [ADR-0011](../ADRs/0011-explicit-production-auth-and-supabase-boundaries.md).
