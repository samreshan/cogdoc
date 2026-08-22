import { generateKeyPairSync } from 'node:crypto'
import { afterEach, describe, expect, it } from 'vitest'
import { certificateSigningAvailable, randomToken, sha256, signCertificatePayload, verifyCertificatePayload } from '@/lib/crypto'

const originalKey = process.env.COGDOC_CERTIFICATE_PRIVATE_KEY
afterEach(() => {
  if (originalKey === undefined) delete process.env.COGDOC_CERTIFICATE_PRIVATE_KEY
  else process.env.COGDOC_CERTIFICATE_PRIVATE_KEY = originalKey
})

describe('certificate cryptography', () => {
  it('signs an exact payload and rejects single-byte tampering', () => {
    const { privateKey } = generateKeyPairSync('ed25519')
    process.env.COGDOC_CERTIFICATE_PRIVATE_KEY = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
    expect(certificateSigningAvailable()).toBe(true)
    const signed = signCertificatePayload('{"snapshot":"abc"}')
    expect(verifyCertificatePayload('{"snapshot":"abc"}', signed.signature, signed.publicKey)).toBe(true)
    expect(verifyCertificatePayload('{"snapshot":"abd"}', signed.signature, signed.publicKey)).toBe(false)
  })

  it('creates 256-bit share tokens and stable hashes', () => {
    expect(Buffer.from(randomToken(), 'base64url')).toHaveLength(32)
    expect(sha256('cogdoc')).toMatch(/^[a-f0-9]{64}$/)
    expect(sha256('cogdoc')).toBe(sha256('cogdoc'))
  })
})
