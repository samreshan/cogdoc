# ADR-0007: SSE streaming — partial delivery (Interceptor only)

- **Status:** Accepted
- **Date:** 2026-07-14
- **Sprint:** P3 (gap #4)

## Context

PRODUCT.md §12.1 + §15.5 contract all four engines onto the FastAPI service,
streaming token-by-token over SSE (`text/event-stream`), with a first-token
latency NFR of ≤1.5s p95 (§15.5). The client side is already built:
`src/lib/ai-gateway.ts` `streamIntervention()` targets
`POST /api/ai/{engine}/stream`, and `src/lib/sse.ts` parses the §12.3 event
schema (`meta` → `token`×N → `done`, with `error` any time).

But no FastAPI endpoint emits SSE today — the producer side is entirely
missing. Wiring all four engines end-to-end in one sprint is high-risk: each
needs a token-provider, a persistence path (FastAPI has no DB client), and the
client `fireEngine` rewrite for live rendering.

## Decision

Implement the **Interceptor** engine end-to-end on FastAPI with a real
`StreamingResponse` (highest demo value: the Interceptor's Socratic reframe is
the flagship interaction). Keep the other three engines (Socratic Spacer,
Citation Sentinel, Scaffold) as blocking Next.js route handlers for now, each
with a `// TODO(phase-sse): stream this engine` marker.

This is a deliberate partial delivery. Honest partial > four broken streams.

## Consequences

- The Interceptor visibly streams token-by-token; `meta`→`token`…→`done`
  ordering holds; the anti-generation guard runs on the assembled response
  before `done`, emitting `error{code:'guard_violation'}` + a Spark Gap
  replacement on violation.
- Persistence: FastAPI has no DB client. The streaming endpoint returns the
  assembled content + the client (BFF) persists the `Intervention` on `done`
  via the existing blocking `/api/interceptor` route. This matches the
  existing ownership (Next.js BFF writes all Intervention rows).
- The other three engines remain blocking until a later sprint streams them.
- A network drop mid-SSE surfaces a toast and persists the partial
  intervention if any token streamed (test case I-10).
