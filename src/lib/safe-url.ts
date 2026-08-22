import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

export function isPrivateAddress(address: string): boolean {
  const normalized = address.toLowerCase().split('%')[0] ?? address.toLowerCase()
  if (normalized === '::1' || normalized === '::' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('ff') || normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) return true
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1]
  const ipv4 = mapped ?? (isIP(normalized) === 4 ? normalized : null)
  if (!ipv4) return false
  const [a, b] = ipv4.split('.').map(Number)
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
    || (a === 100 && b >= 64 && b <= 127) || a >= 224
}

async function assertPublicUrl(value: string): Promise<URL> {
  const url = new URL(value)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Only public HTTP(S) URLs are allowed')
  if (url.hostname === 'localhost' || url.hostname.endsWith('.localhost') || url.hostname.endsWith('.local')) throw new Error('Local network URLs are not allowed')
  if (isIP(url.hostname) && isPrivateAddress(url.hostname)) throw new Error('Private network URLs are not allowed')
  const addresses = await lookup(url.hostname, { all: true, verbatim: true })
  if (!addresses.length || addresses.some((entry) => isPrivateAddress(entry.address))) throw new Error('URL resolves to a private or unavailable address')
  return url
}

async function limitedText(response: Response, maxBytes: number): Promise<string> {
  const declared = Number(response.headers.get('content-length') ?? 0)
  if (declared > maxBytes) throw new Error('Source page exceeds the 5 MB retrieval limit')
  if (!response.body) return ''
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > maxBytes) { await reader.cancel(); throw new Error('Source page exceeds the 5 MB retrieval limit') }
    chunks.push(value)
  }
  const merged = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.byteLength }
  return new TextDecoder().decode(merged)
}

export async function fetchPublicHtml(value: string, maxRedirects = 3): Promise<{ url: URL; html: string }> {
  let url = await assertPublicUrl(value)
  for (let redirect = 0; redirect <= maxRedirects; redirect += 1) {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Cogdoc/1.0 (academic source retrieval)' },
      signal: AbortSignal.timeout(10_000), redirect: 'manual',
    })
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location')
      if (!location || redirect === maxRedirects) throw new Error('Source redirected too many times')
      url = await assertPublicUrl(new URL(location, url).toString())
      continue
    }
    if (!response.ok) throw new Error(`Source returned HTTP ${response.status}`)
    const contentType = response.headers.get('content-type') ?? ''
    if (contentType && !/text\/html|application\/xhtml\+xml|text\/plain/i.test(contentType)) throw new Error('Source did not return readable HTML or text')
    return { url, html: await limitedText(response, 5 * 1024 * 1024) }
  }
  throw new Error('Source retrieval failed')
}
