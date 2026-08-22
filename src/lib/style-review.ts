/**
 * Natural Style Review is intentionally deterministic and advisory. It
 * identifies patterns an author may want to reconsider; it never generates
 * replacement prose, scores authorship, or sends a document to a third party.
 */

export const STYLE_REVIEW_VERSION = '1.0'

export type StyleReviewScope = 'selection' | 'paragraph' | 'document'

export type StyleRule =
  | 'long_sentence'
  | 'repeated_opener'
  | 'monotonous_cadence'
  | 'passive_voice_cluster'
  | 'nominalization_cluster'
  | 'hedging_cluster'
  | 'absolute_language'
  | 'wordy_phrase'
  | 'stock_phrase'
  | 'transition_overuse'

export interface StyleReviewBlock {
  /** Text from one ProseMirror text block. */
  text: string
  /** Inclusive ProseMirror position for the first character. */
  from: number
  /** Exclusive ProseMirror position after the final character. */
  to: number
  nodeType: 'paragraph' | 'heading' | 'blockquote' | 'codeBlock' | 'listItem' | 'tableCell' | string
  /** Set by the editor for bibliography content and other intentionally excluded text. */
  isProtected?: boolean
}

export interface StyleSuggestion {
  id: string
  rule: StyleRule
  severity: 'notice' | 'consider'
  title: string
  detail: string
  authorPrompt: string
  excerpt: string
  from: number
  to: number
}

export interface StyleReviewResult {
  analyzerVersion: typeof STYLE_REVIEW_VERSION
  scope: StyleReviewScope
  reviewedWordCount: number
  suggestions: StyleSuggestion[]
}

export interface StyleReviewInput {
  scope: StyleReviewScope
  blocks: StyleReviewBlock[]
}

type Sentence = { text: string; masked: string; start: number; end: number; words: number }

const EXCLUDED_NODE_TYPES = new Set(['heading', 'blockquote', 'codeBlock', 'listItem', 'tableCell'])
const REFERENCE_HEADING = /^\s*(references|bibliography|works cited)\s*$/i
const WORDY_PHRASES = [
  'in order to', 'due to the fact that', 'at this point in time', 'in the event that',
  'has the ability to', 'for the purpose of', 'a large number of', 'is able to',
]
const STOCK_PHRASES = [
  'delve into', 'ever-evolving', 'in today\'s world', 'a tapestry of', 'it is important to note',
]
const ABSOLUTE_TERMS = /\b(always|never|clearly|undoubtedly|obviously|proves?|definitively|all|none)\b/gi
const HEDGING_TERMS = /\b(may|might|perhaps|somewhat|rather|quite|arguably|possibly)\b/gi
const TRANSITIONS = /\b(however|therefore|moreover|furthermore|consequently|additionally)\b/gi
const PASSIVE = /\b(?:is|are|was|were|be|been|being)\s+(?:[a-z]+ed|[a-z]+en)\b/gi

function wordCount(value: string): number {
  return value.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu)?.length ?? 0
}

/** Preserve offsets while excluding quotations, URLs, DOIs, and author-year citations from style heuristics. */
function maskProtectedInlineText(value: string): string {
  return value
    .replace(/[“"][^”"]{0,800}[”"]/g, (match) => ' '.repeat(match.length))
    .replace(/https?:\/\/\S+|\b(?:doi:\s*)?10\.\d{4,9}\/[\w.()/:;-]+/gi, (match) => ' '.repeat(match.length))
    .replace(/\([^()]{0,160}\b(?:19|20)\d{2}[a-z]?[^()]{0,160}\)/gi, (match) => ' '.repeat(match.length))
}

function sentences(text: string): Sentence[] {
  const masked = maskProtectedInlineText(text)
  const result: Sentence[] = []
  const pattern = /[^.!?\n]+(?:[.!?]+|$)/g
  for (const match of text.matchAll(pattern)) {
    const raw = match[0] ?? ''
    const start = (match.index ?? 0) + (raw.match(/^\s*/)?.[0].length ?? 0)
    const end = (match.index ?? 0) + raw.length
    const trimmed = raw.trim()
    if (!trimmed) continue
    const maskedSlice = masked.slice(start, end).trim()
    result.push({ text: trimmed, masked: maskedSlice, start, end, words: wordCount(maskedSlice) })
  }
  return result
}

function excerpt(value: string, max = 150): string {
  const trimmed = value.replace(/\s+/g, ' ').trim()
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1).trimEnd()}…`
}

function addSuggestion(
  suggestions: StyleSuggestion[],
  seen: Set<string>,
  block: StyleReviewBlock,
  rule: StyleRule,
  start: number,
  end: number,
  severity: StyleSuggestion['severity'],
  title: string,
  detail: string,
  authorPrompt: string,
): void {
  const from = block.from + start
  const to = Math.min(block.to, block.from + end)
  if (to <= from) return
  const key = `${rule}:${from}:${to}`
  if (seen.has(key)) return
  seen.add(key)
  suggestions.push({
    id: key,
    rule,
    severity,
    title,
    detail,
    authorPrompt,
    excerpt: excerpt(block.text.slice(start, end)),
    from,
    to,
  })
}

function firstWords(value: string): string {
  return value
    .toLowerCase()
    .replace(/^[^\p{L}\p{N}]*/u, '')
    .match(/[\p{L}\p{N}'’-]+/gu)
    ?.slice(0, 3)
    .join(' ') ?? ''
}

function matches(value: string, expression: RegExp): RegExpMatchArray[] {
  return [...value.matchAll(new RegExp(expression.source, expression.flags))]
}

function reviewBlock(block: StyleReviewBlock, suggestions: StyleSuggestion[], seen: Set<string>): void {
  const blockSentences = sentences(block.text)
  for (const sentence of blockSentences) {
    const sentenceStart = sentence.start
    const sentenceEnd = sentence.end
    const conjunctions = matches(sentence.masked, /\b(and|but|which|while|because|although|whereas)\b/gi).length
    if (sentence.words >= 35 && conjunctions >= 2) {
      addSuggestion(
        suggestions, seen, block, 'long_sentence', sentenceStart, sentenceEnd, 'consider', 'This sentence carries several ideas',
        'Long, clause-stacked sentences can hide the main claim or relationship.',
        'Could you split this into two sentences and make the main point explicit?',
      )
    }

    const passiveCount = matches(sentence.masked, PASSIVE).length
    if (passiveCount >= 2) {
      addSuggestion(
        suggestions, seen, block, 'passive_voice_cluster', sentenceStart, sentenceEnd, 'notice', 'Several passive constructions appear together',
        'Passive voice can be useful, but repeated use may obscure who performed the action.',
        'Where relevant, can you name the actor and action more directly?',
      )
    }

    const nominalizations = sentence.masked.match(/\b[\p{L}-]*(?:tion|sion|ment|ness|ance|ence|ity)\b/giu)?.length ?? 0
    if (nominalizations >= 4) {
      addSuggestion(
        suggestions, seen, block, 'nominalization_cluster', sentenceStart, sentenceEnd, 'notice', 'This sentence uses several abstract noun forms',
        'Dense nominalizations can make actions and responsibility less visible.',
        'Could one or two abstract nouns become concrete verbs or actors?',
      )
    }

    const absoluteCount = matches(sentence.masked, ABSOLUTE_TERMS).length
    if (absoluteCount >= 2) {
      addSuggestion(
        suggestions, seen, block, 'absolute_language', sentenceStart, sentenceEnd, 'consider', 'This claim uses strong certainty language',
        'Absolute wording needs especially clear evidence and carefully stated scope.',
        'Does the evidence support this level of certainty, or should the claim be qualified?',
      )
    }

    const hedgingCount = matches(sentence.masked, HEDGING_TERMS).length
    if (hedgingCount >= 3) {
      addSuggestion(
        suggestions, seen, block, 'hedging_cluster', sentenceStart, sentenceEnd, 'notice', 'Several hedges soften this point',
        'Layered hedging can make a well-supported claim harder to follow.',
        'Which qualification is necessary for accuracy, and which could be removed?',
      )
    }
  }

  for (const phrase of WORDY_PHRASES) {
    const expression = new RegExp(`\\b${phrase.replace(/ /g, '\\s+')}\\b`, 'gi')
    for (const match of maskedMatches(block.text, expression)) {
      const start = match.index ?? 0
      addSuggestion(
        suggestions, seen, block, 'wordy_phrase', start, start + match[0].length, 'notice', 'This phrase may be more elaborate than needed',
        'A shorter expression may make the sentence easier to read without changing its meaning.',
        'Can you express this relationship in fewer words while keeping the intended meaning?',
      )
    }
  }

  for (const phrase of STOCK_PHRASES) {
    const expression = new RegExp(`\\b${phrase.replace(/ /g, '\\s+')}\\b`, 'gi')
    for (const match of maskedMatches(block.text, expression)) {
      const start = match.index ?? 0
      addSuggestion(
        suggestions, seen, block, 'stock_phrase', start, start + match[0].length, 'notice', 'This reads like a stock phrase',
        'Specific language usually gives the reader a clearer picture of the work or evidence.',
        'What concrete action, object, or finding do you want the reader to understand here?',
      )
    }
  }

  for (let index = 2; index < blockSentences.length; index += 1) {
    const first = firstWords(blockSentences[index - 2]!.masked)
    const second = firstWords(blockSentences[index - 1]!.masked)
    const third = firstWords(blockSentences[index]!.masked)
    if (first.length >= 6 && first === second && second === third) {
      addSuggestion(
        suggestions, seen, block, 'repeated_opener', blockSentences[index - 2]!.start, blockSentences[index]!.end, 'notice', 'Three adjacent sentences begin the same way',
        'Repeated openings can flatten the paragraph’s rhythm.',
        'Could you vary how these sentences begin while preserving their logical sequence?',
      )
    }
  }

  if (blockSentences.length >= 4) {
    const lengths = blockSentences.map((sentence) => sentence.words).filter((length) => length >= 8)
    if (lengths.length >= 4 && Math.max(...lengths) - Math.min(...lengths) <= 3) {
      addSuggestion(
        suggestions, seen, block, 'monotonous_cadence', blockSentences[0]!.start, blockSentences.at(-1)!.end, 'notice', 'This paragraph has a very even sentence rhythm',
        'Uniform sentence length can make a paragraph feel mechanical even when each sentence is clear.',
        'Would a shorter or more direct sentence improve the paragraph’s pacing?',
      )
    }
  }

  const transitionMatches = matches(maskProtectedInlineText(block.text), TRANSITIONS)
  if (transitionMatches.length >= 3) {
    const first = transitionMatches[0]!
    const last = transitionMatches.at(-1)!
    const start = first.index ?? 0
    const end = (last.index ?? 0) + last[0].length
    addSuggestion(
      suggestions, seen, block, 'transition_overuse', start, end, 'notice', 'Several explicit transitions appear in one block',
      'Transitions are useful signposts, but frequent use can make the structure feel over-explained.',
      'Which transitions are doing essential logical work, and which could be removed?',
    )
  }
}

function maskedMatches(value: string, expression: RegExp): RegExpMatchArray[] {
  const masked = maskProtectedInlineText(value)
  return [...masked.matchAll(expression)]
}

export function reviewNaturalStyle({ scope, blocks }: StyleReviewInput): StyleReviewResult {
  const suggestions: StyleSuggestion[] = []
  const seen = new Set<string>()
  let protectedByReferences = false
  let reviewedWordCount = 0

  for (const block of blocks) {
    if (REFERENCE_HEADING.test(block.text)) {
      protectedByReferences = true
      continue
    }
    if (protectedByReferences || block.isProtected || EXCLUDED_NODE_TYPES.has(block.nodeType)) continue
    reviewedWordCount += wordCount(maskProtectedInlineText(block.text))
    reviewBlock(block, suggestions, seen)
  }

  suggestions.sort((left, right) => left.from - right.from || left.to - right.to || left.rule.localeCompare(right.rule))
  return { analyzerVersion: STYLE_REVIEW_VERSION, scope, reviewedWordCount, suggestions }
}
