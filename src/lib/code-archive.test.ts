import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { inspectCodeArchive } from '@/lib/code-archive'

async function archive(files: Record<string, string>) {
  const zip = new JSZip()
  for (const [path, content] of Object.entries(files)) zip.file(path, content)
  return Buffer.from(await zip.generateAsync({ type: 'uint8array', platform: 'UNIX' }))
}

describe('static code snapshot inspection', () => {
  it('indexes source files, excludes dependencies and likely secrets, and hashes the snapshot', async () => {
    const result = await inspectCodeArchive(await archive({
      'src/index.ts': 'export const answer = 42\n',
      'node_modules/pkg/index.js': 'ignored',
      '.env': 'SECRET=value',
    }))
    expect(result.files).toEqual([expect.objectContaining({ path: 'src/index.ts', language: 'TypeScript', lineCount: 2 })])
    expect(result.warnings.join(' ')).toContain('secret')
    expect(result.snapshotHash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('rejects nested archives and macro-enabled documents', async () => {
    await expect(inspectCodeArchive(await archive({ 'nested.zip': 'not really a zip' }))).rejects.toThrow(/Nested archives/)
    await expect(inspectCodeArchive(await archive({ 'report.docm': 'macro' }))).rejects.toThrow(/macro files/)
  })

  it('produces the same snapshot hash independent of zip insertion order', async () => {
    const first = await inspectCodeArchive(await archive({ 'b.ts': 'b', 'a.ts': 'a' }))
    const second = await inspectCodeArchive(await archive({ 'a.ts': 'a', 'b.ts': 'b' }))
    expect(first.snapshotHash).toBe(second.snapshotHash)
  })
})
