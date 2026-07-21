# S1 Evaluation Results — Citation Sentinel on the real corpus

**Date:** 2026-07-21 · **Harness:** `fastapi/app/eval_harness.py` v2 ·
**Dataset:** `fastapi/app/eval_data_real.py` (50 claims / 28 passages / 5 real PDFs)

## Headline result (held-out test split, real pipeline)

Pipeline: Gemini embeddings (`gemini-embedding-001`, 3072-dim, asymmetric
task types) + Gemini LLM verdicts (`gemini-3.1-flash-lite`, temperature 0,
evidence-only prompt).

| Metric | Measured | §14.3 target | Met |
|---|---|---|---|
| Verdict macro-F1 (held-out, n=31) | **0.773** | ≥ 0.70 | ✅ |
| Recall@5, vector | **0.8875** | ≥ 0.80 | ✅ |
| Vector vs keyword Δ Recall@5 | **+2.5pp** | ≥ 15pp | ❌ (see discussion) |
| Verdict API failures | 0 | — | ✅ |

Per-class F1 (all four verdict classes ≥ 0.70):
supported 0.82 · partially_supported 0.80 · unsupported 0.77 ·
insufficient_evidence 0.71.

Retrieval by cutoff (vector / keyword / Δpp):
Recall@1 0.54 / 0.49 / **+5.0** · Recall@3 0.74 / 0.73 / +1.25 ·
Recall@5 0.89 / 0.86 / +2.5. Vector wins at every cutoff, largest at @1 —
the rank that matters most for which passage the verdict LLM reads first.

## Methodology

- **Dataset:** the 28 verbatim chunks of the 5 real library PDFs (including
  realistic junk — MDPI page furniture, licence boilerplate — as retrieval
  distractors), with 50 hand-labeled claims: 20 supported (written as
  paraphrases), 10 partially supported (overstatement/causation/intent), 10
  unsupported (contradicted by a passage), 10 insufficient (off-corpus,
  including topic-adjacent hard negatives like Gutenberg and Norwegian
  recidivism).
- **Held-out calibration:** claims split deterministically and stratified
  ~1/3 calibration (n=19) / ~2/3 test (n=31). The similarity floor is chosen
  on the calibration split only, with a parsimony rule (least-restrictive
  floor within 0.02 of the best calibration score — the argmax over a
  50-point grid on 19 claims is noisy). All reported metrics are test-split.
  Selected floor with the LLM provider: 0.0 (the LLM's own relevance
  judgment outperforms any cosine cutoff; the floor remains as a production
  backstop against hallucinated support).
- **Failure accounting:** a verdict API failure is a missing measurement,
  never scored (the first headline attempt silently mapped quota errors to
  `insufficient_evidence` — invalidated and rerun; `api_failures` is now
  reported and must be 0).

## Findings

1. **The asymmetric-embedding bug was the retrieval story.** Queries were
   embedded with `taskType: RETRIEVAL_DOCUMENT`; with the correct
   `RETRIEVAL_QUERY`, vector Recall@5 went from 0.80 (losing to keyword by
   6.25pp) to 0.8875 (winning at every cutoff). Gemini retrieval embeddings
   are asymmetric by design; mixing task types measurably degrades ranking.
2. **The ≥15pp ablation target is not met on this corpus, and honestly so.**
   The Jaccard baseline is strong when claims share proper nouns with their
   sources (Gerlich, Halpern, COMPAS, Northpointe) and the corpus is only 28
   chunks. Vector's edge concentrates at Recall@1 (+5pp) and on pure
   paraphrases. Expectation (S4 stress test, future work): the gap widens
   with corpus size as lexical collisions multiply.
3. **Vector's residual misses are intra-document confusion:** the Gerlich
   paper's 17 substantive chunks are topically near-identical, and ~2.4KB
   multi-topic chunks dilute the specific finding a claim targets. Smaller /
   single-topic chunking is the highest-leverage retrieval improvement.
4. **Hashing-embedder surrogate numbers are not usable as evidence** (vector
   0.79 vs keyword 0.86, macro-F1 0.30 hermetic) — quantifying exactly why
   the pre-S1 headline had to move off the surrogate.

## Reproduction

```bash
# hermetic (hashing + heuristic; shapes and methodology, not headline numbers)
python -m app.eval_harness

# headline (real pipeline)
EMBEDDING_PROVIDER=gemini EVAL_VERDICT_PROVIDER=gemini \
GEMINI_API_KEY=... python -m app.eval_harness
```

The env-gated acceptance test asserts the measured targets:
`tests/test_eval_harness.py::TestAcceptanceTargetsLive`.
