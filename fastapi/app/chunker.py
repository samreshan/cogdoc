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
    """Bounded character chunks, paragraph/word boundaries, 250-char overlap.

    Page labels are approximate character offsets, not PDF page citations.
    Long paragraphs are split too; every loop makes forward progress.
    """
    chunks: list[Chunk] = []
    start = 0
    while start < len(text):
        end = min(start + CHUNK_SIZE, len(text))
        if end < len(text):
            window = text[start:end]
            paragraph = window.rfind("\n\n")
            boundary = paragraph if paragraph >= CHUNK_SIZE // 2 else window.rfind(" ")
            if boundary >= CHUNK_SIZE // 2:
                end = start + boundary
        content = text[start:end].strip()
        if content:
            chunks.append(Chunk(content, len(content), start // PAGE_SIZE + 1, len(chunks)))
        if end == len(text):
            break
        start = max(start + 1, end - 250)
        boundary = re.search(r"\s", text[start:start + 40])
        if boundary and boundary.start() > 0:
            start += boundary.start() + 1
    return chunks
