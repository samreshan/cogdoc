"""Tests for the SSE event-formatter helper (PRODUCT.md §12.3 schema).

format_sse emits the wire format the TS client parser (src/lib/sse.ts) expects:
  event: <type>\ndata: <json>\n\n
"""
import json

from app.sse import format_sse, sse_meta, sse_token, sse_done, sse_error


class TestFormatSse:
    def test_basic_event_shape(self):
        out = format_sse("token", {"t": "hello"})
        assert out == 'event: token\ndata: {"t": "hello"}\n\n'

    def test_terminates_with_double_newline(self):
        # The dispatching blank line is what the client splits on.
        out = format_sse("token", {"t": "x"})
        assert out.endswith("\n\n")

    def test_meta_event_carries_tag_engine_and_friction_mode(self):
        out = sse_meta(tag="[The Spark Gap]", engine="interceptor", friction_mode="socratic")
        body = json.loads(out.split("data: ", 1)[1].strip())
        assert body["tag"] == "[The Spark Gap]"
        assert body["engine"] == "interceptor"
        assert body["friction_mode"] == "socratic"
        assert out.startswith("event: meta\n")

    def test_token_event_carries_single_t_field(self):
        out = sse_token("Why")
        body = json.loads(out.split("data: ", 1)[1].strip())
        assert body == {"t": "Why"}

    def test_done_event_carries_intervention_id(self):
        out = sse_done(intervention_id="iv-1", verdict=None)
        body = json.loads(out.split("data: ", 1)[1].strip())
        assert body["intervention_id"] == "iv-1"
        assert body["verdict"] is None

    def test_error_event_carries_code_and_message(self):
        out = sse_error(code="guard_violation", message="non-generation contract")
        body = json.loads(out.split("data: ", 1)[1].strip())
        assert body["code"] == "guard_violation"
        assert "message" in body
