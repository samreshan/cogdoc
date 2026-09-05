import type { EngineType } from '@/lib/types'
import { plainResearchQuestion } from '@/lib/intervention-language'

export interface InterventionAnswerEvaluation {
  satisfied: boolean
  rationale: string
  followUpQuestion: string | null
}

export function parseInterventionAnswerEvaluation(raw: string): InterventionAnswerEvaluation | null {
  try {
    const start = raw.indexOf('{')
    const end = raw.lastIndexOf('}')
    if (start < 0 || end <= start) return null
    const parsed = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>
    if (typeof parsed.satisfied !== 'boolean' || typeof parsed.rationale !== 'string') return null
    const followUpQuestion = typeof parsed.follow_up_question === 'string' && parsed.follow_up_question.trim()
      ? parsed.follow_up_question.trim().slice(0, 300)
      : null
    return {
      satisfied: parsed.satisfied,
      rationale: parsed.rationale.trim().slice(0, 500),
      followUpQuestion: parsed.satisfied ? null : followUpQuestion,
    }
  } catch {
    return null
  }
}

/** Conservative offline fallback: weak answers always remain open. */
export function evaluateInterventionAnswerLocally(input: {
  answer: string
  engineType: EngineType
}): InterventionAnswerEvaluation {
  const words = input.answer.trim().split(/\s+/).filter(Boolean)
  const reasoningCue = /\b(because|therefore|evidence|source|study|passage|example|measure|observe|compare|however|limitation|depends)\b/i.test(input.answer)
  const evidenceCue = /\b(evidence|source|study|passage|citation|data|finding)\b/i.test(input.answer)
  const satisfied = words.length >= 10 && reasoningCue && (input.engineType !== 'citation' || evidenceCue)
  if (satisfied) {
    return {
      satisfied: true,
      rationale: 'Your answer gives a clear reason and enough detail to continue.',
      followUpQuestion: null,
    }
  }
  const followUpQuestion = words.length < 6
    ? 'Can you give one clear reason?'
    : input.engineType === 'citation' && !evidenceCue
      ? 'Which source supports this?'
      : 'Can you give one example?'
  return {
    satisfied: false,
    rationale: 'A little more detail will make your point clear.',
    followUpQuestion: plainResearchQuestion(followUpQuestion, input.engineType, input.answer),
  }
}

export function structuredResolutionLines(input: {
  claim: string
  answer: string
  rationale: string
  evidence: Array<{ filename: string; pageApprox: number; excerpt: string }>
}): Array<{ label: string; value: string }> {
  const evidence = input.evidence.length
    ? input.evidence.map((item) => `${item.filename}, p.${item.pageApprox}: ${item.excerpt}`).join('\n')
    : 'No source passage was attached to this intervention; verify support before using the claim.'
  return [
    { label: 'Claim under review', value: input.claim },
    { label: 'Researcher reasoning', value: input.answer },
    { label: 'Evaluation', value: input.rationale },
    { label: 'Supporting passages', value: evidence },
  ]
}
