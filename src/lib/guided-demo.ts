import type { Project, ResearchQuestionSummary } from '@/lib/types'
import { api } from '@/lib/api-client'

export const GUIDED_DEMO_MARKER = '[COGDOC_GUIDED_DEMO_V2]'
export const GUIDED_DEMO_TITLE = 'Cogdoc Guided Demo — Researcher agency'
export const GUIDED_DEMO_TOPIC = 'How can a research writing assistant help students use AI without surrendering their reasoning?'

export const GUIDED_DEMO_QUESTIONS = [
  { wording: 'What does researcher control mean in an AI-assisted writing workspace?', rationale: 'Define the central idea before judging a design.' },
  { wording: 'What risks arise when fluent AI output is treated as evidence?', rationale: 'Identify the problem that source inspection should address.' },
  { wording: 'How could a study evaluate whether provenance-first tools improve source checking?', rationale: 'Turn the argument into a testable evaluation question.' },
]

export const GUIDED_DEMO_SOURCES = [
  { title: 'Guidance for generative AI in education and research', url: 'https://unesdoc.unesco.org/ark:/48223/pf0000386693', doi: null, authors: ['UNESCO'], year: '2023', venue: 'UNESCO' },
  { title: 'ChatGPT for good? On opportunities and challenges of large language models for education', url: 'https://doi.org/10.1016/j.lindif.2023.102274', doi: '10.1016/j.lindif.2023.102274', authors: ['Enkelejda Kasneci', 'Kathrin Sessler', 'Stefan Küchemann', 'Maria Bannert'], year: '2023', venue: 'Learning and Individual Differences' },
  { title: 'On the dangers of stochastic parrots: Can language models be too big?', url: 'https://doi.org/10.1145/3442188.3445922', doi: '10.1145/3442188.3445922', authors: ['Emily M. Bender', 'Timnit Gebru', 'Angelina McMillan-Major', 'Shmargaret Shmitchell'], year: '2021', venue: 'FAccT 2021' },
]

const starterDocument = JSON.stringify({
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Researcher agency in AI-assisted writing' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'DEMONSTRATION MATERIAL — edit or replace this starter text during the presentation. It is not a reviewed finding or an AI-verified conclusion.' }] },
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Working question' }] },
    { type: 'paragraph', content: [{ type: 'text', text: GUIDED_DEMO_QUESTIONS[0].wording }] },
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Starting explanation' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'My starting position is that a useful research assistant should make sources easier to inspect while leaving interpretation and final wording with the researcher. I still need to define “control,” inspect the suggested sources, and look for limitations or counterexamples.' }] },
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Notes to investigate' }] },
    { type: 'bulletList', content: GUIDED_DEMO_QUESTIONS.slice(1).map((question) => ({ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: question.wording }] }] })) },
  ],
})

type GuidedDemoApi = Pick<typeof api, 'createWorkspace' | 'getWorkspace' | 'getInvestigation' | 'saveInvestigation' | 'createResearchQuestion' | 'updateResearchQuestion' | 'saveDocument' | 'saveWorkspaceSource'>

export function isGuidedDemo(project: Pick<Project, 'description'>) {
  return Boolean(project.description?.includes(GUIDED_DEMO_MARKER))
}

export async function createOrResumeGuidedDemo(input: { workspaces: Project[]; apiClient?: GuidedDemoApi; forceNew?: boolean }) {
  const apiClient = input.apiClient ?? api
  const existing = input.forceNew ? undefined : input.workspaces.find(isGuidedDemo)
  let workspace = existing ? (await apiClient.getWorkspace(existing.id)).workspace : (await apiClient.createWorkspace({
    title: GUIDED_DEMO_TITLE,
    description: `${GUIDED_DEMO_MARKER} Optional prefilled demonstration. Starter explanations are demonstration material, not reviewed findings.`,
    briefText: 'Demonstrate a document-first research process: frame a question, inspect source leads, write an explanation, review a finding, and optionally compose an article.',
    workspaceType: 'research', reviewPace: 'deep', citationStyle: 'harvard',
  })).workspace

  let investigation: { context: { selectedQuestionId: string | null } | null; questions: ResearchQuestionSummary[] }
  try { investigation = await apiClient.getInvestigation(workspace.id) }
  catch {
    const created = await apiClient.saveInvestigation(workspace.id, {
      topic: GUIDED_DEMO_TOPIC,
      purpose: 'Structure a short demonstration of evidence-aware AI assistance without claiming that the product proves learning outcomes.',
      existingUnderstanding: 'Starting hypothesis: provenance and explicit review may help, but the sources and limitations still need to be inspected.',
    })
    investigation = { context: { selectedQuestionId: created.context.selectedQuestionId }, questions: [] }
  }

  const questions = [...investigation.questions]
  for (const fixture of GUIDED_DEMO_QUESTIONS) {
    if (questions.some((question) => question.wording === fixture.wording)) continue
    const created = await apiClient.createResearchQuestion(workspace.id, fixture)
    questions.push(created.question)
  }
  if (!investigation.context?.selectedQuestionId && questions[0]) {
    await apiClient.updateResearchQuestion(workspace.id, { action: 'select', questionId: questions[0].id })
  }

  if (!workspace.document?.content?.trim()) {
    await apiClient.saveDocument(workspace.id, starterDocument, workspace.document?.revision ?? 0)
  }

  await Promise.allSettled(GUIDED_DEMO_SOURCES.map((source) => apiClient.saveWorkspaceSource(workspace.id, {
    title: source.title, url: source.url, doi: source.doi,
    metadata: {
      authors: source.authors, year: source.year, venue: source.venue,
      fixture: 'guided_demo_v2', accessState: 'metadata_only', inspectedContent: false,
      notice: 'Verified publication identity supplied for demonstration. Open the original work before treating it as evidence.',
    },
  })))

  workspace = (await apiClient.getWorkspace(workspace.id)).workspace
  return { workspace, resumed: Boolean(existing) }
}
