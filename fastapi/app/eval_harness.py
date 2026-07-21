"""Evaluation harness v2 — Citation Sentinel over the REAL ground-truth set.

Runs the keyword-vs-vector retrieval ablation and the verdict classification
evaluation (PRODUCT.md §14.3) over the 50-claim / 28-passage real-corpus set
(app/eval_data_real.py — the S1 dataset).

Methodology:
  - Retrieval (provider-independent): Recall@5 over every claim with labeled
    relevant chunks (supported + partial + unsupported = 40 claims), for both
    the keyword baseline and the vector store. No fitting → whole set.
  - Verdicts (provider-dependent): claims are split deterministically and
    stratified into a calibration third and a held-out test set. The
    similarity floor (and the heuristic's supported-threshold) are chosen on
    the calibration split only; macro-F1 is reported on the held-out test
    split. This is what makes the number honest: per-embedder thresholds are
    required (Gemini's cosine range is compressed ~0.72–0.98 where the
    HashingEmbedder's is sparse ~0.0–0.6), and tuning them on the reporting
    set would overfit.

Embedder resolves from env exactly like the service (ADR-0008):
  EMBEDDING_PROVIDER=gemini + GEMINI_API_KEY → GeminiEmbedder (headline run)
  else                                        → HashingEmbedder (hermetic)

Verdict provider resolves from env:
  EVAL_VERDICT_PROVIDER=gemini + GEMINI_API_KEY → Gemini LLM verdicts (the
      production-shaped number; the LLM sees claim + retrieved passages only)
  else                                          → similarity heuristic
      (hermetic; cannot detect contradiction, so `unsupported` recall is
      structurally limited — reported, not hidden)

Runnable:  python -m app.eval_harness
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass, field

from app.embedder import Embedder, HashingEmbedder
from app.eval_data_real import SOURCE_PASSAGES, CLAIMS, VERDICT_LABELS
from app.metrics import classification_report, recall_at_k
from app.vector_store import VectorStore
from app.verdict import classify_verdict


# ── Env resolution ─────────────────────────────────────────────────────────

def embedder_from_env() -> Embedder:
    """Resolve the ablation embedder from env, mirroring create_app_from_env."""
    provider = os.environ.get("EMBEDDING_PROVIDER", "hashing").lower()
    if provider == "gemini" and os.environ.get("GEMINI_API_KEY"):
        from app.embedder import GeminiEmbedder

        return GeminiEmbedder()
    return HashingEmbedder(dim=256)


def verdict_provider_from_env():
    """Resolve the verdict provider: Gemini LLM when opted in, else heuristic.

    Returns (provider_name, provider) where provider(claim, passages) -> str.
    The heuristic's thresholds are calibrated later, so here it returns None
    and the harness builds it with calibrated params.
    """
    if (
        os.environ.get("EVAL_VERDICT_PROVIDER", "").lower() == "gemini"
        and os.environ.get("GEMINI_API_KEY")
    ):
        return "gemini-llm", gemini_verdict_provider
    return "heuristic", None


# gemini-3.1-flash-lite: the lite tier is the only one with a workable free
# request quota on this key (gemini-2.0-flash reports limit 0 and
# gemini-2.5-flash caps at 20/day). Thinking is disabled per-call — verdict
# classification needs none and thinking tokens would eat the output budget.
GEMINI_VERDICT_MODEL = os.environ.get("EVAL_VERDICT_MODEL", "gemini-3.1-flash-lite")


class VerdictAPIError(RuntimeError):
    """The verdict API failed after retries. Raised instead of returning a
    fabricated verdict — an API failure is a missing measurement, not an
    insufficient_evidence datapoint. The harness counts these separately."""

_VERDICT_PROMPT = """You are a citation verifier. Given a CLAIM and EVIDENCE passages
retrieved from the writer's research library, classify the claim strictly from
the evidence shown (not your own knowledge). Answer with exactly one word:

supported — the evidence asserts the claim
partially_supported — the evidence supports part of it, but the claim overstates
  or adds specifics the evidence does not contain
unsupported — the evidence contradicts the claim
insufficient_evidence — the evidence is not relevant enough to judge the claim

CLAIM: {claim}

EVIDENCE:
{evidence}

One-word verdict:"""


def gemini_verdict_provider(claim: str, passages: list[dict]) -> str:
    """LLM verdict via the Gemini generateContent API (same key as embeddings).

    The model sees ONLY the claim and the retrieved passages — the same
    contract as production (§6.3). Retries with backoff on 429; raises
    VerdictAPIError on hard failure so a failed call is counted as a missing
    measurement rather than silently scored as insufficient_evidence (that
    conflation invalidated the first headline run).
    """
    import time

    import httpx

    evidence = "\n---\n".join(p.get("content", "")[:1200] for p in passages[:5]) or "(none)"
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{GEMINI_VERDICT_MODEL}:generateContent?key={os.environ['GEMINI_API_KEY']}"
    )
    body = {
        "contents": [{"parts": [{"text": _VERDICT_PROMPT.format(claim=claim, evidence=evidence)}]}],
        "generationConfig": {
            "temperature": 0.0,
            "maxOutputTokens": 50,
            "thinkingConfig": {"thinkingBudget": 0},
        },
    }
    time.sleep(1.5)  # polite pacing under free-tier RPM limits
    last_error: Exception | None = None
    for attempt in range(5):
        try:
            resp = httpx.post(url, json=body, timeout=30.0)
            if resp.status_code == 429:
                last_error = RuntimeError(f"429 after attempt {attempt + 1}")
                time.sleep(15 * (attempt + 1))
                continue
            resp.raise_for_status()
            text = resp.json()["candidates"][0]["content"]["parts"][0]["text"].strip().lower()
            # match longest labels first: "supported" is a substring of the others
            for label in sorted(VERDICT_LABELS, key=len, reverse=True):
                if label in text:
                    return label
            raise VerdictAPIError(f"unparseable verdict: {text!r}")
        except VerdictAPIError:
            raise
        except Exception as e:  # network / HTTP / schema errors
            last_error = e
            time.sleep(5)
    raise VerdictAPIError(f"verdict API failed after retries: {last_error}")


def make_heuristic_provider(t_supported: float):
    """Similarity heuristic with a calibratable supported-threshold.

    Above t_supported with token overlap → supported; else partially_supported
    (the floor guard downstream forces insufficient below the floor). It has
    no contradiction detector, so `unsupported` is out of reach by design —
    a documented limitation of the hermetic path.
    """

    def provider(claim: str, passages: list[dict]) -> str:
        if not passages:
            return "insufficient_evidence"
        best = max(passages, key=lambda p: p.get("similarity", 0.0))
        claim_tokens = {t for t in claim.lower().split() if len(t) > 3}
        passage_tokens = {t for t in best.get("content", "").lower().split() if len(t) > 3}
        overlap = len(claim_tokens & passage_tokens)
        if best.get("similarity", 0.0) >= t_supported and overlap >= 2:
            return "supported"
        return "partially_supported"

    return provider


# ── Split + retrieval plumbing ─────────────────────────────────────────────

def split_claims(claims=None) -> tuple[list, list]:
    """Deterministic stratified split: within each verdict class, every 3rd
    claim goes to calibration (~1/3), the rest to the held-out test set."""
    claims = CLAIMS if claims is None else claims
    calib, test = [], []
    by_class: dict[str, list] = {}
    for c in claims:
        by_class.setdefault(c["expected_verdict"], []).append(c)
    for _, rows in sorted(by_class.items()):
        for i, c in enumerate(rows):
            (calib if i % 3 == 0 else test).append(c)
    return calib, test


@dataclass
class Retrieval:
    """Cached retrieval for one claim (so calibration never re-embeds)."""
    claim: dict
    pairs: list = field(default_factory=list)      # [(chunk_id, score)] desc
    passages: list = field(default_factory=list)   # verdict-provider input
    max_similarity: float = 0.0


def _retrieve_all(store: VectorStore, claims: list) -> list[Retrieval]:
    out = []
    for c in claims:
        retrieved = store.retrieve("eval", c["claim"], top_k=5, min_score=0.0)
        out.append(
            Retrieval(
                claim=c,
                pairs=[(r.chunk_id, r.similarity_score) for r in retrieved],
                passages=[
                    {"content": r.content, "similarity": r.similarity_score, "chunk_id": r.chunk_id}
                    for r in retrieved
                ],
                max_similarity=max((r.similarity_score for r in retrieved), default=0.0),
            )
        )
    return out


def _keyword_retrieve(query: str, passages, top_k: int = 5) -> list[tuple[str, float]]:
    """The MVP's keyword-overlap (Jaccard) retrieval — the ablation baseline."""
    import re

    stop = {"the", "a", "an", "is", "are", "that", "of", "and", "to", "in", "by", "for", "with"}

    def toks(t: str) -> set[str]:
        return {w for w in re.findall(r"[a-z]+", t.lower()) if len(w) > 2 and w not in stop}

    q_tokens = toks(query)
    scored = []
    for p in passages:
        p_tokens = toks(p["text"])
        union = q_tokens | p_tokens
        inter = q_tokens & p_tokens
        scored.append((p["chunk_id"], len(inter) / len(union) if union else 0.0))
    scored.sort(key=lambda x: x[1], reverse=True)
    return scored[:top_k]


# ── Calibration ────────────────────────────────────────────────────────────

FLOOR_GRID = [round(0.02 * i, 2) for i in range(50)]        # 0.00 … 0.98
T_SUPPORTED_GRID = [round(0.02 * i, 2) for i in range(1, 50)]


def _macro_f1(predicted: list[str], actual: list[str]) -> float:
    report = classification_report(predicted, actual, VERDICT_LABELS)
    return sum(m["f1"] for m in report.values()) / len(report)


def _evaluate(retrievals: list[Retrieval], provider, floor: float):
    """Score claims through classify_verdict. Claims whose provider call
    raises VerdictAPIError are EXCLUDED from the metrics and counted — a
    failed API call is a missing measurement, not a datapoint."""
    predicted, actual, failed = [], [], []
    for r in retrievals:
        try:
            model_verdict = provider(r.claim["claim"], r.passages)
        except VerdictAPIError:
            failed.append(r.claim["claim"])
            continue
        result = classify_verdict(
            claim=r.claim["claim"],
            passages=r.passages,
            model_verdict=model_verdict,
            max_similarity=r.max_similarity,
            similarity_floor=floor,
        )
        predicted.append(result.verdict.value)
        actual.append(r.claim["expected_verdict"])
    return predicted, actual, failed


def calibrate(calib_retrievals: list[Retrieval], provider=None) -> dict:
    """Choose thresholds on the calibration split only.

    With an external provider (LLM): its verdicts are computed once per claim
    (they don't depend on the floor), then the floor alone is grid-searched.
    Without one: (floor, t_supported) are grid-searched jointly over the
    parameterised heuristic (pure functions — no API calls).
    """
    if provider is not None:
        cached: dict[str, str] = {}
        api_failures = 0
        for r in calib_retrievals:
            try:
                cached[r.claim["claim"]] = provider(r.claim["claim"], r.passages)
            except VerdictAPIError:
                api_failures += 1
        scored = [r for r in calib_retrievals if r.claim["claim"] in cached]
        cached_provider = lambda claim, passages: cached[claim]  # noqa: E731
        scores = [(f, _macro_f1(*_evaluate(scored, cached_provider, f)[:2])) for f in FLOOR_GRID]
        best_score = max(s for _, s in scores)
        # Parsimony rule (1-SE style): the argmax over a 50-point grid on a
        # ~19-claim calibration split is noisy, so among floors within 0.02
        # of the best calib score, choose the LEAST restrictive (smallest).
        # With an LLM verdict provider the floor is only a backstop against
        # hallucinated support — prefer minimal intervention.
        floor = min(f for f, s in scores if s >= best_score - 0.02)
        floor_score = dict(scores)[floor]
        return {
            "similarity_floor": floor,
            "t_supported": None,
            "calib_macro_f1": floor_score,
            "calib_api_failures": api_failures,
        }

    best_score, best_floor, best_t = -1.0, 0.0, 0.5
    for t in T_SUPPORTED_GRID:
        heuristic = make_heuristic_provider(t)
        for f in FLOOR_GRID:
            if f > t:
                continue
            score = _macro_f1(*_evaluate(calib_retrievals, heuristic, f)[:2])
            if score > best_score:
                best_score, best_floor, best_t = score, f, t
    return {
        "similarity_floor": best_floor,
        "t_supported": best_t,
        "calib_macro_f1": best_score,
        "calib_api_failures": 0,
    }


# ── The ablation ───────────────────────────────────────────────────────────

def run_ablation(embedder=None, verdict_provider=None) -> dict:
    """Run retrieval ablation + calibrated verdict evaluation.

    Args:
        embedder: vector-path embedder; defaults to env resolution
            (Gemini when EMBEDDING_PROVIDER=gemini, else the hashing surrogate).
        verdict_provider: callable(claim, passages) -> verdict str; defaults to
            env resolution (Gemini LLM when EVAL_VERDICT_PROVIDER=gemini, else
            the calibrated similarity heuristic).
    """
    if embedder is None:
        embedder = embedder_from_env()
    provider_name, provider = (
        ("injected", verdict_provider) if verdict_provider is not None else verdict_provider_from_env()
    )

    store = VectorStore(embedder=embedder)
    store.ingest(
        project_id="eval",
        pdf_id="eval-corpus",
        chunks_text=[p["text"] for p in SOURCE_PASSAGES],
        chunk_ids=[p["chunk_id"] for p in SOURCE_PASSAGES],
    )

    retrievals = {r.claim["claim"]: r for r in _retrieve_all(store, CLAIMS)}

    # ── Retrieval ablation: all claims with labeled relevant chunks ────────
    evidence_claims = [c for c in CLAIMS if c["relevant_ids"]]
    kw_pairs = {c["claim"]: _keyword_retrieve(c["claim"], SOURCE_PASSAGES) for c in evidence_claims}
    recall_by_k = {}
    for k in (1, 3, 5):
        vec = [recall_at_k(retrievals[c["claim"]].pairs, c["relevant_ids"], k=k) for c in evidence_claims]
        kw = [recall_at_k(kw_pairs[c["claim"]], c["relevant_ids"], k=k) for c in evidence_claims]
        recall_by_k[k] = (sum(vec) / len(vec), sum(kw) / len(kw))
    vector_recall, keyword_recall = recall_by_k[5]

    # ── Verdicts: calibrate on the calib split, report on held-out test ────
    calib_claims, test_claims = split_claims()
    calib_retr = [retrievals[c["claim"]] for c in calib_claims]
    test_retr = [retrievals[c["claim"]] for c in test_claims]

    calibration = calibrate(calib_retr, provider)
    floor = calibration["similarity_floor"]
    eval_provider = provider if provider is not None else make_heuristic_provider(calibration["t_supported"])

    predicted, actual, failed = _evaluate(test_retr, eval_provider, floor)
    report = classification_report(predicted, actual, VERDICT_LABELS)
    macro_f1 = sum(m["f1"] for m in report.values()) / len(report)

    scored_retr = [r for r in test_retr if r.claim["claim"] not in set(failed)]
    per_claim = [
        {
            "claim": r.claim["claim"],
            "expected": a,
            "predicted": p,
            "max_similarity": r.max_similarity,
        }
        for r, p, a in zip(scored_retr, predicted, actual)
    ]

    return {
        "dataset": {"passages": len(SOURCE_PASSAGES), "claims": len(CLAIMS), "evidence_claims": len(evidence_claims)},
        "embedder": type(embedder).__name__,
        "verdict_provider": provider_name,
        "retrieval": {
            "vector_recall_at_5": vector_recall,
            "keyword_recall_at_5": keyword_recall,
            "delta_pp": (vector_recall - keyword_recall) * 100,
            "by_k": {
                str(k): {"vector": v, "keyword": kw, "delta_pp": (v - kw) * 100}
                for k, (v, kw) in recall_by_k.items()
            },
        },
        "calibration": {**calibration, "calib_n": len(calib_claims), "test_n": len(test_claims)},
        "verdicts": {
            "macro_f1": macro_f1,
            "n_scored": len(predicted),
            "api_failures": len(failed),
            "report": report,
        },
        "per_claim": per_claim,
    }


if __name__ == "__main__":
    print(json.dumps(run_ablation(), indent=2))
