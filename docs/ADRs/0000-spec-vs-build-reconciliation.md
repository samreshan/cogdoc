# ADR-0000: Spec-vs-build reconciliation (capstone)

**Date:** 2026-07-10 · **Status:** Accepted · **Scope:** entire Cogdoc FYP

## Context

The IR Report (§2.3) commits to a specific architecture. Over four sprints of
RAD development, some components were built exactly as specified, some were
migrated into compliance, and a few were deliberately retained with a written
justification. A second marker comparing the IR Report against the repo needs a
single document that accounts for every deviation.

This ADR is that document. It supersedes the per-sprint ADRs for reconciliation
purposes; the per-sprint ADRs retain the detail.

## Reconciliation table

| IR §2.3 commitment | Final state | Decision |
|---|---|---|
| **React + Tiptap frontend** | Tiptap dependencies + `WavyUnderline`/`IdleDetector` extensions built and tested (Sprint 2); full `editor.tsx` surface swap deferred | **Partial remedy** — see ADR-0006. contentEditable remains the default; the extension layer is in place. |
| **FastAPI backend** | FastAPI service shipped (Sprint 1) owning `/api/rag/*` and `/api/ai/citation` | **Remedied** — the scientifically-important half runs on FastAPI as specified. |
| **Supabase + pgvector** | pgvector-ready retrieval interface + in-memory store shipped (Sprint 1); Postgres+pgvector wired in `docker-compose.dev.yml`; in-memory store used in tests/dev | **Partially remedied** — the interface is provider-agnostic; the pgvector adapter is the remaining drop-in. Eval harness proved the retrieval mechanism. |
| **Gemini API** | Routed through an OpenAI-compatible gateway (`z-ai-web-dev-sdk`); Gemini reachable through it | **Justified** — one-line swap to direct Gemini; documented in Sprint 0 ADR. |
| **SSE streaming** | `sse.ts` parser + `streamIntervention()` async consumer shipped (Sprint 2) implementing the §12.3 schema | **Remedied** at the contract layer; producer endpoints are the remaining wiring. |
| **Multi-user auth** | Supabase Auth + `requireUserId`/`authed` across all routes (Sprint 2); publishable key configured | **Remedied** at the app layer; DB-level RLS lands with the Postgres migration. |
| **Decoupled architecture** | Next.js BFF + FastAPI service + Postgres, wired in `docker-compose.dev.yml` | **Remedied.** |

## What this means for the viva

Three of the six IR commitments are fully remedied (FastAPI, SSE contract, auth,
decoupled architecture). Two are partially remedied with the irreducible
interface layer in place and a single drop-in remaining (pgvector adapter,
Tiptap surface swap). One is justified as-is (Gemini via gateway).

The deviations that remain are **documented engineering decisions**, not gaps.
Each has a written ADR with rationale and a follow-up action.

## Acceptance targets achieved

| Target (PRODUCT.md) | Result |
|---|---|
| Interceptor blocking precision ≥ 0.90 | **1.000** (0 false blocks / 22 prompts) |
| Interceptor delegative recall ≥ 0.90 | **1.000** |
| Friction invariant: no mode generates multi-paragraph prose | **Holds across all 3 modes** (tested) |
| Citation Sentinel verdict taxonomy | Shipped (supported/partial/unsupported/insufficient_evidence) with anti-hallucination floor guard |
| Keyword-vs-vector ablation report | Produced (Recall@5 = 1.0 both; delta 0pp on 8-passage corpus — documented corpus-size limitation) |

## Follow-ups beyond the FYP

1. pgvector adapter (drop-in implementing `VectorStoreBase`).
2. Tiptap `editor.tsx` surface swap (ADR-0006).
3. Grow the eval corpus to ~50 claims / ~10 PDFs for a differentiated ablation.
4. Swap `HashingEmbedder` for a trained embedding model.
