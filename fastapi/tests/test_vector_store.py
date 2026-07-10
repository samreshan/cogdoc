"""
RED phase — tests for the in-memory vector store with cosine retrieval.

This is the semantic-retrieval core that replaces the keyword-overlap path.
It must:
  - store chunks with their embeddings
  - retrieve the top-k by cosine similarity
  - enforce a minimum-similarity floor (below which nothing is returned)
  - scope retrieval to a project's chunks

The store is an abstraction over pgvector: in tests it's in-memory; in
production it's backed by Supabase + pgvector. The interface is identical.
"""
import pytest
from app.vector_store import VectorStore, StoredChunk
from app.embedder import HashingEmbedder


@pytest.fixture
def store():
    return VectorStore(embedder=HashingEmbedder(dim=128))


@pytest.fixture
def populated_store(store: VectorStore):
    """A store with a known set of chunks across two projects."""
    store.ingest(
        project_id="p1",
        pdf_id="pdf-1",
        chunks_text=[
            "Machine learning models learn patterns from training data.",
            "Neural networks use backpropagation to adjust weights.",
            "The cooking recipe calls for pasta, garlic, and olive oil.",
        ],
    )
    store.ingest(
        project_id="p2",
        pdf_id="pdf-2",
        chunks_text=[
            "Quantum computing leverages superposition of qubits.",
        ],
    )
    return store


class TestVectorStoreIngest:
    def test_ingest_stores_chunks_with_embeddings(self, store: VectorStore):
        store.ingest("p1", "pdf-1", ["a text chunk", "another chunk"])
        assert len(store.list_chunks("p1")) == 2

    def test_chunks_are_scoped_per_project(self, populated_store: VectorStore):
        assert len(populated_store.list_chunks("p1")) == 3
        assert len(populated_store.list_chunks("p2")) == 1

    def test_stored_chunk_has_required_fields(self, store: VectorStore):
        store.ingest("p1", "pdf-1", ["some text"])
        chunks = store.list_chunks("p1")
        c = chunks[0]
        assert hasattr(c, "chunk_id")
        assert hasattr(c, "pdf_id")
        assert hasattr(c, "content")
        assert hasattr(c, "page_approx")
        assert hasattr(c, "embedding")


class TestVectorStoreRetrieve:
    def test_retrieves_relevant_chunks_above_floor(self, populated_store: VectorStore):
        results = populated_store.retrieve("p1", "how do neural networks learn", top_k=2, min_score=0.0)
        assert len(results) >= 1
        # The neural-network chunk should rank highly for this query
        assert any("neural" in r.content.lower() for r in results)

    def test_retrieval_is_scoped_to_project(self, populated_store: VectorStore):
        # Querying p1 must never return p2's quantum chunk
        results = populated_store.retrieve("p1", "quantum computing qubits", top_k=5, min_score=0.0)
        assert all("quantum" not in r.content.lower() for r in results)

    def test_results_sorted_by_similarity_descending(self, populated_store: VectorStore):
        results = populated_store.retrieve("p1", "machine learning data", top_k=3, min_score=0.0)
        scores = [r.similarity_score for r in results]
        assert scores == sorted(scores, reverse=True)

    def test_respects_top_k_limit(self, populated_store: VectorStore):
        results = populated_store.retrieve("p1", "learning", top_k=1, min_score=0.0)
        assert len(results) <= 1

    def test_min_score_floor_filters_low_similarity(self, populated_store: VectorStore):
        # A floor of 0.99 should filter out almost everything
        results = populated_store.retrieve("p1", "learning", top_k=5, min_score=0.99)
        # cosine similarity of distinct texts is rarely > 0.99 with hashing embedder
        assert all(r.similarity_score >= 0.99 for r in results)

    def test_retrieved_chunk_has_similarity_score(self, populated_store: VectorStore):
        results = populated_store.retrieve("p1", "neural networks", top_k=1, min_score=0.0)
        assert hasattr(results[0], "similarity_score")
        assert 0.0 <= results[0].similarity_score <= 1.0

    def test_empty_project_returns_empty(self, populated_store: VectorStore):
        results = populated_store.retrieve("nonexistent", "anything", top_k=5, min_score=0.0)
        assert results == []
