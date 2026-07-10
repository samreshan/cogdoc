"""Evaluation metrics for the Citation Sentinel and retrieval ablation.

Pure functions that compute precision/recall/F1 per verdict class and
Recall@k for retrieval. Used by the evaluation harness to turn the IR Report's
"unproven accuracy" gap (§4.2) into measured numbers — and to run the
keyword-vs-vector retrieval ablation that justifies the Sprint 1 migration.

PRODUCT.md §14.3 defines the acceptance targets these metrics feed into.
"""
from __future__ import annotations

from typing import Iterable, Sequence


def precision(predicted: Sequence[str], actual: Sequence[str], label: str) -> float:
    """Of the items predicted as `label`, what fraction were truly `label`?"""
    predicted_as_label = [p for p in predicted if p == label]
    if not predicted_as_label:
        return 0.0
    correct = sum(1 for p, a in zip(predicted, actual) if p == label and a == label)
    return correct / len(predicted_as_label)


def recall(predicted: Sequence[str], actual: Sequence[str], label: str) -> float:
    """Of the items truly `label`, what fraction were predicted as `label`?"""
    actual_as_label = [a for a in actual if a == label]
    if not actual_as_label:
        return 0.0
    correct = sum(1 for p, a in zip(predicted, actual) if p == label and a == label)
    return correct / len(actual_as_label)


def f1(predicted: Sequence[str], actual: Sequence[str], label: str) -> float:
    """Harmonic mean of precision and recall for `label`. 0 when both are 0."""
    p = precision(predicted, actual, label)
    r = recall(predicted, actual, label)
    if p + r == 0:
        return 0.0
    return 2 * p * r / (p + r)


def classification_report(
    predicted: Sequence[str],
    actual: Sequence[str],
    labels: Iterable[str],
) -> dict[str, dict[str, float]]:
    """Per-label precision/recall/f1 across a label set."""
    return {
        label: {
            "precision": precision(predicted, actual, label),
            "recall": recall(predicted, actual, label),
            "f1": f1(predicted, actual, label),
        }
        for label in labels
    }


def recall_at_k(
    retrieved: Sequence[tuple[str, float]],
    relevant_ids: set[str],
    k: int,
) -> float:
    """Recall@k: fraction of relevant items appearing in the top-k retrieved.

    Args:
        retrieved: sequence of (chunk_id, score) sorted by score descending.
        relevant_ids: the set of chunk_ids that are truly relevant.
        k: cutoff rank.

    Returns 0.0 if relevant_ids is empty.
    """
    if not relevant_ids:
        return 0.0
    top_k_ids = {chunk_id for chunk_id, _ in retrieved[:k]}
    hits = len(top_k_ids & relevant_ids)
    return hits / len(relevant_ids)
