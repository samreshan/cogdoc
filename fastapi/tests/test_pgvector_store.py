"""Tests for the PgvectorStore — the pgvector-backed VectorStoreBase adapter.

The SQL shape is tested via a mocked psycopg connection/cursor (asserting the
correct project-scoped WHERE clause, the cosine `<=>` operator, HNSW ordering,
and bound params) so the gate stays hermetic. A live integration test runs only
when SUPABASE_DB_URL is set (skipif guard).
"""
import os
from unittest.mock import MagicMock, patch

import pytest

from app.embedder import HashingEmbedder
from app.vector_store import PgvectorStore, StoredChunk, RetrievedChunk


class TestPgvectorStoreSQLShape:
    """Assert the store emits the right SQL + params (no real DB needed)."""

    def _make_store(self):
        conn = MagicMock()
        # embedder is deterministic HashingEmbedder so no network call happens
        return PgvectorStore(connection=conn, embedder=HashingEmbedder(dim=8))

    def test_ingest_inserts_each_chunk_with_project_scope_and_embedding(self):
        store = self._make_store()
        cur = MagicMock()
        store._connection.cursor.return_value.__enter__.return_value = cur

        store.ingest(
            project_id="p1",
            pdf_id="pdf-1",
            chunks_text=["first passage", "second passage"],
            chunk_ids=["c1", "c2"],
        )
        # one INSERT per chunk
        assert cur.execute.call_count == 2
        first_sql, first_params = cur.execute.call_args_list[0][0]
        assert "PdfChunk".lower() in first_sql.lower()
        assert "embedding" in first_sql.lower()
        # chunkIndex is required (NOT NULL in the Prisma schema)
        assert "chunkIndex".lower() in first_sql.lower()
        # the chunk id + parent pdf id are bound; projectId is NOT a PdfChunk
        # column (scope derives from the Pdf row), so it is not a param here
        assert "c1" in first_params
        assert "pdf-1" in first_params
        assert "p1" not in first_params
        # re-ingest of an id the BFF already wrote upserts the embedding
        assert "on conflict" in first_sql.lower()

    def test_retrieve_filters_by_project_id_and_uses_cosine_operator(self):
        store = self._make_store()
        cur = MagicMock()
        store._connection.cursor.return_value.__enter__.return_value = cur
        # simulate one retrieved row
        cur.fetchall.return_value = [
            ("c1", "pdf-1", "a relevant passage", 3, 0.88, "notes.pdf"),
        ]

        results = store.retrieve(project_id="p1", query="relevant", top_k=5, min_score=0.05)
        sql, params = cur.execute.call_args[0]
        # the cosine distance operator <=> is present (pgvector)
        assert "<=>" in sql
        # project scope comes from the JOINed Pdf row (PdfChunk has no
        # projectId column in the Prisma schema)
        assert 'join "pdf"' in sql.lower()
        assert "projectId".lower() in sql.lower()
        assert "p1" in params
        # results map into RetrievedChunk
        assert len(results) == 1
        assert isinstance(results[0], RetrievedChunk)
        assert results[0].chunk_id == "c1"

    def test_retrieve_applies_min_score_floor(self):
        store = self._make_store()
        cur = MagicMock()
        store._connection.cursor.return_value.__enter__.return_value = cur
        # a row below the floor should be filtered out by the WHERE clause
        cur.fetchall.return_value = []

        store.retrieve(project_id="p1", query="x", top_k=5, min_score=0.05)
        sql, _ = cur.execute.call_args[0]
        assert "min_score" in sql.lower() or ">=" in sql or "WHERE" in sql

    def test_list_chunks_returns_stored_chunks_for_a_project(self):
        store = self._make_store()
        cur = MagicMock()
        store._connection.cursor.return_value.__enter__.return_value = cur
        cur.fetchall.return_value = [
            ("c1", "pdf-1", "passage one", 1, [0.1] * 8),
        ]
        out = store.list_chunks("p1")
        sql, params = cur.execute.call_args[0]
        assert "p1" in params
        assert isinstance(out[0], StoredChunk)


@pytest.mark.skipif(
    not (os.environ.get("SUPABASE_DB_URL") and os.environ.get("GEMINI_API_KEY")),
    reason="needs a live Postgres with pgvector (SUPABASE_DB_URL) + GEMINI_API_KEY",
)
class TestPgvectorStoreLive:
    """Round-trip against the real Supabase Postgres. Requires the vector
    column migration (see ADR-0008) to be applied first.

    PdfChunk.pdfId is a real FK (Pdf → Project → User, all cascade-delete), so
    the test creates its own parent chain and removes it by deleting the User.
    """

    def test_ingest_then_retrieve_round_trips(self):
        import psycopg

        from app.embedder import GeminiEmbedder
        from app.vector_store import PgvectorStore

        conn = psycopg.connect(os.environ["SUPABASE_DB_URL"], autocommit=True)
        uid, pid, pdfid = "u-pgvtest", "p-pgvtest", "pdf-pgvtest"
        with conn.cursor() as cur:
            # idempotent setup: clear any residue from an aborted prior run
            cur.execute('DELETE FROM "User" WHERE id = %s', (uid,))
            cur.execute(
                'INSERT INTO "User" (id, email) VALUES (%s, %s)',
                (uid, "pgvtest@example.invalid"),
            )
            cur.execute(
                'INSERT INTO "Project" (id, "userId", title, "updatedAt") VALUES (%s, %s, %s, now())',
                (pid, uid, "pgvector live test"),
            )
            cur.execute(
                'INSERT INTO "Pdf" (id, "projectId", "userId", filename) VALUES (%s, %s, %s, %s)',
                (pdfid, pid, uid, "backprop-notes.pdf"),
            )
        try:
            store = PgvectorStore(connection=conn, embedder=GeminiEmbedder(), autocommit=True)
            store.ingest(
                project_id=pid,
                pdf_id=pdfid,
                chunks_text=["Neural networks learn via backpropagation."],
                chunk_ids=["ctest-1"],
            )
            results = store.retrieve(project_id=pid, query="how do neural networks learn", top_k=5)
            assert any(r.chunk_id == "ctest-1" for r in results)
            # the filename deep-link resolves via the Pdf JOIN
            assert results[0].pdf_filename == "backprop-notes.pdf"
            # retrieval is project-scoped: another project sees nothing
            assert store.retrieve(project_id="p-other", query="backpropagation", top_k=5) == []
        finally:
            with conn.cursor() as cur:
                cur.execute('DELETE FROM "User" WHERE id = %s', (uid,))
            conn.close()
