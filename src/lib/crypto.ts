import {
  createHash,
  createPrivateKey,
  createPublicKey,
  randomBytes,
  sign,
  verify,
} from 'node:crypto'

export function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex')
}

export function randomToken(): string {
  return randomBytes(32).toString('base64url')
}

function certificatePrivateKey() {
  const configured = process.env.COGDOC_CERTIFICATE_PRIVATE_KEY
  if (!configured) return null
  const pem = configured.includes('BEGIN PRIVATE KEY')
    ? configured.replace(/\\n/g, '\n')
    : Buffer.from(configured, 'base64').toString('utf8')
  return createPrivateKey(pem)
}

export function certificateSigningAvailable(): boolean {
  try {
    return certificatePrivateKey() !== null
  } catch {
    return false
  }
}

export function signCertificatePayload(payload: string): {
  signature: string
  publicKey: string
  publicKeyId: string
} {
  const privateKey = certificatePrivateKey()
  if (!privateKey) {
    throw new Error('Certificate signing is not configured')
  }
  const publicKey = createPublicKey(privateKey)
  const publicPem = publicKey.export({ type: 'spki', format: 'pem' }).toString()
  return {
    signature: sign(null, Buffer.from(payload), privateKey).toString('base64url'),
    publicKey: publicPem,
    publicKeyId: sha256(publicPem).slice(0, 16),
  }
}

export function verifyCertificatePayload(payload: string, signature: string, publicKeyPem: string): boolean {
  try {
    return verify(null, Buffer.from(payload), createPublicKey(publicKeyPem), Buffer.from(signature, 'base64url'))
  } catch {
    return false
  }
}

