"""Text chunker for the RAG ingestion pipeline.

Mirrors the contract of the existing TS chunkText() so behaviour is preserved
when ingestion moves to the FastAPI service: split on paragraph boundaries at
~2500 chars (~500 tokens), tag each chunk with an approximate page number.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

CHUNK_SIZE = 2500  # ~500 tokens
PAGE_SIZE = 3000

_PARAGRAPH_SPLIT = re.compile(r"\n\s*\n")


@dataclass(frozen=True)
class Chunk:
    content: str
    char_count: int
    page_approx: int
    chunk_index: int


def chunk_text(text: str) -> list[Chunk]:
    """Split text into ~CHUNK_SIZE chunks on paragraph boundaries.

    Buffers paragraphs until adding the next would exceed CHUNK_SIZE, then
    flushes. Each chunk gets an approximate page number based on its offset.
    Returns [] for empty/whitespace-only input.
    """
    chunks: list[Chunk] = []
    paragraphs = _PARAGRAPH_SPLIT.split(text)
    buffer = ""
    idx = 0

    for para in paragraphs:
        candidate = f"{buffer}\n\n{para}" if buffer else para
        if len(candidate) > CHUNK_SIZE and buffer:
            page_approx = idx * CHUNK_SIZE // PAGE_SIZE + 1
            trimmed = buffer.strip()
            chunks.append(
                Chunk(
                    content=trimmed,
                    char_count=len(trimmed),
                    page_approx=page_approx,
                    chunk_index=idx,
                )
            )
            idx += 1
            buffer = para
        else:
            buffer = candidate

    if buffer.strip():
        page_approx = idx * CHUNK_SIZE // PAGE_SIZE + 1
        trimmed = buffer.strip()
        chunks.append(
            Chunk(
                content=trimmed,
                char_count=len(trimmed),
                page_approx=page_approx,
                chunk_index=idx,
            )
        )
    return chunks
