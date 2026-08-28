import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { putPrivateAsset, readPrivateAsset } from '@/lib/private-storage'

describe('private filesystem storage', () => {
  let storageRoot = ''

  beforeEach(async () => {
    storageRoot = await mkdtemp(path.join(tmpdir(), 'cogdoc-private-storage-'))
    vi.stubEnv('COGDOC_STORAGE_DIR', storageRoot)
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')
  })

  afterEach(async () => {
    vi.unstubAllEnvs()
    if (storageRoot) await rm(storageRoot, { recursive: true, force: true })
  })

  it('writes and reads a private asset from a deployment-specific directory', async () => {
    const content = Buffer.from('private research material')
    const stored = await putPrivateAsset('project-1', '../Research notes (final).pdf', content, 'application/pdf')

    expect(stored.provider).toBe('filesystem')
    expect(stored.key).toMatch(/^project-1\/[a-f0-9-]+-Research-notes--final-\.pdf$/)
    await expect(readPrivateAsset(stored.provider, stored.key, 'project-1')).resolves.toEqual(content)
  })

  it('rejects traversal and malformed storage keys before reading', async () => {
    await expect(readPrivateAsset('filesystem', 'project-1/../../.env', 'project-1')).rejects.toThrow('Invalid storage key')
    await expect(readPrivateAsset('filesystem', '/absolute/path', 'project-1')).rejects.toThrow('Invalid storage key')
  })

  it('rejects a valid key from a different workspace before reading', async () => {
    await expect(readPrivateAsset(
      'filesystem',
      'project-2/certificate.pdf',
      'project-1',
    )).rejects.toThrow('Storage key does not belong to the requested workspace')
  })
})
