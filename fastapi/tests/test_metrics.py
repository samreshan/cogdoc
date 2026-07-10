"""
RED→GREEN — tests for the evaluation metrics (the research contribution's
measurement layer).

These functions compute precision/recall/F1 per verdict class and Recall@k
for retrieval. They're pure and fully unit-testable with known inputs.

This is the layer that turns "the Citation Sentinel's accuracy is unproven"
(IR §4.2) into measured numbers.
"""
import pytest
from app.metrics import (
    precision,
    recall,
    f1,
    classification_report,
    recall_at_k,
)


class TestPrecision:
    def test_all_correct(self):
        assert precision(predicted=["a", "a"], actual=["a", "a"], label="a") == 1.0

    def test_half_correct(self):
        # predicted 2 as 'a', only 1 actually 'a' → 0.5
        assert precision(predicted=["a", "a"], actual=["a", "b"], label="a") == 0.5

    def test_none_predicted_as_label(self):
        assert precision(predicted=["b", "b"], actual=["a", "a"], label="a") == 0.0

    def test_no_predictions_returns_zero(self):
        assert precision(predicted=[], actual=["a"], label="a") == 0.0


class TestRecall:
    def test_all_actual_found(self):
        assert recall(predicted=["a", "a"], actual=["a", "a"], label="a") == 1.0

    def test_half_found(self):
        assert recall(predicted=["a", "b"], actual=["a", "a"], label="a") == 0.5

    def test_none_found(self):
        assert recall(predicted=["b", "b"], actual=["a", "a"], label="a") == 0.0

    def test_no_actual_returns_zero(self):
        assert recall(predicted=["a"], actual=[], label="a") == 0.0


class TestF1:
    def test_perfect_scores(self):
        assert f1(predicted=["a"], actual=["a"], label="a") == 1.0

    def test_zero_when_no_precision_and_no_recall(self):
        assert f1(predicted=["b"], actual=["a"], label="a") == 0.0

    def test_harmonic_mean(self):
        # predicted=["a","a"], actual=["a","b"], label="a"
        # precision = 1/2 = 0.5 (one of two predicted-as-a is truly a)
        # recall = 1/1 = 1.0 (the single actual-a was found)
        # f1 = 2*p*r/(p+r) = 2*0.5*1.0/1.5 = 0.667
        score = f1(predicted=["a", "a"], actual=["a", "b"], label="a")
        assert score == pytest.approx(2 / 3)


class TestClassificationReport:
    def test_reports_per_label_metrics(self):
        report = classification_report(
            predicted=["supported", "unsupported", "supported"],
            actual=["supported", "supported", "unsupported"],
            labels=["supported", "unsupported", "insufficient_evidence"],
        )
        assert "supported" in report
        assert "unsupported" in report
        for label_metrics in report.values():
            assert {"precision", "recall", "f1"} <= set(label_metrics.keys())

    def test_macro_f1_is_average_of_label_f1s(self):
        report = classification_report(
            predicted=["a", "b"],
            actual=["a", "b"],
            labels=["a", "b"],
        )
        macro = sum(m["f1"] for m in report.values()) / len(report)
        # both perfect → macro 1.0
        assert macro == pytest.approx(1.0)


class TestRecallAtK:
    def test_relevant_item_in_top_k(self):
        # retrieved ranks put the relevant chunk at position 1 → hit at k=5
        retrieved = [("relevant", 0.9), ("irrelevant", 0.3)]
        relevant_ids = {"relevant"}
        assert recall_at_k(retrieved, relevant_ids, k=5) == 1.0

    def test_relevant_item_beyond_k_is_miss(self):
        retrieved = [("irrelevant", 0.9), ("relevant", 0.3)]
        relevant_ids = {"relevant"}
        assert recall_at_k(retrieved, relevant_ids, k=1) == 0.0

    def test_no_relevant_items_returns_zero(self):
        assert recall_at_k([("x", 0.9)], set(), k=5) == 0.0

    def test_multiple_relevant(self):
        retrieved = [("r1", 0.9), ("irr", 0.5), ("r2", 0.4)]
        assert recall_at_k(retrieved, {"r1", "r2"}, k=3) == 1.0
        assert recall_at_k(retrieved, {"r1", "r2"}, k=1) == 0.5
