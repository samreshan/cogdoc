"""Ground-truth evaluation set for the Citation Sentinel.

A small hand-labeled corpus: source passages + claims, each tagged with the
correct verdict and the chunk_ids that should support it. Used by the
evaluation harness to compute precision/recall/F1 and Recall@k, and to run
the keyword-vs-vector retrieval ablation (PRODUCT.md §14.3).

This is a living fixture: grow it as the project matures. Acceptance targets
(Sprint 1 gate):
  - verdict macro-F1 >= 0.70
  - Recall@5 for supported claims >= 0.80
  - vector Recall@5 beats keyword Recall@5 by >= 15pp
"""
from __future__ import annotations

# ── Source passages (the "research library") ──────────────────────────────
# Each passage gets a stable chunk_id. The harness ingests these into both
# the keyword and vector stores, then runs each claim.
SOURCE_PASSAGES = [
    {
        "chunk_id": "s1",
        "pdf_id": "cognitive-load.pdf",
        "text": "Cognitive load theory describes how the human working memory has limited capacity, and learning is impaired when that capacity is exceeded by extraneous information.",
    },
    {
        "chunk_id": "s2",
        "pdf_id": "cognitive-load.pdf",
        "text": "Sweller demonstrated that problem-solving practice alone is less effective than worked examples for novice learners because it imposes excessive cognitive load.",
    },
    {
        "chunk_id": "s3",
        "pdf_id": "ai-writing.pdf",
        "text": "Generative AI writing tools reduce the cognitive effort required to produce text, which may lead to cognitive offloading and weaker skill development over time.",
    },
    {
        "chunk_id": "s4",
        "pdf_id": "ai-writing.pdf",
        "text": "A survey of knowledge workers found that higher confidence in generative AI is associated with reduced critical-thinking effort.",
    },
    {
        "chunk_id": "s5",
        "pdf_id": "rag.pdf",
        "text": "Retrieval-augmented generation grounds language model outputs in retrieved evidence passages, reducing hallucination by constraining the evidence base.",
    },
    {
        "chunk_id": "s6",
        "pdf_id": "rag.pdf",
        "text": "Vector similarity search over embedded text chunks enables semantic retrieval that captures meaning beyond exact keyword overlap.",
    },
    {
        "chunk_id": "s7",
        "pdf_id": "friction.pdf",
        "text": "Productive friction, or desirable difficulty, is the intentional introduction of effort into a learning process to improve long-term retention and transfer.",
    },
    {
        "chunk_id": "s8",
        "pdf_id": "cooking.pdf",
        "text": "A classic pasta dough uses durum wheat semolina and water, kneaded until smooth and rested before rolling.",
    },
]

# ── Labeled claims ─────────────────────────────────────────────────────────
# Each claim has the expected verdict and the set of relevant chunk_ids.
CLAIMS = [
    {
        "claim": "Cognitive load theory states that working memory has limited capacity.",
        "expected_verdict": "supported",
        "relevant_ids": {"s1"},
    },
    {
        "claim": "Worked examples are more effective than problem-solving for novice learners.",
        "expected_verdict": "supported",
        "relevant_ids": {"s2"},
    },
    {
        "claim": "Generative AI tools can cause cognitive offloading that weakens writing skills.",
        "expected_verdict": "supported",
        "relevant_ids": {"s3"},
    },
    {
        "claim": "Higher AI confidence is linked to less critical thinking effort.",
        "expected_verdict": "supported",
        "relevant_ids": {"s4"},
    },
    {
        "claim": "RAG reduces hallucination by constraining the evidence base.",
        "expected_verdict": "supported",
        "relevant_ids": {"s5"},
    },
    {
        "claim": "Vector search captures meaning beyond keyword matching.",
        "expected_verdict": "supported",
        "relevant_ids": {"s6"},
    },
    {
        "claim": "The Eiffel Tower is located in Tokyo.",
        "expected_verdict": "insufficient_evidence",
        "relevant_ids": set(),
    },
    {
        "claim": "Quantum entanglement enables faster-than-light communication.",
        "expected_verdict": "insufficient_evidence",
        "relevant_ids": set(),
    },
    {
        "claim": "Productive friction intentionally adds effort to improve retention.",
        "expected_verdict": "supported",
        "relevant_ids": {"s7"},
    },
]

VERDICT_LABELS = ["supported", "partially_supported", "unsupported", "insufficient_evidence"]
