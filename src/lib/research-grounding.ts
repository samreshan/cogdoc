export interface FindingInput { text: string; passageIds: string[] }

export function validateGroundedFindings(findings: FindingInput[], availablePassageIds: Iterable<string>) {
  const available = new Set(availablePassageIds)
  if (!findings.length) return { ok: false as const, error: 'At least one finding is required' }
  for (const [index, finding] of findings.entries()) {
    if (!finding.text.trim()) return { ok: false as const, error: `Finding ${index + 1} has no text` }
    if (!finding.passageIds.length) return { ok: false as const, error: `Finding ${index + 1} has no passage reference` }
    if (finding.passageIds.some((id) => !available.has(id))) return { ok: false as const, error: `Finding ${index + 1} references an unavailable passage` }
  }
  return { ok: true as const }
}
