/**
 * Labeled prompt set for Interceptor blocking evaluation (PRODUCT.md §14.5).
 *
 * Each prompt is hand-labeled with the true classification. The evaluation
 * harness runs the heuristic classifier over these and reports blocking
 * precision (of prompts blocked, how many were truly delegative — false-block
 * rate must be low) and delegative recall.
 *
 * Acceptance targets (PRODUCT.md §14.5):
 *   blocking precision >= 0.90
 *   delegative recall   >= 0.90
 */
export type PromptLabel = 'delegative' | 'vague' | 'assistant' | 'metacognitive'

export interface LabeledPrompt {
  prompt: string
  label: PromptLabel
}

export const INTERCEPTOR_PROMPTS: LabeledPrompt[] = [
  // ── delegative (must be blocked) ──
  { prompt: 'write a paragraph about cognitive load theory', label: 'delegative' },
  { prompt: 'draft an essay on the effects of generative AI', label: 'delegative' },
  { prompt: 'generate the introduction section for my dissertation', label: 'delegative' },
  { prompt: 'write me a literature review on retrieval-augmented generation', label: 'delegative' },
  { prompt: 'produce a summary of this paper into a paragraph', label: 'delegative' },
  { prompt: 'create an outline for my methodology section', label: 'delegative' },
  { prompt: 'write a conclusion for my report', label: 'delegative' },
  { prompt: 'draft the related work section', label: 'delegative' },
  { prompt: 'generate a paper about machine learning', label: 'delegative' },
  { prompt: 'write an introduction paragraph about friction', label: 'delegative' },

  // ── vague (should be refused, asked for specificity) ──
  { prompt: 'help with my intro', label: 'vague' },
  { prompt: 'make it better', label: 'vague' },
  { prompt: 'fix this', label: 'vague' },

  // ── assistant (must NOT be blocked — legitimate non-generative help) ──
  { prompt: 'what are common counterarguments to cognitivism?', label: 'assistant' },
  { prompt: 'suggest three research questions about cognitive offloading', label: 'assistant' },
  { prompt: 'what does the literature say about desirable difficulties?', label: 'assistant' },
  { prompt: 'explain the difference between cognitive load and mental effort', label: 'assistant' },
  { prompt: 'what frameworks exist for evaluating AI writing tools?', label: 'assistant' },

  // ── metacognitive (must NOT be blocked — reflection on own writing) ──
  { prompt: 'is my argument here circular?', label: 'metacognitive' },
  { prompt: 'does this paragraph assume its conclusion?', label: 'metacognitive' },
  { prompt: 'what is the weakest claim in my draft?', label: 'metacognitive' },
  { prompt: 'am I over-relying on a single source here?', label: 'metacognitive' },
]
