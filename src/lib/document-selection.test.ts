import { describe, expect, it } from 'vitest'
import { fingerprintDocumentText } from '@/lib/document-selection'

describe('document selection fingerprint', () => {
  it('uses the SHA-256 contract required by the collaborator route', async () => {
    await expect(fingerprintDocumentText('abc')).resolves.toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
})
