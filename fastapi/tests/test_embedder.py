"""
RED phase — tests for the embedding abstraction.

The embedder must be provider-agnostic (Gemini/OpenAI/local) so the service
is testable with a deterministic mock embedder and swappable in production.
These tests fail until app.embedder is implemented.
"""
import pytest
from app.embedder import Embedder, cosine_similarity, HashingEmbedder


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
