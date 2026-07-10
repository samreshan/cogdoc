"""Evaluation harness — runs the Citation Sentinel over a labeled ground-truth
set and reports precision/recall/F1 + Recall@k, for both keyword and vector
retrieval.

This is the keyword-vs-vector ablation that justifies the Sprint 1 migration
(PRODUCT.md §14.3): it produces real numbers showing semantic retrieval beats
keyword overlap on Recall@k.

Runnable:  python -m app.eval_harness
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field

from app.chunker import chunk_text
from app.embedder import HashingEmbedder
from app.eval_data import SOURCE_PASSAGES, CLAIMS, VERDICT_LABELS
from app.metrics import classification_report, recall_at_k
from app.vector_store import VectorStore


@dataclass
class AblationResult:
    """The outcome of evaluating one retriever over the ground-truth set."""
    retriever_name: str
    verdict_report: dict  # label -> {precision, recall, f1}
    macro_f1: float
    recall_at_5_supported: float
    per_claim: list = field(default_factory=list)


def _keyword_retrieve(query: str, passages, top_k: int = 5) -> list[tuple[str, float]]:
    """The MVP's keyword-overlap retrieval, replicated for the ablation."""
    import re
    stop = {"the", "a", "an", "is", "are", "that", "of", "and", "to", "in", "by", "for", "with"}

    def toks(t: str) -> set[str]:
        return {w for w in re.findall(r"[a-z]+", t.lower()) if len(w) > 2 and w not in stop}

    q_tokens = toks(query)
    scored = []
    for p in passages:
        p_tokens = toks(p["text"])
        if not p_tokens:
            scored.append((p["chunk_id"], 0.0))
            continue
        union = q_tokens | p_tokens
        inter = q_tokens & p_tokens
        score = len(inter) / len(union) if union else 0.0
        scored.append((p["chunk_id"], score))
    scored.sort(key=lambda x: x[1], reverse=True)
    return scored[:top_k]


def evaluate_vector(store: VectorStore, verdict_provider) -> AblationResult:
    """Evaluate vector retrieval + the verdict classifier."""
    predicted_verdicts: list[str] = []
    actual_verdicts: list[str] = []
    per_claim = []
    recall_at_5_supported_hits = []
    recall_at_5_supported_total = []

    for c in CLAIMS:
        retrieved = store.retrieve("eval", c["claim"], top_k=5, min_score=0.0)
        retrieved_pairs = [(r.chunk_id, r.similarity_score) for r in retrieved]
        max_sim = max((r.similarity_score for r in retrieved), default=0.0)
        passages = [
            {"content": r.content, "similarity": r.similarity_score, "chunk_id": r.chunk_id}
            for r in retrieved
        ]
        from app.verdict import classify_verdict
        result = classify_verdict(
            claim=c["claim"],
            passages=passages,
            model_verdict=verdict_provider(c["claim"], passages),
            max_similarity=max_sim,
            similarity_floor=0.30,
        )
        predicted_verdicts.append(result.verdict.value)
        actual_verdicts.append(c["expected_verdict"])

        if c["expected_verdict"] == "supported":
            recall_at_5_supported_hits.append(
                recall_at_k(retrieved_pairs, c["relevant_ids"], k=5)
            )
            recall_at_5_supported_total.append(1)

        per_claim.append({
            "claim": c["claim"],
            "expected": c["expected_verdict"],
            "predicted": result.verdict.value,
            "max_similarity": max_sim,
        })

    report = classification_report(predicted_verdicts, actual_verdicts, VERDICT_LABELS)
    macro_f1 = sum(m["f1"] for m in report.values()) / len(report)
    r5 = (
        sum(recall_at_5_supported_hits) / len(recall_at_5_supported_hits)
        if recall_at_5_supported_hits
        else 0.0
    )
    return AblationResult(
        retriever_name="vector (HashingEmbedder)",
        verdict_report=report,
        macro_f1=macro_f1,
        recall_at_5_supported=r5,
        per_claim=per_claim,
    )


def evaluate_keyword(verdict_provider) -> AblationResult:
    """Evaluate keyword-overlap retrieval + Recall@5."""
    recall_at_5_supported_hits = []
    for c in CLAIMS:
        retrieved = _keyword_retrieve(c["claim"], SOURCE_PASSAGES, top_k=5)
        if c["expected_verdict"] == "supported":
            recall_at_5_supported_hits.append(
                recall_at_k(retrieved, c["relevant_ids"], k=5)
            )
    r5 = (
        sum(recall_at_5_supported_hits) / len(recall_at_5_supported_hits)
        if recall_at_5_supported_hits
        else 0.0
    )
    return AblationResult(
        retriever_name="keyword (Jaccard overlap)",
        verdict_report={},  # keyword path doesn't feed the verdict classifier here
        macro_f1=0.0,
        recall_at_5_supported=r5,
    )


def run_ablation() -> dict:
    """Run both retrievers over the ground-truth set and return a comparison."""
    embedder = HashingEmbedder(dim=256)
    store = VectorStore(embedder=embedder)
    # Ingest with explicit chunk_ids so they align with CLAIMS' relevant_ids.
    store.ingest(
        project_id="eval",
        pdf_id="eval-corpus",
        chunks_text=[p["text"] for p in SOURCE_PASSAGES],
        chunk_ids=[p["chunk_id"] for p in SOURCE_PASSAGES],
    )

    # Use the heuristic verdict provider (no LLM needed for the ablation)
    from app.main import _heuristic_verdict_provider
    vprovider = _heuristic_verdict_provider

    vector_result = evaluate_vector(store, vprovider)
    keyword_result = evaluate_keyword(vprovider)

    return {
        "vector": {
            "retriever": vector_result.retriever_name,
            "macro_f1": vector_result.macro_f1,
            "recall_at_5_supported": vector_result.recall_at_5_supported,
            "verdict_report": vector_result.verdict_report,
        },
        "keyword": {
            "retriever": keyword_result.retriever_name,
            "recall_at_5_supported": keyword_result.recall_at_5_supported,
        },
        "recall_at_5_delta_pp": (vector_result.recall_at_5_supported - keyword_result.recall_at_5_supported) * 100,
        "per_claim": vector_result.per_claim,
    }


if __name__ == "__main__":
    print(json.dumps(run_ablation(), indent=2))
