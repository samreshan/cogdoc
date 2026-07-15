/**
 * Pure orchestration helpers for the Tiptap editor (ADR-0006 close-out).
 *
 * The editor component (editor-tiptap.tsx) is wiring; these helpers hold the
 * testable decisions: which engines fire for a sentence, the friction-scaled
 * idle threshold, ProseMirror-JSON serialisation, and paragraph-completion
 * detection. Extracted so the contentEditable→Tiptap swap has a unit-testable
 * safety net independent of the React/Tiptap runtime.
 */
import { analyzeSentence, type EngineType } from '@/lib/content-analyzer'
import { COOLDOWN_SCALE, type FrictionMode } from '@/lib/friction'

/** The spec-correct idle threshold (IR §2.3.6) before friction scaling. */
export const IDLE_THRESHOLD_BASE_MS = 45_000

/**
 * The friction-scaled idle threshold for the Socratic Spacer.
 * Socratic = full 45s; coach ~50% (~22s); assistant ~25% (~11s).
 */
export function idleThresholdForMode(mode: FrictionMode): number {
  return Math.max(1, Math.round(IDLE_THRESHOLD_BASE_MS * COOLDOWN_SCALE[mode]))
}

/** Which engines should fire for a completed sentence (delegates to the analyzer). */
export function pickEnginesForSentence(sentence: string): EngineType[] {
  return analyzeSentence(sentence).engines
}

/** Serialise a ProseMirror JSON doc to a string for Document.content storage. */
export function serializeForSave(doc: unknown): string {
  if (doc == null) return ''
  return JSON.stringify(doc)
}

/**
 * Detect paragraph completion for the Scaffold trigger:
 * ≥2 paragraphs, the last is short (<10 chars), the previous is substantial (>50).
 */
export function isParagraphComplete(paras: string[]): boolean {
  if (paras.length < 2) return false
  const last = paras[paras.length - 1]
  const prev = paras[paras.length - 2]
  return last.length < 10 && prev.length > 50
}
