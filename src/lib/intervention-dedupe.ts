import type { EngineType, Intervention } from '@/lib/types'

const ENGINE_PRIORITY: Record<EngineType, number> = {
  citation: 4,
  interceptor: 3,
  scaffold: 2,
  socratic: 1,
}

/** Stable identity for the exact document phrase carrying an intervention. */
export function canonicalInterventionPhrase(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFKC')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase()
}

function preferredIntervention(current: Intervention, candidate: Intervention): Intervention {
  const priorityDifference = ENGINE_PRIORITY[candidate.engineType] - ENGINE_PRIORITY[current.engineType]
  if (priorityDifference > 0) return candidate
  if (priorityDifference < 0) return current
  return candidate.createdAt.localeCompare(current.createdAt) >= 0 ? candidate : current
}

/**
 * Retain one active intervention for each exact anchored phrase. Resolved rows
 * remain available as audit history; unanchored legacy rows are not collapsed.
 */
export function dedupeInterventionsByPhrase(interventions: Intervention[]): Intervention[] {
  const preferred = new Map<string, Intervention>()
  for (const intervention of interventions) {
    if (intervention.status !== 'active') continue
    const key = canonicalInterventionPhrase(intervention.promptText)
    if (!key) continue
    const current = preferred.get(key)
    preferred.set(key, current ? preferredIntervention(current, intervention) : intervention)
  }

  return interventions.filter((intervention) => {
    if (intervention.status !== 'active') return true
    const key = canonicalInterventionPhrase(intervention.promptText)
    return !key || preferred.get(key)?.id === intervention.id
  })
}
