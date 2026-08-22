import JSZip from 'jszip'
import { sha256 } from '@/lib/crypto'

export const CODE_ARCHIVE_LIMITS = {
  compressedBytes: 50 * 1024 * 1024,
  extractedBytes: 200 * 1024 * 1024,
  fileCount: 20_000,
  indexedFileBytes: 2 * 1024 * 1024,
} as const

export interface IndexedCodeFile {
  path: string
  language: string | null
  content: string
  contentHash: string
  lineCount: number
  sizeBytes: number
}

const IGNORED_SEGMENTS = new Set([
  'node_modules', 'vendor', '.git', '.next', 'dist', 'build', 'coverage',
  '__pycache__', '.venv', 'venv', 'target', '.idea', '.vscode',
])
const SECRET_NAMES = /(^|\/)(\.env(?:\..*)?|id_rsa|id_ed25519|credentials(?:\.json)?|service-account.*\.json|.*\.(?:pem|p12|pfx|key))$/i
const NESTED_ARCHIVE = /\.(?:zip|rar|7z|tar|gz|bz2|xz|jar|war|docm|xlsm|pptm)$/i
const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  ts: 'TypeScript', tsx: 'TypeScript React', js: 'JavaScript', jsx: 'JavaScript React',
  py: 'Python', java: 'Java', kt: 'Kotlin', cs: 'C#', cpp: 'C++', c: 'C', h: 'C/C++ header',
  go: 'Go', rs: 'Rust', php: 'PHP', rb: 'Ruby', swift: 'Swift', sql: 'SQL',
  html: 'HTML', css: 'CSS', scss: 'SCSS', vue: 'Vue', svelte: 'Svelte',
  json: 'JSON', yaml: 'YAML', yml: 'YAML', xml: 'XML', md: 'Markdown', sh: 'Shell',
}

function shouldIgnore(path: string): boolean {
  return path.split('/').some((segment) => IGNORED_SEGMENTS.has(segment))
}

function isSymlink(unixPermissions: number | string | null | undefined): boolean {
  if (typeof unixPermissions !== 'number') return false
  return (unixPermissions & 0o170000) === 0o120000
}

function languageFor(path: string): string | null {
  const extension = path.split('.').at(-1)?.toLowerCase() ?? ''
  return LANGUAGE_BY_EXTENSION[extension] ?? null
}

export async function inspectCodeArchive(buffer: Buffer): Promise<{
  files: IndexedCodeFile[]
  warnings: string[]
  extractedBytes: number
  totalFileCount: number
  snapshotHash: string
}> {
  if (buffer.byteLength > CODE_ARCHIVE_LIMITS.compressedBytes) {
    throw new Error('Code archive exceeds the 50 MB compressed limit')
  }
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(buffer, { checkCRC32: true, createFolders: false })
  } catch {
    throw new Error('Archive is invalid, corrupted, or encrypted')
  }

  const entries = Object.values(zip.files).filter((entry) => !entry.dir)
  if (entries.length > CODE_ARCHIVE_LIMITS.fileCount) {
    throw new Error('Code archive exceeds the 20,000 file limit')
  }

  const warnings: string[] = []
  const files: IndexedCodeFile[] = []
  let extractedBytes = 0
  for (const entry of entries) {
    const unsafeName = (entry as typeof entry & { unsafeOriginalName?: string }).unsafeOriginalName
    const normalized = entry.name.replace(/\\/g, '/')
    if (unsafeName?.includes('..') || normalized.startsWith('/') || normalized.split('/').includes('..')) {
      throw new Error('Archive contains an unsafe path')
    }
    if (isSymlink(entry.unixPermissions)) throw new Error('Archive contains a symbolic link')
    if (NESTED_ARCHIVE.test(normalized)) throw new Error(`Nested archives and macro files are not accepted: ${normalized}`)
    if (shouldIgnore(normalized)) continue
    if (SECRET_NAMES.test(normalized)) {
      warnings.push(`Excluded likely secret file: ${normalized}`)
      continue
    }

    // JSZip exposes the central-directory size internally. Check it before
    // allocating the decompressed entry so one oversized file cannot exhaust
    // memory before the cumulative limit runs.
    const declaredSize = Number((entry as typeof entry & { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0)
    if (declaredSize > CODE_ARCHIVE_LIMITS.extractedBytes || extractedBytes + declaredSize > CODE_ARCHIVE_LIMITS.extractedBytes) {
      throw new Error('Code archive exceeds the 200 MB extracted limit')
    }

    const bytes = await entry.async('nodebuffer')
    extractedBytes += bytes.byteLength
    if (extractedBytes > CODE_ARCHIVE_LIMITS.extractedBytes) {
      throw new Error('Code archive exceeds the 200 MB extracted limit')
    }
    if (bytes.byteLength > CODE_ARCHIVE_LIMITS.indexedFileBytes) {
      warnings.push(`Skipped oversized source file: ${normalized}`)
      continue
    }
    if (bytes.includes(0)) {
      warnings.push(`Skipped binary file: ${normalized}`)
      continue
    }
    let content: string
    try {
      content = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    } catch {
      warnings.push(`Skipped unsupported binary file: ${normalized}`)
      continue
    }
    files.push({
      path: normalized,
      language: languageFor(normalized),
      content,
      contentHash: sha256(bytes),
      lineCount: content ? content.split('\n').length : 0,
      sizeBytes: bytes.byteLength,
    })
  }

  const snapshotHash = sha256(files
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((file) => `${file.path}\0${file.contentHash}`)
    .join('\n'))
  return { files, warnings, extractedBytes, totalFileCount: entries.length, snapshotHash }
}
