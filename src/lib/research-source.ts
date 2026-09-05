import { createHash } from 'node:crypto'

export function normalizeDoi(value: unknown): string | null {
  if (typeof value !== 'string') return null
  return value.trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '').toLowerCase().slice(0, 500) || null
}

export function canonicalizeSourceUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  try {
    const url = new URL(value.trim())
    if (!['http:', 'https:'].includes(url.protocol)) return null
    url.hash = ''
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid)/i.test(key)) url.searchParams.delete(key)
    }
    url.hostname = url.hostname.toLowerCase()
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/$/, '')
    return url.toString().replace(/\/$/, '')
  } catch {
    return null
  }
}

export const contentDigest = (data: Buffer | string) => createHash('sha256').update(data).digest('hex')

export function assessSourceQuality(input: { doi?: string | null; canonicalUrl?: string | null; fullText?: boolean; metadata?: Record<string, unknown> }) {
  let score = 0.2
  const reasons: string[] = []
  if (input.doi) { score += 0.25; reasons.push('DOI metadata is available') }
  if (input.canonicalUrl) { score += 0.1; reasons.push('Canonical source URL is available') }
  if (input.fullText) { score += 0.25; reasons.push('Full text is indexed') }
  if (input.metadata?.authors) { score += 0.1; reasons.push('Authorship metadata is present') }
  if (input.metadata?.year) { score += 0.1; reasons.push('Publication date is present') }
  return { score: Math.min(1, score), explanation: reasons.length ? reasons.join('. ') + '.' : 'Limited metadata; verify this source manually.' }
}
