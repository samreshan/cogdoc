"""Embedding abstraction — provider-agnostic.

Production swaps HashingEmbedder for a Gemini/OpenAI adapter; tests and offline
dev use HashingEmbedder (deterministic, no network). The interface is identical
so the retrieval layer never knows which provider is active.

This is the pgvector-ready seam: whatever produces the vector, pgvector stores
and cosine-sorts it.
"""
from __future__ import annotations

import hashlib
import math
import os
import re
from typing import Protocol, Sequence, runtime_checkable

import httpx


@runtime_checkable
class Embedder(Protocol):
    """A thing that turns text into a fixed-dimension float vector."""

    def embed(self, text: str) -> list[float]:
        ...


def cosine_similarity(a: Sequence[float], b: Sequence[float]) -> float:
    """Cosine similarity between two vectors. Returns 0.0 for zero vectors.

    Defined here (not imported from numpy/scipy) to keep the service
    dependency-free and fast for the in-memory test path.
    """
    if len(a) != len(b):
        raise ValueError(f"dimension mismatch: {len(a)} vs {len(b)}")
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return dot / (norm_a * norm_b)


class HashingEmbedder:
    """Deterministic, dependency-free embedder for tests and offline dev.

    Tokenises on whitespace, hashes each token into a bucket, and accumulates
    the signed hash value into that dimension. This produces a stable vector
    per text where semantically similar texts (sharing tokens) land in
    overlapping buckets — enough structure for retrieval to work without a
    real embedding model.

    Not a substitute for a trained embedder in production — but it makes the
    retrieval layer fully unit-testable and the swap to Gemini embeddings a
    one-line change.
    """

    def __init__(self, dim: int = 768):
        if dim <= 0:
            raise ValueError("dim must be positive")
        self.dim = dim

    def embed(self, text: str) -> list[float]:
        vec = [0.0] * self.dim
        tokens = re.split(r"[^a-z0-9]+", text.lower())
        for token in tokens:
            h = hashlib.md5(token.encode("utf-8")).digest()
            # Use the first 8 bytes as a signed integer, mod dim for the bucket
            bucket = int.from_bytes(h[:8], "little") % self.dim
            sign = 1.0 if (h[8] & 1) == 0 else -1.0
            vec[bucket] += sign
        # L2-normalise so cosine similarity is a simple dot product
        norm = math.sqrt(sum(v * v for v in vec))
        if norm > 0:
            vec = [v / norm for v in vec]
        return vec

    def __call__(self, text: str) -> list[float]:
        # Allow use as a plain callable too
        return self.embed(text)


class GeminiEmbedder:
    """Real-embedding adapter backed by Gemini (gemini-embedding-001, 3072-dim).

    Implements the same Embedder Protocol as HashingEmbedder, so the retrieval
    layer is provider-blind. Production injects this; tests/offline dev keep
    HashingEmbedder. The dim MUST match the model output (gemini-embedding-001 =
    3072); a mismatch raises in cosine_similarity (caught at retrieval time).

    Uses the Generative Language API directly via httpx (no SDK dependency).
    """

    # gemini-embedding-001 is the generally-available embedding model (the older
    # text-embedding-004 is deprecated/unavailable for many keys). It emits
    # 3072-dim vectors.
    MODEL = "gemini-embedding-001"
    DEFAULT_DIM = 3072
    ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models"

    def __init__(
        self, api_key: str | None = None, dim: int = DEFAULT_DIM, model: str | None = None, timeout: float = 30.0
    ):
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY", "")
        self.dim = dim
        self.model = model or self.MODEL
        self.timeout = timeout
        if not self.api_key:
            raise ValueError("GeminiEmbedder requires GEMINI_API_KEY")

    def _embed_with_task(self, text: str, task_type: str) -> list[float]:
        import time

        url = f"{self.ENDPOINT}/{self.model}:embedContent"
        body = {
            # The API expects a Content object, not a raw string.
            "content": {"parts": [{"text": text}]},
            "taskType": task_type,
        }
        # Retry 429s with backoff — free-tier RPM limits are easy to hit
        # during batch ingest; a transient 429 shouldn't fail the request.
        for attempt in range(3):
            resp = httpx.post(url, json=body, headers={"x-goog-api-key": self.api_key}, timeout=self.timeout)
            if resp.status_code == 429 and attempt < 2:
                time.sleep(0.5 * (2 ** attempt))
                continue
            resp.raise_for_status()
            values = list(resp.json()["embedding"]["values"])
            if len(values) != self.dim or not all(math.isfinite(v) for v in values):
                raise ValueError("Embedding dimensions or values do not match the configured vector space")
            return values
        raise RuntimeError("unreachable")  # loop always returns or raises

    def embed(self, text: str) -> list[float]:
        """Embed a corpus passage (ingest side): taskType RETRIEVAL_DOCUMENT."""
        return self._embed_with_task(text, "RETRIEVAL_DOCUMENT")

    def embed_query(self, text: str) -> list[float]:
        """Embed a search query: taskType RETRIEVAL_QUERY.

        Gemini's retrieval embeddings are asymmetric — documents and queries
        use different task types, and mixing them (embedding queries as
        DOCUMENT) measurably degrades ranking. The vector stores call this
        for the query side; stored document vectors are unaffected.
        """
        return self._embed_with_task(text, "RETRIEVAL_QUERY")

    def __call__(self, text: str) -> list[float]:
        return self.embed(text)
