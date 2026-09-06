import type { Project, ResearchContextSummary, ResearchQuestionSummary } from '@/lib/types'

export const INTERACTIVE_DEMO_MARKER = '[COGDOC_INTERACTIVE_DEMO_V3]'
export const INTERACTIVE_DEMO_VERSION = 3
export const INTERACTIVE_DEMO_PROJECT_ID = 'cogdoc-interactive-demo-v3'

export const INTERACTIVE_DEMO_TOPIC = 'How can AI-assisted research writing preserve researcher agency?'
export const INTERACTIVE_DEMO_GOAL = 'Develop a bounded argument about how provenance, intervention, and explicit review keep the researcher responsible for claims.'

export const INTERACTIVE_DEMO_QUESTIONS: ResearchQuestionSummary[] = [
  {
    id: 'demo-question-control', projectId: INTERACTIVE_DEMO_PROJECT_ID, contextId: 'demo-context', parentId: null,
    wording: 'What does researcher control mean in an AI-assisted writing workspace?',
    rationale: 'Define the central concept before evaluating the design.', state: 'open', sortOrder: 0, revision: 1,
    createdAt: '2026-09-06T00:00:00.000Z', updatedAt: '2026-09-06T00:00:00.000Z',
  },
  {
    id: 'demo-question-evidence', projectId: INTERACTIVE_DEMO_PROJECT_ID, contextId: 'demo-context', parentId: null,
    wording: 'What risks arise when fluent AI output is treated as evidence?',
    rationale: 'Separate readable prose from inspected support.', state: 'open', sortOrder: 1, revision: 1,
    createdAt: '2026-09-06T00:00:00.000Z', updatedAt: '2026-09-06T00:00:00.000Z',
  },
  {
    id: 'demo-question-evaluation', projectId: INTERACTIVE_DEMO_PROJECT_ID, contextId: 'demo-context', parentId: null,
    wording: 'How could a study evaluate provenance-first research tools?',
    rationale: 'Turn the argument into a testable evaluation question.', state: 'open', sortOrder: 2, revision: 1,
    createdAt: '2026-09-06T00:00:00.000Z', updatedAt: '2026-09-06T00:00:00.000Z',
  },
]

export const INTERACTIVE_DEMO_CONTEXT: ResearchContextSummary = {
  id: 'demo-context', projectId: INTERACTIVE_DEMO_PROJECT_ID, topic: INTERACTIVE_DEMO_TOPIC,
  purpose: INTERACTIVE_DEMO_GOAL,
  existingUnderstanding: 'Provenance and explicit review may help, but that claim still needs inspected evidence and a real evaluation.',
  scope: 'Short demonstration using verified publication identities and clearly labelled sample content.',
  selectedQuestionId: INTERACTIVE_DEMO_QUESTIONS[0].id, lifecycleState: 'exploring', revision: 1,
  createdAt: '2026-09-06T00:00:00.000Z', updatedAt: '2026-09-06T00:00:00.000Z',
}

export const INTERACTIVE_DEMO_SOURCES = [
  {
    id: 'demo-source-unesco', title: 'Guidance for generative AI in education and research',
    url: 'https://unesdoc.unesco.org/ark:/48223/pf0000386693', doi: null, author: 'UNESCO', year: '2023',
    access: 'Metadata record', rationale: 'A policy-oriented source lead about human agency and governance in education.',
  },
  {
    id: 'demo-source-kasneci', title: 'ChatGPT for good? On opportunities and challenges of large language models for education',
    url: 'https://doi.org/10.1016/j.lindif.2023.102274', doi: '10.1016/j.lindif.2023.102274', author: 'Kasneci et al.', year: '2023',
    access: 'Sample abstract context', rationale: 'A scholarly overview that can help frame benefits, risks, and conditions for educational use.',
  },
  {
    id: 'demo-source-bender', title: 'On the dangers of stochastic parrots: Can language models be too big?',
    url: 'https://doi.org/10.1145/3442188.3445922', doi: '10.1145/3442188.3445922', author: 'Bender et al.', year: '2021',
    access: 'Metadata record', rationale: 'A critical source lead for examining fluent output, scale, and accountability.',
  },
] as const

export const DEMO_SAMPLE_PASSAGE = 'Demonstration paraphrase: educational uses of large language models involve opportunities and risks, so their value depends on the context, safeguards, and judgement surrounding their use.'
export const DEMO_ORIGINAL_CLAIM = 'AI tools preserve researcher control because they make writing faster.'
export const DEMO_REVISED_CLAIM = 'AI tools may support researcher control when source provenance stays visible and the researcher separately inspects evidence, explains uncertainty, and reviews each conclusion.'

function doc(paragraphs: string[]) {
  return JSON.stringify({
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Researcher agency in AI-assisted writing' }] },
      ...paragraphs.map((text) => ({ type: 'paragraph', content: [{ type: 'text', text }] })),
    ],
  })
}

export const INTERACTIVE_DEMO_DOCUMENTS = {
  opening: doc(['SIMULATED DEMO. This sample session is isolated from your research and does not use live AI or source providers.']),
  draft: doc([
    'SIMULATED DEMO. This sample session is isolated from your research and does not use live AI or source providers.',
    DEMO_ORIGINAL_CLAIM,
    'That starting claim is too broad. I need to define control, inspect relevant sources, and record what could change my interpretation.',
  ]),
  cited: doc([
    'SIMULATED DEMO. This sample session is isolated from your research and does not use live AI or source providers.',
    DEMO_ORIGINAL_CLAIM,
    'A sample source inspection suggests that benefits and risks depend on context and safeguards (Kasneci et al., 2023, sample citation).',
    'That starting claim is too broad. I need to define control, inspect relevant sources, and record what could change my interpretation.',
  ]),
  revised: doc([
    'SIMULATED DEMO. This sample session is isolated from your research and does not use live AI or source providers.',
    DEMO_REVISED_CLAIM,
    'A sample source inspection suggests that benefits and risks depend on context and safeguards (Kasneci et al., 2023, sample citation).',
    'This remains a demonstration argument. A real project would require lawful source access, exact locators, comparison, and researcher review.',
  ]),
}

export function interactiveDemoWritingFrame(wordCount: number) {
  const text = [
    DEMO_ORIGINAL_CLAIM,
    'That starting claim is too broad. I need to define control, inspect relevant sources, and record what could change my interpretation.',
  ].join(' ')
  const partial = text.split(/\s+/).slice(0, Math.max(0, wordCount)).join(' ')
  return doc([
    'SIMULATED DEMO. This sample session is isolated from your research and does not use live AI or source providers.',
    partial,
  ].filter(Boolean))
}

export const INTERACTIVE_DEMO_WRITING_WORDS = 30

export interface InteractiveDemoState {
  discovery: 'queued' | 'searching' | 'ready'
  inspectedSourceId: string | null
  evidenceChosen: boolean
  citationInserted: boolean
  collaboratorAsked: boolean
  engines: Array<'interceptor' | 'socratic' | 'citation' | 'scaffold'>
  engineAnswered: boolean
  revisionPreviewed: boolean
  revisionApplied: boolean
  findingFilled: boolean
  findingReviewed: boolean
  articleComposed: boolean
  exported: boolean
}

export const INITIAL_INTERACTIVE_DEMO_STATE: InteractiveDemoState = {
  discovery: 'queued', inspectedSourceId: null, evidenceChosen: false, citationInserted: false,
  collaboratorAsked: false, engines: [], engineAnswered: false, revisionPreviewed: false,
  revisionApplied: false, findingFilled: false, findingReviewed: false, articleComposed: false, exported: false,
}

export function createInteractiveDemoProject(): Project {
  return {
    id: INTERACTIVE_DEMO_PROJECT_ID, title: 'Interactive demo: researcher agency',
    description: `${INTERACTIVE_DEMO_MARKER} Client-only simulated walkthrough. No live provider or database records.`,
    archived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    workspaceType: 'research', reviewPace: 'deep', citationStyle: 'harvard', lifecycleState: 'draft',
    briefText: INTERACTIVE_DEMO_GOAL,
    document: { id: 'demo-document', content: INTERACTIVE_DEMO_DOCUMENTS.opening, lastSaved: new Date().toISOString(), revision: 0, contentHash: 'interactive-demo' },
    pdfs: [], interventions: [], _count: { pdfs: 0, interventions: 0 },
  }
}

export function isInteractiveDemo(project: Pick<Project, 'id' | 'description'> | null | undefined) {
  return project?.id === INTERACTIVE_DEMO_PROJECT_ID || Boolean(project?.description?.includes(INTERACTIVE_DEMO_MARKER))
}

export function interactiveDemoMarkdown() {
  return `# Researcher agency in AI-assisted writing\n\n> Simulated CogDoc demo output. This is not a reviewed research article.\n\n## Working question\n\n${INTERACTIVE_DEMO_QUESTIONS[0].wording}\n\n## Sample argument\n\n${DEMO_REVISED_CLAIM}\n\n## Demonstration evidence boundary\n\n${DEMO_SAMPLE_PASSAGE}\n\nThis passage is a demonstration paraphrase linked to the verified publication identity below. It is not a quotation or a substitute for inspecting the original.\n\n## Limitation\n\nThis simulated walkthrough does not establish that provenance-first tools improve reasoning or learning outcomes.\n\n## Reference lead\n\nKasneci, E. et al. (2023). ChatGPT for good? On opportunities and challenges of large language models for education. DOI: 10.1016/j.lindif.2023.102274.\n`
}

export function downloadInteractiveDemoMarkdown() {
  const blob = new Blob([interactiveDemoMarkdown()], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'cogdoc-simulated-researcher-agency-demo.md'
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}
