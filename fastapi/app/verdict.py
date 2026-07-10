"""Citation Sentinel verdict logic.

The core contract from PRODUCT.md §6.3: given a claim and retrieved evidence
passages (only), classify the claim as supported / partially_supported /
unsupported / insufficient_evidence.

The load-bearing guard: when grounding is weak (max similarity below the floor,
or no passages), the verdict is FORCED to insufficient_evidence — the model is
never allowed to invent support. This is the anti-hallucination invariant.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum


class Verdict(str, Enum):
    SUPPORTED = "supported"
    PARTIALLY_SUPPORTED = "partially_supported"
    UNSUPPORTED = "unsupported"
    INSUFFICIENT_EVIDENCE = "insufficient_evidence"


@dataclass
class EvidenceRef:
    chunk_id: str
    excerpt: str
    similarity_score: float


@dataclass
class VerdictResult:
    verdict: Verdict
    explanation: str
    evidence: list[EvidenceRef] = field(default_factory=list)


def classify_verdict(
    claim: str,
    passages: list[dict],
    model_verdict: str,
    max_similarity: float,
    similarity_floor: float = 0.30,
) -> VerdictResult:
    """Classify a claim against retrieved evidence.

    Args:
        claim: the user-written claim being verified.
        passages: retrieved evidence dicts with keys content, similarity,
            chunk_id (chunk_id optional).
        model_verdict: the LLM's proposed verdict string.
        max_similarity: the highest similarity score among retrieved passages.
        similarity_floor: below this, grounding is too weak to assert anything.

    Returns:
        A VerdictResult. If grounding is weak, the verdict is forced to
        insufficient_evidence regardless of what the model said.
    """
    evidence = [
        EvidenceRef(
            chunk_id=p.get("chunk_id", ""),
            excerpt=p.get("content", ""),
            similarity_score=p.get("similarity", 0.0),
        )
        for p in passages
    ]

    # ── The floor guard: weak grounding forces insufficient_evidence ──
    if not passages or max_similarity < similarity_floor:
        return VerdictResult(
            verdict=Verdict.INSUFFICIENT_EVIDENCE,
            explanation="No sufficiently relevant evidence was found in your research library.",
            evidence=evidence,
        )

    # ── Pass through the model's verdict when grounding is strong enough ──
    try:
        verdict = Verdict(model_verdict)
    except ValueError:
        # Unknown verdict string → safe default
        verdict = Verdict.INSUFFICIENT_EVIDENCE

    explanation = {
        Verdict.SUPPORTED: "The claim is supported by evidence in your research library.",
        Verdict.PARTIALLY_SUPPORTED: "The claim is partially supported; some nuance is missing.",
        Verdict.UNSUPPORTED: "The retrieved evidence contradicts or does not support this claim.",
        Verdict.INSUFFICIENT_EVIDENCE: "No sufficiently relevant evidence was found.",
    }[verdict]

    return VerdictResult(verdict=verdict, explanation=explanation, evidence=evidence)
