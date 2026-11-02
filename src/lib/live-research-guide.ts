/** The guide observes real work. It never replays snapshots or invents tool results. */
export const LIVE_GUIDE_MARKER = '[COGDOC_LIVE_GUIDE_V1]'
export const LIVE_GUIDE_EVENT = 'cogdoc:live-guide-progress'
export const LIVE_GUIDE_STEPS = [
  { id: 'write', target: 'document-surface', title: 'Write your starting explanation', body: 'In the document, explain what you think happens between a Java application and a running Kubernetes Pod. A few sentences are enough. Your real document saves automatically; you can revise it whenever your understanding changes.' },
  { id: 'question', target: 'nav-plan', title: 'Choose a research question', body: 'Plan opens your research questions. Add or select a question such as “What does a Deployment do?” This focuses source discovery and the collaborator. Your own question is equally welcome.' },
  { id: 'source', target: 'nav-sources', title: 'Find real source leads', body: 'Cogdoc searches when you confirm your topic. Sources shows the actual saved leads. Open a relevant record, or add an official Java or Kubernetes documentation URL. A saved source is only a lead; it does not prove a claim. Empty results and service errors remain visible so you can retry or add your own source.' },
  { id: 'evidence', target: 'nav-sources', title: 'Inspect and choose evidence', body: 'Open a source and choose an available passage. If Cogdoc only has metadata, read the original and add a short excerpt with its location in Findings. No sample passage is substituted for real evidence.' },
  { id: 'collaborate', target: 'nav-collaborator', title: 'Ask your research collaborator', body: 'Select text in your document, then open Collaborator and ask a question in your own words. For example: “How does a Service differ from a Deployment?” Responses use your configured AI and selected context; check their reasoning against your sources.' },
  { id: 'interceptor', target: 'nav-collaborator', title: 'Clarify your own reasoning', body: 'Select a passage, expand “Run an intervention engine” in Collaborator, and choose Clarify ownership (Interceptor). Read its real response and explain the idea in your own words. The guide records a successful tool response, not whether your understanding is correct.' },
  { id: 'socratic', target: 'nav-collaborator', title: 'Examine an assumption', body: 'Expand “Run an intervention engine” and choose Probe reasoning (Socratic Spacer) on your selected text. Consider its question about an assumption or alternative, then answer in the chat or revise your document. You can use these tools in any order.' },
  { id: 'citation', target: 'nav-collaborator', title: 'Check support for a claim', body: 'Expand “Run an intervention engine” and choose Check evidence (Citation Sentinel) with a selected claim and relevant sources. It checks available project evidence; it may find insufficient support. That is a useful result, not a reason to invent a citation.' },
  { id: 'scaffold', target: 'nav-collaborator', title: 'Organize an explanation', body: 'Expand “Run an intervention engine” and choose Structure argument (Scaffold) to help organize claim, evidence, limitations, and implications. Keep your own interpretation. These four tools remain available after this guide ends.' },
  { id: 'finding', target: 'nav-findings', title: 'Save a finding you can explain', body: 'In Findings, connect your question, evidence, and explanation. Save a conclusion with limitations and unresolved questions. This creates a real finding, without automatically accepting it as reviewed.' },
  { id: 'review', target: 'nav-findings', title: 'Review the current finding', body: 'Inspect the actual finding and evidence. Resolve any pending reasoning questions, then explicitly review its current revision. Record uncertainty honestly; generating text never counts as your review.' },
  { id: 'article', target: 'nav-share', title: 'Compose from reviewed findings', body: 'Share lets you select reviewed findings and make an outline or request an AI draft. This creates an editable article. Check its source links and uncertainty before sharing it.' },
  { id: 'export', target: 'live-export', title: 'Export your actual work', body: 'Use Export working document at the top, or Export Markdown in Share. The downloaded file contains your real saved content. Save your latest edits first. Finishing the guide keeps this project available in Recent documents.' },
] as const
export type LiveGuideAction = typeof LIVE_GUIDE_STEPS[number]['id']
export function isLiveGuidedProject(project: { description?: string | null } | null | undefined) { return Boolean(project?.description?.includes(LIVE_GUIDE_MARKER)) }
const key = (id: string) => `cogdoc:live-guide:v1:${id}`
export function readGuideProgress(id: string): LiveGuideAction[] {
  if (typeof window === 'undefined') return []
  try { const value = JSON.parse(localStorage.getItem(key(id)) ?? '[]'); return Array.isArray(value) ? value.filter((item) => LIVE_GUIDE_STEPS.some((step) => step.id === item)) : [] } catch { return [] }
}
export function registerLiveGuide(id: string) {
  try { if (!localStorage.getItem(key(id))) localStorage.setItem(key(id), '[]') } catch { /* tools still work without browser storage */ }
}
export function completeGuideAction(id: string, action: LiveGuideAction) {
  if (typeof window === 'undefined') return
  try {
    // Ignore unrelated projects, even when another guide is open.
    if (localStorage.getItem(key(id)) === null) return
    const completed = readGuideProgress(id)
    if (!completed.includes(action)) completed.push(action)
    localStorage.setItem(key(id), JSON.stringify(completed))
    window.dispatchEvent(new CustomEvent(LIVE_GUIDE_EVENT, { detail: { projectId: id, completed } }))
  } catch { /* progress must never break a successful tool operation */ }
}
export function nextGuideStep(completed: readonly string[]) { return LIVE_GUIDE_STEPS.find((step) => !completed.includes(step.id)) }

/** Called only after a successful, parsed API response. GETs and failures do not count. */
export function observeGuideSuccess(url: string, init: RequestInit | undefined, data: unknown) {
  if (!init?.method || init.method === 'GET') return
  let input: Record<string, unknown> = {}
  try { input = typeof init.body === 'string' ? JSON.parse(init.body) : {} } catch { return }
  const match = url.match(/^\/api\/workspaces\/([^/]+)\/(.+)$/)
  const id = match ? decodeURIComponent(match[1]) : typeof input.projectId === 'string' ? input.projectId : ''
  if (!id) return
  const path = match?.[2]
  const result = (data ?? {}) as Record<string, unknown>
  if (path === 'document' && result.ok === true && typeof input.content === 'string' && /\"text\"\s*:\s*\"[^\"]+/.test(input.content)) completeGuideAction(id, 'write')
  if (path === 'investigation' && input.selectedQuestionId && result.context) completeGuideAction(id, 'question')
  if (path === 'questions' && (result.question || result.context)) completeGuideAction(id, 'question')
  if (path === 'sources' && result.workspaceSource) completeGuideAction(id, 'source')
  if (path === 'findings') {
    if (input.action === 'save_discovered_source' || input.action === 'attach_source') completeGuideAction(id, 'source')
    if (input.action === 'add_manual_excerpt') completeGuideAction(id, 'evidence')
    if (input.action === 'save_finding') completeGuideAction(id, 'finding')
  }
  if (path?.endsWith('/review') && (input.decision === 'accept' || input.decision === 'retain_uncertainty')) completeGuideAction(id, 'review')
  if (url === '/api/interceptor') completeGuideAction(id, 'interceptor')
  if (url === '/api/socratic-spacer') completeGuideAction(id, 'socratic')
  if (url === '/api/citation-sentinel') completeGuideAction(id, 'citation')
  if (url === '/api/scaffold') completeGuideAction(id, 'scaffold')
}

export async function downloadGuideArtifact(projectId: string, url: string, filename: string) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`The server could not export this document (${response.status}). Save your edits and retry.`)
  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
  completeGuideAction(projectId, 'export')
}
