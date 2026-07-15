# ADR-0009: Document.content migration — HTML → ProseMirror JSON

- **Status:** Accepted
- **Date:** 2026-07-15
- **Sprint:** P5 (gap #6)

## Context

`Document.content` is stored as an HTML string (the raw `contentEditable`
innerHTML). The Tiptap swap (ADR-0006 close-out) requires ProseMirror JSON as the
canonical document model — HTML strings are a lossy, re-parse-on-each-load
representation that doesn't round-trip marks (WavyUnderline) cleanly.

Existing documents (HTML) must keep loading, and the save path must emit JSON
going forward. The document route + the editor serialisation both change.

## Decision

- **Canonical store: ProseMirror JSON.** The Tiptap editor serialises via
  `editor.getJSON()`; the document route accepts and persists that JSON object.
- **Back-compat read: accept HTML on load.** The editor initialises content via
  `editor.commands.setContent(value)` which accepts BOTH a JSON object and an
  HTML string (Tiptap parses HTML into a doc automatically). So existing HTML
  documents load without a migration — they're parsed into ProseMirror on first
  open and saved back as JSON on the next auto-save (lazy migration).
- **The route accepts either shape.** `PUT { content }` stores `content` as
  received. Because the Prisma column is `String` (JSON is stored as a string),
  both the old HTML and the new `JSON.stringify(doc)` are valid string payloads.
  The editor decides which to send based on which surface is active.

## Consequences

- No explicit data migration script is needed — documents migrate lazily on the
  first open+save under the Tiptap editor.
- A document saved under the old contentEditable editor (HTML) and opened under
  Tiptap parses cleanly (Tiptap's HTML parser is robust for the simple
  paragraph/bold/italic structure Cogdoc produces).
- The `USE_TIPTAP_EDITOR` flag gates which editor is active; both write to the
  same column, and each can read what the other wrote (HTML ↔ JSON both parse).
- This closes ADR-0006 follow-up #2 (content migration).
