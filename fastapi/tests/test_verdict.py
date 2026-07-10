"""
RED phase — tests for the citation verdict logic.

This encodes the Citation Sentinel's core contract from PRODUCT.md §6.3:
given a claim and retrieved evidence passages (only), return a verdict.
Critically, when grounding is weak the verdict MUST be insufficient_evidence
— the model is never allowed to invent support.

The verdict function is pure: given (claim, passages, max_similarity) it
returns a VerdictResult. The LLM call wraps this; the logic is testable
without any model.
"""
import pytest
from app.verdict import (
    VerdictResult,
    classify_verdict,
    Verdict,
)


class TestVerdictFloorGuard:
    """The most important guard: weak grounding forces insufficient_evidence."""

    def test_low_max_similarity_forces_insufficient_evidence(self):
        # Even if a (mocked) model said "supported", a max-sim floor of 0.20
        # must override to insufficient_evidence.
        result = classify_verdict(
            claim="some claim",
            passages=[{"content": "unrelated text", "similarity": 0.15}],
            model_verdict="supported",  # model hallucinated support
            max_similarity=0.15,
            similarity_floor=0.30,
        )
        assert result.verdict == Verdict.INSUFFICIENT_EVIDENCE

    def test_no_passages_forces_insufficient_evidence(self):
        result = classify_verdict(
            claim="a claim",
            passages=[],
            model_verdict="supported",
            max_similarity=0.0,
            similarity_floor=0.30,
        )
        assert result.verdict == Verdict.INSUFFICIENT_EVIDENCE


class TestVerdictClassification:
    def test_passes_through_supported_when_grounding_is_strong(self):
        result = classify_verdict(
            claim="neural networks learn via backpropagation",
            passages=[{"content": "Neural networks learn via backpropagation.", "similarity": 0.85}],
            model_verdict="supported",
            max_similarity=0.85,
            similarity_floor=0.30,
        )
        assert result.verdict == Verdict.SUPPORTED

    def test_passes_through_partially_supported(self):
        result = classify_verdict(
            claim="some nuanced claim",
            passages=[{"content": "related but incomplete evidence", "similarity": 0.6}],
            model_verdict="partially_supported",
            max_similarity=0.6,
            similarity_floor=0.30,
        )
        assert result.verdict == Verdict.PARTIALLY_SUPPORTED

    def test_passes_through_unsupported(self):
        result = classify_verdict(
            claim="the sky is green",
            passages=[{"content": "the sky is blue during the day", "similarity": 0.5}],
            model_verdict="unsupported",
            max_similarity=0.5,
            similarity_floor=0.30,
        )
        assert result.verdict == Verdict.UNSUPPORTED

    def test_unknown_model_verdict_defaults_to_insufficient(self):
        result = classify_verdict(
            claim="x",
            passages=[{"content": "y", "similarity": 0.7}],
            model_verdict="nonsense_value",
            max_similarity=0.7,
            similarity_floor=0.30,
        )
        assert result.verdict == Verdict.INSUFFICIENT_EVIDENCE


class TestVerdictResultShape:
    def test_result_has_verdict_explanation_and_evidence_refs(self):
        result = classify_verdict(
            claim="a claim",
            passages=[{"content": "evidence", "similarity": 0.8, "chunk_id": "c1"}],
            model_verdict="supported",
            max_similarity=0.8,
            similarity_floor=0.30,
        )
        assert isinstance(result, VerdictResult)
        assert hasattr(result, "verdict")
        assert hasattr(result, "explanation")
        assert hasattr(result, "evidence")

    def test_evidence_carries_chunk_refs_and_excerpts(self):
        result = classify_verdict(
            claim="a claim",
            passages=[{"content": "the supporting passage text", "similarity": 0.8, "chunk_id": "c1"}],
            model_verdict="supported",
            max_similarity=0.8,
            similarity_floor=0.30,
        )
        assert len(result.evidence) == 1
        ev = result.evidence[0]
        assert ev.chunk_id == "c1"
        assert "supporting passage" in ev.excerpt
