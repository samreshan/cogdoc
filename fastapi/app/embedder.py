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
import re
from typing import Protocol, Sequence, runtime_checkable


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
