"""
RED phase — tests for the RAG chunker.

Mirrors the contract of the existing TS chunkText() so the Python service
can replace it byte-for-byte in behaviour: paragraph-boundary chunking at
~2500 chars with approximate page tagging.
"""
import pytest
from app.chunker import chunk_text


class TestChunkText:
    def test_empty_text_returns_empty_list(self):
        assert chunk_text("") == []

    def test_whitespace_only_returns_empty_list(self):
        assert chunk_text("   \n\n  ") == []

    def test_short_text_returns_single_chunk(self):
        text = "This is a short paragraph that fits in one chunk."
        chunks = chunk_text(text)
        assert len(chunks) == 1
        assert chunks[0].content == text
        assert chunks[0].chunk_index == 0
        assert chunks[0].page_approx == 1

    def test_splits_on_paragraph_boundaries(self):
        para_a = "A" * 2000
        para_b = "B" * 2000
        chunks = chunk_text(f"{para_a}\n\n{para_b}")
        assert len(chunks) == 2
        assert chunks[0].chunk_index == 0
        assert chunks[1].chunk_index == 1

    def test_chunk_has_char_count_matching_content(self):
        text = "Some measurable paragraph content here."
        chunks = chunk_text(text)
        assert chunks[0].char_count == len(chunks[0].content)

    def test_page_approx_is_monotonically_non_decreasing(self):
        paragraphs = [f"para {i}: " + "X" * 2500 for i in range(6)]
        chunks = chunk_text("\n\n".join(paragraphs))
        for prev, cur in zip(chunks, chunks[1:]):
            assert cur.page_approx >= prev.page_approx

    def test_chunk_shape_has_required_fields(self):
        chunks = chunk_text("A single short paragraph.")
        c = chunks[0]
        # The Chunk dataclass must expose these fields
        assert hasattr(c, "content")
        assert hasattr(c, "char_count")
        assert hasattr(c, "page_approx")
        assert hasattr(c, "chunk_index")
