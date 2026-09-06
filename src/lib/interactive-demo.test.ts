// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest'
import {
  DEMO_ORIGINAL_CLAIM, INTERACTIVE_DEMO_DOCUMENTS, INTERACTIVE_DEMO_MARKER,
  INTERACTIVE_DEMO_PROJECT_ID, createInteractiveDemoProject, downloadInteractiveDemoMarkdown,
  interactiveDemoMarkdown, interactiveDemoWritingFrame, isInteractiveDemo,
} from './interactive-demo'

describe('interactive demo boundary', () => {
  it('creates an isolated client-only sample project with an explicit simulation marker', () => {
    const project = createInteractiveDemoProject()
    expect(project.id).toBe(INTERACTIVE_DEMO_PROJECT_ID)
    expect(project.description).toContain(INTERACTIVE_DEMO_MARKER)
    expect(project.document?.content).toContain('SIMULATED DEMO')
    expect(isInteractiveDemo(project)).toBe(true)
  })

  it('builds a meaningful labelled Markdown export only when called', () => {
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:demo')
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    expect(interactiveDemoMarkdown()).toContain('Simulated CogDoc demo output')
    expect(click).not.toHaveBeenCalled()
    downloadInteractiveDemoMarkdown()
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    expect(click).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).not.toHaveBeenCalled()
  })

  it('evolves the real editor through distinct draft, citation, and revision states', () => {
    expect(interactiveDemoWritingFrame(4)).not.toBe(interactiveDemoWritingFrame(18))
    expect(INTERACTIVE_DEMO_DOCUMENTS.draft).toContain(DEMO_ORIGINAL_CLAIM)
    expect(INTERACTIVE_DEMO_DOCUMENTS.cited).toContain('demonstration paraphrase')
    expect(INTERACTIVE_DEMO_DOCUMENTS.revised).not.toContain(DEMO_ORIGINAL_CLAIM)
    expect(INTERACTIVE_DEMO_DOCUMENTS.revised).toContain('health checks')
    expect(interactiveDemoMarkdown()).toContain('illustrative and was not run')
  })
})
