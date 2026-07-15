"""Vector store — the retrieval layer over embeddings.

An abstraction over pgvector: in tests it's an in-memory store; in production
it's backed by Supabase Postgres + pgvector. The interface (ingest/retrieve/
list_chunks) is identical so the FastAPI endpoints and tests are provider-blind.

Sprint 1 ships the in-memory implementation; the pgvector adapter is a drop-in
that implements the same VectorStoreBase interface.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Any, Optional, Protocol

from app.embedder import Embedder, cosine_similarity


@dataclass
class StoredChunk:
    chunk_id: str
    pdf_id: str
    content: str
    page_approx: int
    embedding: list[float]


@dataclass
class RetrievedChunk:
    chunk_id: str
    pdf_id: str
    content: str
    page_approx: int
    similarity_score: float
    pdf_filename: str = ""


class VectorStoreBase(Protocol):
    """The interface both the in-memory and pgvector stores implement."""

    def ingest(self, project_id: str, pdf_id: str, chunks_text: list[str]) -> list[StoredChunk]: ...

    def retrieve(
        self, project_id: str, query: str, top_k: int = 5, min_score: float = 0.05
    ) -> list[RetrievedChunk]: ...

    def list_chunks(self, project_id: str) -> list[StoredChunk]: ...


class VectorStore:
    """In-memory vector store for tests and offline dev.

    Uses the injected embedder to vectorise chunks and queries, then ranks by
    cosine similarity. Scoped per project so retrieval never leaks across
    users/projects.
    """

    def __init__(self, embedder: Embedder):
        self.embedder = embedder
        # project_id -> list of StoredChunk
        self._store: dict[str, list[StoredChunk]] = {}
        self._counter = 0

    def ingest(
        self,
        project_id: str,
        pdf_id: str,
        chunks_text: list[str],
        chunk_ids: list[str] | None = None,
    ) -> list[StoredChunk]:
        """Ingest chunks and return the stored StoredChunk records.

        If chunk_ids is provided, those ids are used (must match chunks_text
        length); otherwise ids are auto-generated. Explicit ids let the
        evaluation harness align stored chunks with ground-truth relevant_ids.
        """
        if chunk_ids is not None and len(chunk_ids) != len(chunks_text):
            raise ValueError("chunk_ids length must match chunks_text length")
        if project_id not in self._store:
            self._store[project_id] = []
        stored: list[StoredChunk] = []
        for i, text in enumerate(chunks_text):
            self._counter += 1
            cid = chunk_ids[i] if chunk_ids else f"chunk-{self._counter}"
            chunk = StoredChunk(
                chunk_id=cid,
                pdf_id=pdf_id,
                content=text,
                page_approx=i + 1,
                embedding=self.embedder.embed(text),
            )
            self._store[project_id].append(chunk)
            stored.append(chunk)
        return stored

    def retrieve(
        self, project_id: str, query: str, top_k: int = 5, min_score: float = 0.05
    ) -> list[RetrievedChunk]:
        chunks = self._store.get(project_id, [])
        if not chunks:
            return []
        query_vec = self.embedder.embed(query)
        scored = [
            (chunk, cosine_similarity(query_vec, chunk.embedding))
            for chunk in chunks
        ]
        scored = [(c, s) for c, s in scored if s >= min_score]
        scored.sort(key=lambda cs: cs[1], reverse=True)
        scored = scored[:top_k]
        return [
            RetrievedChunk(
                chunk_id=c.chunk_id,
                pdf_id=c.pdf_id,
                content=c.content,
                page_approx=c.page_approx,
                similarity_score=s,
                pdf_filename=c.pdf_id,  # filename not tracked in-memory; use pdf_id
            )
            for c, s in scored
        ]

    def list_chunks(self, project_id: str) -> list[StoredChunk]:
        return list(self._store.get(project_id, []))


class PgvectorStore:
    """pgvector-backed VectorStoreBase (production adapter, ADR-0008).

    Implements the SAME ingest/retrieve/list_chunks interface as the in-memory
    VectorStore so the FastAPI endpoints are provider-blind. Vectors are stored
    in a `pdf_chunks.embedding vector(<dim>)` column; retrieval uses pgvector's
    cosine distance operator `<=>` with a project-scoped WHERE clause (retrieval
    never leaks across users/projects).

    psycopg is imported lazily (only when a real connection is needed) so the
    hermetic test path (mocked connection) and the in-memory default don't pull
    in the dependency. The migration adding the vector column + HNSW index is a
    raw SQL migration (Prisma's vector support is limited — see ADR-0008).
    """

    def __init__(
        self,
        connection: Optional[Any] = None,
        embedder: Optional[Embedder] = None,
        autocommit: bool = False,
    ):
        if embedder is None:
            raise ValueError("PgvectorStore requires an embedder")
        self.embedder = embedder
        self._autocommit = autocommit
        if connection is None:
            # Lazily connect using SUPABASE_DB_URL (lazy import so tests without
            # psycopg + the in-memory default path never need the dependency).
            import psycopg  # noqa: F401  (imported for the side effect / availability check)

            db_url = os.environ.get("SUPABASE_DB_URL") or os.environ.get("DATABASE_URL")
            if not db_url:
                raise ValueError("PgvectorStore needs SUPABASE_DB_URL or DATABASE_URL")
            connection = psycopg.connect(db_url, autocommit=autocommit)
        self._connection = connection

    def ingest(
        self,
        project_id: str,
        pdf_id: str,
        chunks_text: list[str],
        chunk_ids: Optional[list[str]] = None,
    ) -> list[StoredChunk]:
        if chunk_ids is not None and len(chunk_ids) != len(chunks_text):
            raise ValueError("chunk_ids length must match chunks_text length")
        stored: list[StoredChunk] = []
        with self._connection.cursor() as cur:
            for i, text in enumerate(chunks_text):
                cid = chunk_ids[i] if chunk_ids else f"chunk-{i+1}"
                vec = self.embedder.embed(text)
                # store the vector as a string literal pgvector parses: '[v1,v2,...]'
                vec_lit = "[" + ",".join(str(float(v)) for v in vec) + "]"
                cur.execute(
                    """
                    INSERT INTO "PdfChunk" (id, "pdfId", content, "charCount",
                                            "pageApprox", "projectId", embedding)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """,
                    (cid, pdf_id, text, len(text), i + 1, project_id, vec_lit),
                )
                stored.append(
                    StoredChunk(
                        chunk_id=cid,
                        pdf_id=pdf_id,
                        content=text,
                        page_approx=i + 1,
                        embedding=vec,
                    )
                )
        if self._autocommit is False:
            self._connection.commit()
        return stored

    def retrieve(
        self,
        project_id: str,
        query: str,
        top_k: int = 5,
        min_score: float = 0.05,
    ) -> list[RetrievedChunk]:
        query_vec = self.embedder.embed(query)
        vec_lit = "[" + ",".join(str(float(v)) for v in query_vec) + "]"
        with self._connection.cursor() as cur:
            # cosine DISTANCE is 1 - cosine_similarity, so the score floor maps
            # to a distance ceiling (1 - min_score). ORDER BY distance ASC.
            cur.execute(
                """
                SELECT id, "pdfId", content, "pageApprox",
                       1 - (embedding <=> %s::vector) AS score,
                       "pdfFilename"
                FROM "PdfChunk"
                WHERE "projectId" = %s
                  AND 1 - (embedding <=> %s::vector) >= %s
                ORDER BY embedding <=> %s::vector
                LIMIT %s
                """,
                (vec_lit, project_id, vec_lit, min_score, vec_lit, top_k),
            )
            rows = cur.fetchall()
        return [
            RetrievedChunk(
                chunk_id=r[0],
                pdf_id=r[1],
                content=r[2],
                page_approx=r[3],
                similarity_score=float(r[4]),
                pdf_filename=r[5] if r[5] else r[1],
            )
            for r in rows
        ]

    def list_chunks(self, project_id: str) -> list[StoredChunk]:
        with self._connection.cursor() as cur:
            cur.execute(
                """
                SELECT id, "pdfId", content, "pageApprox", embedding
                FROM "PdfChunk"
                WHERE "projectId" = %s
                """,
                (project_id,),
            )
            rows = cur.fetchall()
        return [
            StoredChunk(
                chunk_id=r[0],
                pdf_id=r[1],
                content=r[2],
                page_approx=r[3],
                embedding=list(r[4]) if r[4] else [],
            )
            for r in rows
        ]

