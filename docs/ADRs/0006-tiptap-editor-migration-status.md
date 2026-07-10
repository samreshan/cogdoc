# ADR-0006: Tiptap editor migration — extensions built, surface swap deferred

**Date:** 2026-07-10 · **Sprint:** 2 (Stream C) · **Status:** Accepted (partial)

## Context

PRODUCT.md §10.2 and the IR Report §2.3.2 specify React + **Tiptap** (ProseMirror)
as the editor surface. The MVP ships a raw `contentEditable` + deprecated
`document.execCommand` (PRODUCT.md §10.2 deviation table). Sprint 2 Stream C was
tasked with closing this gap: port `WavyUnderline` and `IdleDetector` as Tiptap
extensions, then swap `editor.tsx` behind a `USE_TIPTAP_EDITOR` flag.

## Decision

**Deliver the Tiptap extension layer now; defer the full `editor.tsx` swap to
Sprint 3.** Concretely:

- ✅ **Built & tested (Stream C):**
  - `src/lib/extensions/wavy-underline.ts` — a Tiptap `Mark` that wraps
    intervention-linked sentences in `<mark class="cogdoc-mark">` with the
    engine colour, data attributes (engineTypes, interventionIds, sentenceKey),
    and parseHTML/renderHTML round-tripping. Mirrors the
    `sentence-highlight.ts` colour contract exactly.
  - `src/lib/extensions/idle-detector.ts` — a decoupled typing-idle timer
    (replaces the inline 2000ms logic in `editor.tsx`) with the correct 45000ms
    default per IR §2.3.6. Fully unit-tested with fake timers.
- ⏳ **Deferred:** swapping the `editor.tsx` writing surface from
  `contentEditable` to Tiptap, and migrating `Document.content` from an HTML
  string to a ProseMirror doc.

## Rationale

The full editor swap is a high-risk, high-churn change that touches the most
complex component in the system (420 lines of cursor-save/restore, auto-save,
engine-firing orchestration). Doing it properly requires porting all of that
orchestration onto the ProseMirror transaction model — work that deserves a
dedicated focus, not the tail end of a parallelised sprint.

The **extension layer is the irreducible, reusable part**: once `WavyUnderline`
and `IdleDetector` exist and are tested, the eventual surface swap is a
plumbing task, not a research task. Building them now de-risks Sprint 3.

## Consequences

- The IR Report §2.3.2 deviation is **partially** closed: the Tiptap
  dependencies and extensions are in place; the surface swap is the remaining
  work, explicitly tracked for Sprint 3.
- The existing `contentEditable` editor remains the default (behind no flag —
  it simply stays). The characterization tests (`sentence-highlight.test.ts`,
  `store.test.ts`) remain green and valid.
- `WavyUnderline` + `IdleDetector` are covered by the gate (Stream C tests).
- The `IDLE_THRESHOLD_MS = 2_000` debugging value in `editor.tsx` is **not yet**
  replaced by the corrected 45000ms default; that change lands when the surface
  swaps. The new `IdleDetector` uses the correct default and is ready.

## Follow-up (Sprint 3)

1. Port `editor.tsx` to Tiptap behind `USE_TIPTAP_EDITOR`, wiring `WavyUnderline`
   and `IdleDetector`.
2. Migrate `Document.content` from HTML string to ProseMirror JSON.
3. Re-include `engine-characters.tsx` in coverage once the editor settles.
