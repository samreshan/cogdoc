import type { CollaboratorTurn } from './document-collaborator-contract'

/** Polling and send responses can contain the same persisted turn. */
export function mergeCollaboratorTurns(current: CollaboratorTurn[], incoming: CollaboratorTurn[]): CollaboratorTurn[] {
  const byId = new Map(current.map((turn) => [turn.id, turn]))
  for (const turn of incoming) byId.set(turn.id, turn)
  return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}
