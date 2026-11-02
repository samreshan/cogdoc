import type { Project, ResearchContextSummary, ResearchQuestionSummary } from '@/lib/types'

export const INTERACTIVE_DEMO_MARKER = '[COGDOC_INTERACTIVE_DEMO_V4]'
export const INTERACTIVE_DEMO_VERSION = 4
export const INTERACTIVE_DEMO_PROJECT_ID = 'cogdoc-interactive-demo-v4'
export const INTERACTIVE_DEMO_SESSION_KEY = 'cogdoc:interactive-demo:active'
export const INTERACTIVE_DEMO_TOPIC_KEY = 'cogdoc:interactive-demo:topic'
export const INTERACTIVE_DEMO_GOAL_KEY = 'cogdoc:interactive-demo:goal'
export const INTERACTIVE_DEMO_TOUR_KEY = `cogdoc:interactive-demo:${INTERACTIVE_DEMO_VERSION}:${INTERACTIVE_DEMO_PROJECT_ID}`
export const INTERACTIVE_DEMO_EDITOR_START_STEP = 5

export const INTERACTIVE_DEMO_TOPIC = 'How can a simple Java application run on Kubernetes?'
export const INTERACTIVE_DEMO_GOAL = 'Explain the smallest path from Java source code to a container image, a Kubernetes Deployment, and a Service, including what Kubernetes adds and what it does not guarantee.'

export const INTERACTIVE_DEMO_QUESTIONS: ResearchQuestionSummary[] = [
  {
    id: 'demo-question-java', projectId: INTERACTIVE_DEMO_PROJECT_ID, contextId: 'demo-context', parentId: null,
    wording: 'What does the Java application need before it can run in a container?',
    rationale: 'Start with the application and its runnable artifact before adding orchestration.', state: 'open', sortOrder: 0, revision: 1,
    createdAt: '2026-09-06T00:00:00.000Z', updatedAt: '2026-09-06T00:00:00.000Z',
  },
  {
    id: 'demo-question-kubernetes', projectId: INTERACTIVE_DEMO_PROJECT_ID, contextId: 'demo-context', parentId: null,
    wording: 'How do a Kubernetes Deployment and Service run and expose the container?',
    rationale: 'Separate workload management from network access.', state: 'open', sortOrder: 1, revision: 1,
    createdAt: '2026-09-06T00:00:00.000Z', updatedAt: '2026-09-06T00:00:00.000Z',
  },
  {
    id: 'demo-question-limits', projectId: INTERACTIVE_DEMO_PROJECT_ID, contextId: 'demo-context', parentId: null,
    wording: 'What does Kubernetes help with, and what operational work still remains?',
    rationale: 'Keep the explanation useful without claiming automatic reliability.', state: 'open', sortOrder: 2, revision: 1,
    createdAt: '2026-09-06T00:00:00.000Z', updatedAt: '2026-09-06T00:00:00.000Z',
  },
]

export const INTERACTIVE_DEMO_CONTEXT: ResearchContextSummary = {
  id: 'demo-context', projectId: INTERACTIVE_DEMO_PROJECT_ID, topic: INTERACTIVE_DEMO_TOPIC,
  purpose: INTERACTIVE_DEMO_GOAL,
  existingUnderstanding: 'The Java program must be runnable and packaged in a container before Kubernetes can manage it. Deployment and Service have different jobs.',
  scope: 'A small stateless Java web application, using official Java and Kubernetes documentation plus clearly labelled demonstration paraphrases.',
  selectedQuestionId: INTERACTIVE_DEMO_QUESTIONS[0].id, lifecycleState: 'exploring', revision: 1,
  createdAt: '2026-09-06T00:00:00.000Z', updatedAt: '2026-09-06T00:00:00.000Z',
}

export const INTERACTIVE_DEMO_SOURCES = [
  {
    id: 'demo-source-java', title: 'Getting Started with Java',
    url: 'https://dev.java/learn/getting-started/', doi: null, author: 'Dev.java', year: 'Updated 2024',
    access: 'Official tutorial', rationale: 'Official Java learning material covering the basic compile-and-run path for a small application.',
  },
  {
    id: 'demo-source-deployment', title: 'Deployments',
    url: 'https://kubernetes.io/docs/concepts/workloads/controllers/deployment/', doi: null, author: 'Kubernetes Documentation', year: 'Current documentation',
    access: 'Official documentation', rationale: 'Explains how a Deployment declares and manages the desired state for application Pods.',
  },
  {
    id: 'demo-source-service', title: 'Service',
    url: 'https://kubernetes.io/docs/concepts/services-networking/service/', doi: null, author: 'Kubernetes Documentation', year: 'Current documentation',
    access: 'Official documentation', rationale: 'Explains how a Service exposes one or more Pods behind a stable network endpoint.',
  },
] as const

export const DEMO_SAMPLE_PASSAGE = 'Demonstration paraphrase based on the official Kubernetes documentation: a Deployment describes the desired state for application Pods and manages updates toward that state. A separate Service can give changing Pods a stable network endpoint.'
export const DEMO_ORIGINAL_CLAIM = 'Putting a Java application on Kubernetes makes it reliable and easy to scale.'
export const DEMO_REVISED_CLAIM = 'A containerized Java application can run through a Kubernetes Deployment, while a Service provides a stable network endpoint; reliability still depends on health checks, resource settings, image quality, and cluster operations.'

function doc(paragraphs: string[]) {
  return JSON.stringify({
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Running a simple Java application on Kubernetes' }] },
      ...paragraphs.map((text) => ({ type: 'paragraph', content: [{ type: 'text', text }] })),
    ],
  })
}

export const INTERACTIVE_DEMO_DOCUMENTS = {
  opening: doc(['SIMULATED DEMO. This sample session is isolated from your research and does not use live AI or source providers.']),
  draft: doc([
    'SIMULATED DEMO. This sample session is isolated from your research and does not use live AI or source providers.',
    DEMO_ORIGINAL_CLAIM,
    'That starting claim is too broad. I need to separate what the Java application, container image, Deployment, and Service each contribute.',
  ]),
  cited: doc([
    'SIMULATED DEMO. This sample session is isolated from your research and does not use live AI or source providers.',
    DEMO_ORIGINAL_CLAIM,
    'The official Kubernetes documentation explains that a Deployment manages application Pods toward a declared state, while a Service provides a stable endpoint for changing Pods (Kubernetes Documentation, demonstration paraphrase).',
    'That still does not prove the sample application is reliable. Health checks, resources, secure images, and cluster operations remain separate work.',
  ]),
  revised: doc([
    'SIMULATED DEMO. This sample session is isolated from your research and does not use live AI or source providers.',
    DEMO_REVISED_CLAIM,
    'The official Kubernetes documentation explains that a Deployment manages application Pods toward a declared state, while a Service provides a stable endpoint for changing Pods (Kubernetes Documentation, demonstration paraphrase).',
    'This remains a demonstration explanation. A real deployment would still require a tested image, health checks, resource settings, security review, and an actual cluster test.',
  ]),
}

export function interactiveDemoWritingFrame(wordCount: number) {
  const text = [
    DEMO_ORIGINAL_CLAIM,
    'That starting claim is too broad. I need to separate what the Java application, container image, Deployment, and Service each contribute.',
  ].join(' ')
  const partial = text.split(/\s+/).slice(0, Math.max(0, wordCount)).join(' ')
  return doc([
    'SIMULATED DEMO. This sample session is isolated from your research and does not use live AI or source providers.',
    partial,
  ].filter(Boolean))
}

export const INTERACTIVE_DEMO_WRITING_WORDS = 34

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

export function createInteractiveDemoProject(topic = INTERACTIVE_DEMO_TOPIC, goal = INTERACTIVE_DEMO_GOAL): Project {
  return {
    id: INTERACTIVE_DEMO_PROJECT_ID, title: topic,
    description: `${INTERACTIVE_DEMO_MARKER} Client-only simulated walkthrough. No live provider or database records.`,
    archived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    workspaceType: 'research', reviewPace: 'deep', citationStyle: 'harvard', lifecycleState: 'draft',
    briefText: goal,
    document: { id: 'demo-document', content: INTERACTIVE_DEMO_DOCUMENTS.opening, lastSaved: new Date().toISOString(), revision: 0, contentHash: 'interactive-demo' },
    pdfs: [], interventions: [], _count: { pdfs: 0, interventions: 0 },
  }
}

export function isInteractiveDemo(project: Pick<Project, 'id' | 'description'> | null | undefined) {
  return project?.id === INTERACTIVE_DEMO_PROJECT_ID || Boolean(project?.description?.includes(INTERACTIVE_DEMO_MARKER))
}

export function interactiveDemoMarkdown() {
  return `# Running a simple Java application on Kubernetes\n\n> Simulated Cogdoc demo output. This is a learning example, not a record of a live deployment.\n\n## Working question\n\n${INTERACTIVE_DEMO_TOPIC}\n\n## Sample explanation\n\n${DEMO_REVISED_CLAIM}\n\nThe smallest path is: compile a runnable Java application, package it in a container image, reference that image from a Deployment, and expose the resulting Pods with a Service when network access is needed.\n\n## Demonstration evidence boundary\n\n${DEMO_SAMPLE_PASSAGE}\n\nThis is a demonstration paraphrase linked to official documentation. It is not a quotation, a live cluster result, or a substitute for checking the original pages.\n\n## Limitation\n\nKubernetes manages declared workload and networking state, but it does not automatically make application code correct, secure, observable, or suitably resourced. The example experiment in this demo is illustrative and was not run.\n\n## Official documentation leads\n\n- Dev.java. Getting Started with Java. https://dev.java/learn/getting-started/\n- Kubernetes Documentation. Deployments. https://kubernetes.io/docs/concepts/workloads/controllers/deployment/\n- Kubernetes Documentation. Service. https://kubernetes.io/docs/concepts/services-networking/service/\n`
}

export function downloadInteractiveDemoMarkdown() {
  const blob = new Blob([interactiveDemoMarkdown()], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'cogdoc-simulated-java-kubernetes-demo.md'
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}
