import { sha256 } from '@/lib/crypto'

export type ResearchHelpKind = 'help' | 'hint' | 'example' | 'alternative' | 'next' | 'proposal'

export interface ContextualHelpInput {
  kind: ResearchHelpKind
  question: string
  explanation: string
  passage?: { id: string; content: string; sourceTitle: string } | null
}

export interface ContextualHelpResult {
  kind: ResearchHelpKind
  title: string
  body: string
  basis: string
  action: string
  hypothetical: boolean
  proposal?: { conclusion: string; uncertainty: string; limitations: string; conflicts: string }
  noUsefulGap?: boolean
}

export function contextualHelpKey(input: ContextualHelpInput) {
  return sha256(JSON.stringify({ kind: input.kind, question: input.question.trim(), explanation: input.explanation.trim(), passageId: input.passage?.id ?? null }))
}

/** A bounded local fallback: it never adds facts, sources, review decisions, or prose answers. */
export function createContextualHelp(input: ContextualHelpInput): ContextualHelpResult {
  const explanation = input.explanation.trim()
  const passageLabel = input.passage ? `the supplied passage from ${input.passage.sourceTitle}` : 'your current explanation'
  const causal = /\b(cause|causes|caused|because|leads? to|results? in)\b/i.test(explanation)
  if (!explanation) return {
    kind: input.kind, title: 'Start with the connection',
    body: `What does ${passageLabel} actually say that bears on “${input.question}”?`,
    basis: input.passage ? `Based on the supplied passage (${input.passage.id}).` : 'No explanation or inspected passage is attached yet.',
    action: 'Write one provisional connection or record that the evidence is not enough.', hypothetical: false,
  }
  if (input.kind === 'example') return {
    kind: input.kind, title: 'A hypothetical way to test the reasoning',
    body: 'Hypothetical example: if access hours changed while students’ schedules and other support stayed similar, what observation would strengthen or weaken your explanation?',
    basis: 'This is a general hypothetical example, not evidence about this research question.', action: 'Compare the example with your actual source before changing a finding.', hypothetical: true,
  }
  if (input.kind === 'alternative') return {
    kind: input.kind, title: 'Consider an alternative explanation',
    body: `What else besides the factor you named could explain the pattern in ${passageLabel}?`,
    basis: `Based on the explanation you saved${input.passage ? ` and passage ${input.passage.id}` : ''}.`, action: 'Name the alternative or record that you have not assessed one yet.', hypothetical: false,
  }
  if (input.kind === 'next') return {
    kind: input.kind, title: 'A useful next investigation step',
    body: 'Look for a source, passage, or counterexample that distinguishes the explanation you have from a plausible alternative.',
    basis: 'A general next-step suggestion; it does not claim a missing fact.', action: 'Find a different perspective or keep an explicit evidence gap.', hypothetical: false,
  }
  if (input.kind === 'proposal') return {
    kind: input.kind, title: 'Proposed finding structure',
    body: 'This is a suggested organization of your wording. It is not a finding, evidence link, or review decision until you explicitly incorporate it.',
    basis: 'Organized from the researcher’s saved explanation only.', action: 'Copy only fields that still represent your view.', hypothetical: false,
    proposal: { conclusion: explanation, uncertainty: 'Not yet assessed.', limitations: 'This organization does not add evidence.', conflicts: 'Not yet considered.' },
  }
  if (!causal && explanation.length > 90) return {
    kind: input.kind, title: 'Your explanation can proceed', body: 'No specific reasoning gap is apparent from this bounded context. You can save a tentative finding, add a limitation, or ask for another perspective.',
    basis: `Based only on your saved explanation${input.passage ? ` and passage ${input.passage.id}` : ''}.`, action: 'Capture the finding when it reflects your view.', hypothetical: false, noUsefulGap: true,
  }
  return {
    kind: input.kind, title: causal ? 'Check the strength of the link' : 'Make the connection explicit',
    body: causal ? `Does ${passageLabel} show that one factor caused the outcome, or only that they occurred together?` : `Which words or details in ${passageLabel} make your current answer more plausible?`,
    basis: `Based on the explanation you saved${input.passage ? ` and passage ${input.passage.id}` : ''}.`, action: 'Add a bounded reason, limitation, or evidence gap in your own words.', hypothetical: false,
  }
}
