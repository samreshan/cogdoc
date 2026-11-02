import { completeGuideAction } from '@/lib/live-research-guide'
import type {
  CollaboratorIntent,
  CollaboratorTurn,
  DocumentCollaboratorContext,
} from '@/lib/document-collaborator-contract'

export interface PublicAssistantConfiguration {
  provider: 'gemini' | 'ollama' | 'groq' | 'custom'
  model: string
  configured: boolean
  local: boolean
  status: string
  message: string
}

export class DocumentCollaboratorError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) { super(message) }
}

async function json<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({})) as Record<string, unknown>
  if (!response.ok) throw new DocumentCollaboratorError(String(data.error ?? `Request failed (${response.status})`), response.status, typeof data.code === 'string' ? data.code : undefined)
  return data as T
}

export async function loadDocumentCollaborator(projectId: string): Promise<{ turns: CollaboratorTurn[]; assistant: PublicAssistantConfiguration }> {
  return json(await fetch(`/api/workspaces/${encodeURIComponent(projectId)}/collaborator`, { cache: 'no-store' }))
}

export async function sendDocumentCollaboratorMessage(projectId: string, input: {
  message: string
  intent: CollaboratorIntent
  context: DocumentCollaboratorContext
  requestId: string
  answerToEnginePromptId?: string
}): Promise<{ researcherTurn: CollaboratorTurn; assistantTurn: CollaboratorTurn; assistant: PublicAssistantConfiguration }> {
  const result = await json<{ researcherTurn: CollaboratorTurn; assistantTurn: CollaboratorTurn; assistant: PublicAssistantConfiguration }>(await fetch(`/api/workspaces/${encodeURIComponent(projectId)}/collaborator`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  }))
  completeGuideAction(projectId, 'collaborate')
  return result
}
