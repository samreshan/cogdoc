"""
RED phase — tests for the embedding abstraction.

The embedder must be provider-agnostic (Gemini/OpenAI/local) so the service
is testable with a deterministic mock embedder and swappable in production.
These tests fail until app.embedder is implemented.
"""
from unittest.mock import patch, MagicMock

import pytest
from app.embedder import Embedder, cosine_similarity, HashingEmbedder, GeminiEmbedder


class TestCosineSimilarity:
    def test_identical_vectors_have_similarity_1(self):
        v = [0.1, 0.2, 0.3]
        assert cosine_similarity(v, v) == pytest.approx(1.0)

    def test_orthogonal_vectors_have_similarity_0(self):
        assert cosine_similarity([1.0, 0.0], [0.0, 1.0]) == pytest.approx(0.0)

    def test_opposite_vectors_have_similarity_minus_1(self):
        assert cosine_similarity([1.0, 0.0], [-1.0, 0.0]) == pytest.approx(-1.0)

    def test_zero_vector_returns_zero(self):
        assert cosine_similarity([0.0, 0.0], [1.0, 0.0]) == 0.0

    def test_partial_overlap_between_0_and_1(self):
        sim = cosine_similarity([1.0, 1.0], [1.0, 0.0])
        assert 0.0 < sim < 1.0


class TestEmbedderInterface:
    def test_embedder_is_an_abstract_interface(self):
        # Embedder is a Protocol/ABC that defines embed(text) -> list[float]
        assert hasattr(Embedder, "embed") or hasattr(Embedder, "__call__")


class TestHashingEmbedder:
    """A deterministic, dependency-free embedder for tests and offline dev."""

    def test_returns_fixed_dimension_vector(self):
        emb = HashingEmbedder(dim=64)
        vec = emb.embed("machine learning")
        assert len(vec) == 64

    def test_same_text_produces_same_vector(self):
        emb = HashingEmbedder(dim=32)
        assert emb.embed("hello world") == emb.embed("hello world")

    def test_different_text_usually_produces_different_vector(self):
        emb = HashingEmbedder(dim=128)
        v1 = emb.embed("machine learning models")
        v2 = emb.embed("cooking pasta recipes")
        assert v1 != v2

    def test_embedding_dimension_is_consistent_across_texts(self):
        emb = HashingEmbedder(dim=768)
        for text in ["a", "longer text here", "an even longer text with many words"]:
            assert len(emb.embed(text)) == 768

    def test_implements_embedder_interface(self):
        emb = HashingEmbedder(dim=8)
        assert isinstance(emb, Embedder)


class TestGeminiEmbedder:
    """The real-embedding adapter (text-embedding-004, 768-dim).

    Tests mock the HTTP call so they're hermetic. The adapter POSTs to the
    Generative Language API, parses the embedding vector, and matches the
    Embedder Protocol (configurable dim, deterministic on identical input).
    """

    def _mock_response(self, values):
        resp = MagicMock()
        resp.status_code = 200
        resp.json.return_value = {"embedding": {"values": values}}
        resp.raise_for_status = MagicMock()
        return resp

    def test_returns_a_vector_of_the_configured_dimension(self):
        emb = GeminiEmbedder(api_key="fake-key", dim=3072)
        with patch("app.embedder.httpx.post", return_value=self._mock_response([0.1] * 3072)) as m:
            vec = emb.embed("neural networks")
        assert len(vec) == 3072
        # the request hit the gemini-embedding model with the key
        call_url = str(m.call_args[0][0])
        assert "gemini-embedding" in call_url
        assert "fake-key" in call_url

    def test_same_text_produces_same_vector_when_api_is_deterministic(self):
        emb = GeminiEmbedder(api_key="k", dim=8)
        fixed = self._mock_response([0.5] * 8)
        with patch("app.embedder.httpx.post", return_value=fixed):
            assert emb.embed("hello") == emb.embed("hello")

    def test_raises_on_non_200_response(self):
        emb = GeminiEmbedder(api_key="k", dim=8)
        bad = MagicMock()
        bad.status_code = 403
        bad.raise_for_status.side_effect = Exception("403 Forbidden")
        with patch("app.embedder.httpx.post", return_value=bad):
            with pytest.raises(Exception):
                emb.embed("x")

    def test_implements_embedder_interface(self):
        emb = GeminiEmbedder(api_key="k", dim=8)
        assert isinstance(emb, Embedder)

    def test_embed_call_is_passed_the_text_as_content(self):
        emb = GeminiEmbedder(api_key="k", dim=8)
        with patch("app.embedder.httpx.post", return_value=self._mock_response([0.0] * 8)) as m:
            emb.embed("a claim about cats")
        sent_body = m.call_args[1]["json"]
        # content is a Content object {parts:[{text}]}, per the API schema
        assert sent_body["content"]["parts"][0]["text"] == "a claim about cats"
        assert sent_body["taskType"] == "RETRIEVAL_DOCUMENT"
