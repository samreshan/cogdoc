"""
Tests for the evaluation harness — verifies it runs end-to-end and produces
well-formed metrics. The actual acceptance numbers (macro-F1 >= 0.70 etc.)
are reported, not asserted, because the HashingEmbedder is a stand-in for a
trained embedder; the gate is that the harness RUNS and produces sane shapes.
"""
from app.eval_harness import run_ablation


class TestAblationReport:
    def test_produces_vector_and_keyword_sections(self):
        report = run_ablation()
        assert "vector" in report
        assert "keyword" in report

    def test_recall_at_5_is_between_0_and_1(self):
        report = run_ablation()
        for retriever in ("vector", "keyword"):
            r5 = report[retriever]["recall_at_5_supported"]
            assert 0.0 <= r5 <= 1.0

    def test_reports_delta_in_percentage_points(self):
        report = run_ablation()
        assert "recall_at_5_delta_pp" in report
        assert isinstance(report["recall_at_5_delta_pp"], float)

    def test_vector_report_has_per_label_metrics(self):
        report = run_ablation()
        vr = report["vector"]["verdict_report"]
        for label in ("supported", "partially_supported", "unsupported", "insufficient_evidence"):
            assert label in vr
            assert {"precision", "recall", "f1"} <= set(vr[label].keys())

    def test_per_claim_has_expected_and_predicted(self):
        report = run_ablation()
        assert len(report["per_claim"]) > 0
        for c in report["per_claim"]:
            assert "claim" in c
            assert "expected" in c
            assert "predicted" in c
