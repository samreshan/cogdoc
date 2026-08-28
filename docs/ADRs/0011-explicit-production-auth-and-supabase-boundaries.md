# ADR-0011: Explicit production auth and Supabase trust boundaries

- Status: Accepted
- Date: 2026-08-28
- Decision owners: Cogdoc product and engineering

## Context

Cogdoc originally treated missing Supabase variables as permission to use the
seeded default user. That made local development convenient, but in production
it could silently turn a nominally multi-user deployment into one shared
identity. The Docker wizard also collected variables after the browser bundle
was built, while the client gate relied on build-time `NEXT_PUBLIC_*` values.
Consequently a correctly entered runtime configuration could still fail to
show the login screen.

The first RLS migrations established owner predicates but did not consistently
bind both ends of link rows to the same workspace. Private Storage was described
as an operational assumption rather than provisioned and verified policy.

## Decision

Production now has exactly two intentional modes:

1. Shared deployments configure Supabase Auth.
2. A private one-person installation explicitly sets
   `COGDOC_SINGLE_USER_MODE=1`.

When neither is true, the proxy and route auth helper fail closed. The existing
`COGDOC_DEV_FALLBACK` remains local-development-only and is ignored in
production. Protected APIs return structured 401 or 503 responses rather than
allowing an unhandled auth exception. Server authentication validates the
access token with Supabase `getUser()`; it does not trust cookie session data
alone.

The browser obtains only the project URL and publishable key from a no-store
runtime endpoint. This allows the Docker wizard to configure an already-built
image. Service-role, database, JWT, model, and storage secrets remain server
only.

Migration `0004_security_hardening.sql` enables RLS on every application model,
adds same-workspace checks to relationship policies, leaves server-owned tables
without browser policies, provisions `cogdoc-private`, and adds a restrictive
browser-role deny policy. The BFF also verifies an object's workspace prefix
before reading private storage.

The deployed policy set is checked with the read-only
`npm run security:verify` command. The same SQL is covered statically in the
test suite and was exercised twice against a disposable Supabase-shaped
Postgres database to confirm syntax and idempotency.

## Deviation from the original plan

The original transition plan expected the default-user fallback to disappear
when Supabase landed. It remains, but only as an explicit private self-hosting
mode because that is useful for a zero-cost personal installation. This is not
presented as multi-user authentication.

The original plan also treated RLS as the primary BFF isolation mechanism.
Prisma's trusted server connection does not set `auth.uid()` and may use a role
that bypasses RLS, so application-level ownership predicates remain mandatory.
RLS is defense in depth for direct Supabase browser access, not a replacement
for BFF authorization.

Private Storage is service-role-only rather than granting each browser user an
object-prefix policy. This preserves a single audited download path and avoids
exposing source documents through long-lived direct object URLs.

## Consequences

- A production upgrade without Supabase must explicitly choose single-user
  mode or it receives a setup-required screen and HTTP 503 APIs.
- Public certificate verification remains reachable without an authenticated
  session; certificate document downloads remain owner-authenticated.
- The default bucket name is `cogdoc-private`. A customized bucket requires an
  equivalent private bucket and restrictive policy, and the live verifier must
  pass for that configured name.
- Operators must apply the Supabase-only migration after Prisma schema changes
  and run the verifier before accepting user documents.
- RLS is deliberately not forced, because trusted workers and the BFF require
  service-role/database-owner access and do not carry `auth.uid()` in Prisma
  sessions.

Operational steps and rollback guidance are in
[`docs/deployment/security.md`](../deployment/security.md).
