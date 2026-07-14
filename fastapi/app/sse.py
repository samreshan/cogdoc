"""SSE event-formatter for the streaming endpoints (PRODUCT.md §12.3).

Emits the wire format the TS client parser (src/lib/sse.ts) consumes:
    event: <type>\ndata: <json>\n\n

The event schema is immutable (§12.3 contract):
    meta   { tag, engine, friction_mode }
    token  { t }
    done   { intervention_id, verdict }
    error  { code, message }   code ∈ rate_limited | model_error | guard_violation
"""
from __future__ import annotations

import json
from typing import Any


def format_sse(event: str, data: Any) -> str:
    """Format a single SSE event block: event line + data line + blank line."""
    payload = data if isinstance(data, str) else json.dumps(data)
    return f"event: {event}\ndata: {payload}\n\n"


def sse_meta(*, tag: str, engine: str, friction_mode: str) -> str:
    return format_sse("meta", {"tag": tag, "engine": engine, "friction_mode": friction_mode})


def sse_token(t: str) -> str:
    return format_sse("token", {"t": t})


def sse_done(*, intervention_id: str | None, verdict: str | None = None) -> str:
    return format_sse("done", {"intervention_id": intervention_id, "verdict": verdict})


def sse_error(*, code: str, message: str) -> str:
    return format_sse("error", {"code": code, "message": message})
