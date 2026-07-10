"""Vector store — the retrieval layer over embeddings.

An abstraction over pgvector: in tests it's an in-memory store; in production
it's backed by Supabase Postgres + pgvector. The interface (ingest/retrieve/
list_chunks) is identical so the FastAPI endpoints and tests are provider-blind.

Sprint 1 ships the in-memory implementation; the pgvector adapter is a drop-in
that implements the same VectorStoreBase interface.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol

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
