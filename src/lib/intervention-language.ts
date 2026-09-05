import type { EngineType, Intervention } from '@/lib/types'

const SIMPLE_QUESTIONS: Record<EngineType, string[]> = {
  citation: [
    'What source backs this up?',
    'Where did this claim come from?',
    'Does your source really say this?',
  ],
  interceptor: [
    'What do you mean here?',
    'Can you say this in your own words?',
    'Can you give one clear example?',
  ],
  socratic: [
    'What makes you think this?',
    'What might be another way to see this?',
    'What would change your mind?',
  ],
  scaffold: [
    'What is the main point here?',
    'What should come first in this section?',
    'How do these ideas connect?',
  ],
}

const COMPLEX_LANGUAGE = /\b(epistemic|ontological|falsif(?:y|iable)|operationali[sz]e|substantiate|possess(?:ing|ion)? (?:evidence|knowledge)|holding evidence|distinct from|automatically mean|conceptual framework|theoretical implication)\b/i

function stableIndex(value: string, length: number): number {
  let hash = 0
  for (const character of value) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0
  return Math.abs(hash) % length
}

function fallbackQuestion(engineType: EngineType, anchor: string): string {
  const options = SIMPLE_QUESTIONS[engineType]
  return options[stableIndex(anchor, options.length)]!
}

/** Turn model output and old tagged prompts into one short conversational question. */
export function plainResearchQuestion(
  value: string | null | undefined,
  engineType: EngineType,
  anchor = '',
): string {
  const cleaned = (value ?? '')
    .replace(/^\s*(?:\[[^\]]+\]\s*)+/i, '')
    .replace(/^\s*(?:question|provocation|prompt)\s*:\s*/i, '')
    .replace(/^['“”"]+|['“”"]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  const firstQuestion = cleaned.match(/^[^?]{1,300}\?/)?.[0] ?? cleaned
  const words = firstQuestion.split(/\s+/).filter(Boolean)
  const crowded = words.length > 12 && /[,;:—]/.test(firstQuestion)
  if (!firstQuestion.endsWith('?') || words.length < 3 || words.length > 18 || crowded || COMPLEX_LANGUAGE.test(firstQuestion)) {
    return fallbackQuestion(engineType, anchor || cleaned)
  }
  return firstQuestion
}

export function interventionQuestion(intervention: Intervention): string {
  return plainResearchQuestion(intervention.responseText, intervention.engineType, intervention.promptText ?? intervention.id)
}
