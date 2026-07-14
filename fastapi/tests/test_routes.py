"""
RED→GREEN — integration tests for the FastAPI RAG + citation endpoints.

Uses FastAPI's TestClient (httpx ASGI transport). The app exposes:
  POST /api/rag/ingest   { pdf_id, text, project_id } -> { chunks: [...] }
  POST /api/rag/retrieve { claim, project_id, top_k } -> { passages: [...] }
  POST /api/ai/citation  { claim, project_id }        -> { verdict, evidence, ... }

The app uses a HashingEmbedder + in-memory VectorStore by default (overridable
via dependency injection), so these tests are fully hermetic — no Postgres,
no Gemini, no network.
"""
import pytest
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.fixture
def client():
    return TestClient(create_app())


@pytest.fixture
def ingested_client(client: TestClient):
    """A client with a known PDF ingested into project p1."""
    text = (
        "Neural networks learn patterns by adjusting weights via backpropagation.\n\n"
        "The gradient descent algorithm minimises the loss function iteratively.\n\n"
        "Pasta is traditionally made from durum wheat flour and water."
    )
    client.post(
        "/api/rag/ingest",
        json={"pdf_id": "pdf-1", "project_id": "p1", "text": text},
    )
    return client


class TestHealth:
    def test_root_returns_service_info(self, client: TestClient):
        r = client.get("/")
        assert r.status_code == 200
        body = r.json()
        assert body["service"] == "cogdoc-rag"


class TestRagIngest:
    def test_ingests_text_and_returns_chunk_ids(self, client: TestClient):
        r = client.post(
            "/api/rag/ingest",
            json={
                "pdf_id": "pdf-1",
                "project_id": "p1",
                "text": "First paragraph here.\n\nSecond paragraph here with more words.",
            },
        )
        assert r.status_code == 200
        body = r.json()
        assert "chunks" in body
        assert len(body["chunks"]) >= 1
        chunk = body["chunks"][0]
        assert "chunk_id" in chunk
        assert "chunk_index" in chunk
        assert "page_approx" in chunk

    def test_empty_text_returns_empty_chunks(self, client: TestClient):
        r = client.post(
            "/api/rag/ingest",
            json={"pdf_id": "pdf-1", "project_id": "p1", "text": ""},
        )
        assert r.status_code == 200
        assert r.json()["chunks"] == []

    def test_missing_required_fields_returns_422(self, client: TestClient):
        r = client.post("/api/rag/ingest", json={"pdf_id": "pdf-1"})
        assert r.status_code == 422

    def test_explicit_chunks_stored_verbatim(self, client: TestClient):
        """When `chunks` is sent, those ids + contents are stored verbatim —
        the BFF is the source of truth so FastAPI does NOT re-chunk. This keeps
        FastAPI chunk ids == SQLite PdfChunk.id (cuids)."""
        r = client.post(
            "/api/rag/ingest",
            json={
                "pdf_id": "pdf-1",
                "project_id": "p1",
                "chunks": [
                    {"content": "First passage about neural nets.", "chunk_id": "cuid-aaa"},
                    {"content": "Second passage about gradient descent.", "chunk_id": "cuid-bbb"},
                ],
            },
        )
        assert r.status_code == 200
        out = r.json()["chunks"]
        assert [c["chunk_id"] for c in out] == ["cuid-aaa", "cuid-bbb"]

    def test_explicit_chunk_ids_round_trip_through_retrieve(self, client: TestClient):
        """The stored cuid-style ids must come back verbatim on retrieve, so
        the Citation Sentinel's evidence deep-links resolve to SQLite rows."""
        client.post(
            "/api/rag/ingest",
            json={
                "pdf_id": "pdf-1",
                "project_id": "p1",
                "chunks": [
                    {"content": "Neural networks learn via backpropagation.", "chunk_id": "cuid-neural"},
                    {"content": "Totally unrelated filler about pasta.", "chunk_id": "cuid-other"},
                ],
            },
        )
        r = client.post(
            "/api/rag/retrieve",
            json={"claim": "neural networks", "project_id": "p1", "top_k": 5},
        )
        ids = {p["chunk_id"] for p in r.json()["passages"]}
        assert "cuid-neural" in ids

    def test_text_only_call_still_autogenerates_ids_back_compat(self, client: TestClient):
        """Existing callers that send only {text} must keep working: the
        endpoint chunks the text and auto-generates chunk-<n> ids."""
        r = client.post(
            "/api/rag/ingest",
            json={"pdf_id": "pdf-1", "project_id": "p1", "text": "Some paragraph.\n\nAnother."},
        )
        assert r.status_code == 200
        for c in r.json()["chunks"]:
            assert c["chunk_id"].startswith("chunk-")

    def test_neither_text_nor_chunks_is_422(self, client: TestClient):
        """At least one of text/chunks must be supplied."""
        r = client.post(
            "/api/rag/ingest", json={"pdf_id": "pdf-1", "project_id": "p1"},
        )
        assert r.status_code == 422


class TestRagRetrieve:
    def test_retrieves_relevant_passages(self, ingested_client: TestClient):
        r = ingested_client.post(
            "/api/rag/retrieve",
            json={"claim": "how do neural networks learn", "project_id": "p1", "top_k": 2},
        )
        assert r.status_code == 200
        passages = r.json()["passages"]
        assert len(passages) >= 1
        # the neural-network chunk should rank first
        assert "neural" in passages[0]["text"].lower()
        assert "score" in passages[0]
        assert "chunk_id" in passages[0]

    def test_retrieval_is_scoped_to_project(self, ingested_client: TestClient):
        # querying a different project returns nothing
        r = ingested_client.post(
            "/api/rag/retrieve",
            json={"claim": "neural networks", "project_id": "other-project", "top_k": 5},
        )
        assert r.json()["passages"] == []

    def test_missing_project_returns_empty(self, client: TestClient):
        r = client.post(
            "/api/rag/retrieve",
            json={"claim": "anything", "project_id": "empty", "top_k": 5},
        )
        assert r.json()["passages"] == []


class TestCitation:
    def test_returns_verdict_taxonomy_fields(self, ingested_client: TestClient):
        r = ingested_client.post(
            "/api/ai/citation",
            json={"claim": "Neural networks learn via backpropagation.", "project_id": "p1"},
        )
        assert r.status_code == 200
        body = r.json()
        assert body["verdict"] in (
            "supported",
            "partially_supported",
            "unsupported",
            "insufficient_evidence",
        )
        assert "explanation" in body
        assert isinstance(body["evidence"], list)

    def test_weak_grounding_forces_insufficient_evidence(self, ingested_client: TestClient):
        # A claim totally unrelated to the ingested texts → low similarity →
        # the floor guard must force insufficient_evidence.
        r = ingested_client.post(
            "/api/ai/citation",
            json={"claim": "The Eiffel Tower is located in Tokyo Japan.", "project_id": "p1"},
        )
        body = r.json()
        assert body["verdict"] == "insufficient_evidence"

    def test_evidence_items_carry_chunk_id_and_excerpt(self, ingested_client: TestClient):
        r = ingested_client.post(
            "/api/ai/citation",
            json={"claim": "gradient descent minimises loss", "project_id": "p1"},
        )
        body = r.json()
        for ev in body["evidence"]:
            assert "chunk_id" in ev
            assert "excerpt" in ev
            assert "score" in ev
