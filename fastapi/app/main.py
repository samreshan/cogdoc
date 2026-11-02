"""FastAPI application factory for the Cogdoc RAG + AI gateway.

Sprint 1 endpoints:
  POST /api/rag/ingest    — parse + chunk + embed + store
  POST /api/rag/retrieve  — cosine ANN retrieval over a project's chunks
  POST /api/ai/citation   — retrieve + classify verdict (the Citation Sentinel)

Dependency injection: the embedder, vector store, and an optional LLM verdict
provider are injected via the app state so tests run hermetically with the
HashingEmbedder + in-memory store, and production swaps in pgvector + Gemini.
"""
from __future__ import annotations

from dataclasses import asdict
from typing import Any, Callable, Optional

from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, model_validator

from app.chunker import chunk_text
from app.embedder import HashingEmbedder, Embedder
from app.sse import sse_done, sse_error, sse_meta, sse_token
from app.verdict import Verdict, classify_verdict
from app.vector_store import VectorStore, VectorStoreBase


class IngestChunkIn(BaseModel):
    """A pre-chunked passage supplied by the BFF.

    When the BFF sends explicit `chunks`, it owns both the content and the
    chunk_id — so FastAPI does NOT re-chunk and the stored ids are verbatim
    the SQLite PdfChunk.id (cuids). This keeps the Citation Sentinel's evidence
    deep-links (InterventionEvidence.chunkId) resolvable back to SQLite rows.
    """

    content: str
    chunk_id: str
    page_approx: int | None = None


class IngestRequest(BaseModel):
    pdf_id: str
    project_id: str
    text: str | None = None
    chunks: list[IngestChunkIn] | None = None

    @model_validator(mode="after")
    def _require_text_or_chunks(self) -> "IngestRequest":
        if self.text is None and self.chunks is None:
            raise ValueError("either text or chunks must be provided")
        return self


class IngestChunkOut(BaseModel):
    chunk_id: str
    chunk_index: int
    page_approx: int


class IngestResponse(BaseModel):
    chunks: list[IngestChunkOut]


class RetrieveRequest(BaseModel):
    claim: str
    project_id: str
    top_k: int = 5
    min_score: float = 0.05


class PassageOut(BaseModel):
    chunk_id: str
    pdf_id: str
    text: str
    score: float
    page_approx: int
    pdf_filename: str = ""


class RetrieveResponse(BaseModel):
    passages: list[PassageOut]


class CitationRequest(BaseModel):
    claim: str
    project_id: str
    top_k: int = 5
    min_score: float = 0.05
    similarity_floor: float = 0.30


class EvidenceOut(BaseModel):
    chunk_id: str
    excerpt: str
    score: float


class CitationResponse(BaseModel):
    verdict: str
    explanation: str
    evidence: list[EvidenceOut]


class InterceptorStreamRequest(BaseModel):
    """POST /api/ai/interceptor/stream — the SSE interceptor (ADR-0007).

    The prompt is the writer's delegative text; the engine streams a Socratic
    reframe ([The Spark Gap]) token-by-token. friction_mode is echoed in the
    meta event and gates the anti-generation guard threshold.
    """

    prompt: str
    context: str = ""
    friction_mode: str = "socratic"
    project_id: str | None = None
    paragraph_id: str | None = None


def _is_generation_allowed(response: str, mode: str) -> bool:
    """Mirror of the TS isGenerationAllowed (friction §9 non-gen invariant).

    Kept inline (not imported from TS) so the FastAPI service stays standalone.
    Hard floor: 3+ declarative sentences blocked in EVERY mode.
    """
    trimmed = response.strip()
    if not trimmed:
        return True
    if "__" in trimmed:
        return True
    sentence_ends = trimmed.replace("?", ".").replace("!", ".")
    declarative = [s for s in sentence_ends.split(".") if s.strip()]
    if len(declarative) >= 3:
        return False
    word_count = len(trimmed.split())
    if word_count > 60:
        return False
    thresholds = {"socratic": 2, "coach": 3, "assistant": 4}
    return len(declarative) <= thresholds.get(mode, 2)


def _default_token_provider(prompt: str, context: str):
    """The default interceptor response when no LLM is injected.

    Produces a short Socratic question (the Spark Gap) split into word-tokens.
    Production injects a real LLM token stream via create_app(token_provider=).
    """
    question = "What must the reader accept for this to hold?"
    return question.split(" ")


def create_app(
    *,
    embedder: Optional[Embedder] = None,
    store: Optional[VectorStoreBase] = None,
    verdict_provider=None,
    token_provider: Optional[Callable[[str, str], Any]] = None,
) -> FastAPI:
    """Build a FastAPI app with injectable dependencies.

    Args:
        embedder: embedding provider (default: HashingEmbedder dim=768).
        store: vector store (default: in-memory VectorStore).
        verdict_provider: callable(claim, passages) -> str that returns the
            model's proposed verdict. Defaults to a keyword-heuristic provider
            so the endpoint works without an LLM; production injects Gemini.
        token_provider: callable(prompt, context) -> iterable[str] yielding the
            tokens of an interceptor response. Defaults to a Spark Gap question.
    """
    if embedder is None:
        embedder = HashingEmbedder(dim=768)
    if store is None:
        store = VectorStore(embedder=embedder)
    if verdict_provider is None:
        verdict_provider = _heuristic_verdict_provider
    if token_provider is None:
        token_provider = _default_token_provider

    app = FastAPI(title="Cogdoc RAG", version="0.1.0")
    app.state.embedder = embedder
    app.state.store = store
    app.state.verdict_provider = verdict_provider
    app.state.token_provider = token_provider

    @app.get("/")
    def root():
        return {"service": "cogdoc-rag", "version": "0.1.0", "embedder": type(embedder).__name__, "storage": type(store).__name__, "dimensions": getattr(embedder, "dim", None)}

    @app.post("/api/rag/ingest", response_model=IngestResponse)
    def rag_ingest(req: IngestRequest):
        if req.chunks is not None:
            # The BFF is the source of truth: it chunked the PDF itself and
            # owns the SQLite PdfChunk.id (cuids). Store them verbatim so the
            # vector-store chunk ids match SQLite exactly — evidence deep-links
            # (InterventionEvidence.chunkId) resolve back to real rows.
            page_approxs = [c.page_approx for c in req.chunks]
            stored = store.ingest(
                project_id=req.project_id,
                pdf_id=req.pdf_id,
                chunks_text=[c.content for c in req.chunks],
                chunk_ids=[c.chunk_id for c in req.chunks],
            )
            return IngestResponse(
                chunks=[
                    IngestChunkOut(
                        chunk_id=s.chunk_id,
                        chunk_index=i,
                        page_approx=pp if pp is not None else s.page_approx,
                    )
                    for i, (s, pp) in enumerate(zip(stored, page_approxs))
                ]
            )
        # Back-compat path: a caller that sends only {text} gets FastAPI's own
        # chunker. Auto-generated chunk-<n> ids (NOT aligned to SQLite).
        assert req.text is not None  # the model validator guarantees text or chunks
        chunks = chunk_text(req.text)
        stored = store.ingest(
            project_id=req.project_id,
            pdf_id=req.pdf_id,
            chunks_text=[c.content for c in chunks],
        )
        return IngestResponse(
            chunks=[
                IngestChunkOut(
                    chunk_id=s.chunk_id,
                    chunk_index=c.chunk_index,
                    page_approx=c.page_approx,
                )
                for c, s in zip(chunks, stored)
            ]
        )

    @app.post("/api/rag/retrieve", response_model=RetrieveResponse)
    def rag_retrieve(req: RetrieveRequest):
        results = store.retrieve(
            project_id=req.project_id,
            query=req.claim,
            top_k=req.top_k,
            min_score=req.min_score,
        )
        return RetrieveResponse(
            passages=[
                PassageOut(
                    chunk_id=r.chunk_id,
                    pdf_id=r.pdf_id,
                    text=r.content,
                    score=r.similarity_score,
                    page_approx=r.page_approx,
                    pdf_filename=r.pdf_filename,
                )
                for r in results
            ]
        )

    @app.post("/api/ai/citation", response_model=CitationResponse)
    def ai_citation(req: CitationRequest):
        retrieved = store.retrieve(
            project_id=req.project_id,
            query=req.claim,
            top_k=req.top_k,
            min_score=0.0,  # retrieve broadly; the floor guard decides verdict
        )
        max_sim = max((r.similarity_score for r in retrieved), default=0.0)
        passages = [
            {"content": r.content, "similarity": r.similarity_score, "chunk_id": r.chunk_id}
            for r in retrieved
        ]
        model_verdict = verdict_provider(req.claim, passages)
        result = classify_verdict(
            claim=req.claim,
            passages=passages,
            model_verdict=model_verdict,
            max_similarity=max_sim,
            similarity_floor=req.similarity_floor,
        )
        return CitationResponse(
            verdict=result.verdict.value,
            explanation=result.explanation,
            evidence=[
                EvidenceOut(chunk_id=e.chunk_id, excerpt=e.excerpt, score=e.similarity_score)
                for e in result.evidence
            ],
        )

    @app.post("/api/ai/interceptor/stream")
    def interceptor_stream(req: InterceptorStreamRequest):
        """SSE producer for the Interceptor engine (ADR-0007, §12.3 schema).

        Streams a Socratic reframe ([The Spark Gap]) token-by-token. The
        anti-generation guard runs on the assembled response before `done`; a
        violation emits error{guard_violation} and replaces the response with a
        Spark Gap. The BFF persists the Intervention on `done` (FastAPI has no
        DB client — ADR-0007).

        TODO(phase-sse): stream the other three engines the same way.
        """
        provider = app.state.token_provider

        def event_stream():
            # meta first
            yield sse_meta(
                tag="[The Spark Gap]", engine="interceptor", friction_mode=req.friction_mode
            )
            tokens = list(provider(req.prompt, req.context))
            assembled = " ".join(tokens)
            # run the anti-generation guard on the assembled response
            if not _is_generation_allowed(assembled, req.friction_mode):
                yield sse_error(
                    code="guard_violation",
                    message="non-generation contract violated; replacing with Spark Gap",
                )
                # replace with a Spark Gap question
                replacement = "What must be true for this to hold?"
                for tok in replacement.split(" "):
                    yield sse_token(tok)
                yield sse_done(intervention_id=None, verdict=None)
                return
            # stream the tokens
            for tok in tokens:
                yield sse_token(tok)
            yield sse_done(intervention_id=None, verdict=None)

        return StreamingResponse(event_stream(), media_type="text/event-stream")

    return app


def _heuristic_verdict_provider(claim: str, passages: list[dict]) -> str:
    """Default verdict provider — a keyword-overlap heuristic.

    Used when no LLM is injected. Looks at whether retrieved passages share
    significant token overlap with the claim to propose a verdict. The
    similarity-floor guard in classify_verdict still has the final say.
    """
    if not passages:
        return Verdict.INSUFFICIENT_EVIDENCE.value
    claim_tokens = {t for t in claim.lower().split() if len(t) > 3}
    best_passage = max(passages, key=lambda p: p.get("similarity", 0.0))
    passage_tokens = {t for t in best_passage.get("content", "").lower().split() if len(t) > 3}
    overlap = len(claim_tokens & passage_tokens)
    # If the best passage is highly similar AND shares tokens → supported
    if best_passage.get("similarity", 0.0) > 0.5 and overlap >= 2:
        return Verdict.SUPPORTED.value
    if best_passage.get("similarity", 0.0) > 0.3:
        return Verdict.PARTIALLY_SUPPORTED.value
    return Verdict.UNSUPPORTED.value


def create_app_from_env() -> FastAPI:
    """Build the app picking embedder + store from environment (ADR-0008).

    Resolution:
      EMBEDDING_PROVIDER=gemini + GEMINI_API_KEY  → GeminiEmbedder (3072-dim)
      else                                          → HashingEmbedder (hermetic)

      SUPABASE_DB_URL present + EMBEDDING_PROVIDER=gemini → PgvectorStore
      else                                                 → in-memory VectorStore

    Production sets EMBEDDING_PROVIDER=gemini + SUPABASE_DB_URL; tests + offline
    dev leave them unset for the hermetic HashingEmbedder + in-memory path. This
    is the single env-reading seam in the FastAPI service.
    """
    import os

    provider = os.environ.get("EMBEDDING_PROVIDER", "hashing").lower()
    embedder: Embedder
    if provider == "gemini":
        from app.embedder import GeminiEmbedder

        embedder = GeminiEmbedder()
    else:
        embedder = HashingEmbedder(dim=768)

    store: Optional[VectorStoreBase]
    if provider == "gemini" and os.environ.get("SUPABASE_DB_URL"):
        from app.vector_store import PgvectorStore

        store = PgvectorStore(embedder=embedder, autocommit=True)
    else:
        store = VectorStore(embedder=embedder)

    return create_app(embedder=embedder, store=store)
