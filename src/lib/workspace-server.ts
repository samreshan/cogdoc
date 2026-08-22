import type { Prisma } from '@prisma/client'
import { canonicalDocumentString, documentToPlainText } from '@/lib/document-content'
import { sha256 } from '@/lib/crypto'

type Transaction = Prisma.TransactionClient

interface AuditDigestInput {
  projectId: string
  userId: string
  type: string
  actor: string
  payloadJson: string
  documentHash: string | null
  modelVersion: string | null
  promptVersion: string | null
  previousHash: string | null
  createdAt: Date
}

export function auditEventDigest(event: AuditDigestInput): string {
  return sha256(JSON.stringify({
    projectId: event.projectId, userId: event.userId, type: event.type, actor: event.actor,
    payloadJson: event.payloadJson, documentHash: event.documentHash, modelVersion: event.modelVersion,
    promptVersion: event.promptVersion, previousHash: event.previousHash, createdAt: event.createdAt.toISOString(),
  }))
}

export function verifyAuditChain(events: Array<AuditDigestInput & { eventHash: string | null }>): boolean {
  let previousHash: string | null = null
  for (const event of events) {
    // Pre-update legacy rows may not be chained. Once a hashed event appears,
    // every later event must continue the chain.
    if (!event.eventHash) {
      if (previousHash) return false
      continue
    }
    if (event.previousHash !== previousHash || auditEventDigest(event) !== event.eventHash) return false
    previousHash = event.eventHash
  }
  return true
}

export async function createDocumentVersion(
  tx: Transaction,
  projectId: string,
  content: string,
  reason: 'import' | 'scan' | 'resolution' | 'manual' | 'certification',
) {
  const canonical = canonicalDocumentString(content)
  const latest = await tx.documentVersion.findFirst({
    where: { projectId },
    orderBy: { sequence: 'desc' },
    select: { sequence: true, contentHash: true },
  })
  const contentHash = sha256(canonical)
  if (latest?.contentHash === contentHash && reason !== 'certification') {
    return tx.documentVersion.findFirstOrThrow({
      where: { projectId, contentHash },
      orderBy: { sequence: 'desc' },
    })
  }
  return tx.documentVersion.create({
    data: {
      projectId,
      sequence: (latest?.sequence ?? 0) + 1,
      content: canonical,
      plainText: documentToPlainText(content),
      contentHash,
      reason,
    },
  })
}

export async function appendAuditEvent(
  tx: Transaction,
  input: {
    projectId: string
    userId: string
    type: string
    actor?: 'student' | 'system'
    payload?: Record<string, unknown>
    documentHash?: string | null
    modelVersion?: string | null
    promptVersion?: string | null
  },
) {
  const previous = await tx.auditEvent.findFirst({
    where: { projectId: input.projectId },
    orderBy: { createdAt: 'desc' },
    select: { eventHash: true },
  })
  const createdAt = new Date()
  const payloadJson = JSON.stringify(input.payload ?? {})
  const eventHash = auditEventDigest({
    projectId: input.projectId,
    userId: input.userId,
    type: input.type,
    actor: input.actor ?? 'student',
    payloadJson,
    documentHash: input.documentHash ?? null,
    modelVersion: input.modelVersion ?? null,
    promptVersion: input.promptVersion ?? null,
    previousHash: previous?.eventHash ?? null,
    createdAt,
  })
  return tx.auditEvent.create({
    data: {
      projectId: input.projectId,
      userId: input.userId,
      type: input.type,
      actor: input.actor ?? 'student',
      payloadJson,
      documentHash: input.documentHash ?? null,
      modelVersion: input.modelVersion ?? null,
      promptVersion: input.promptVersion ?? null,
      previousHash: previous?.eventHash ?? null,
      eventHash,
      createdAt,
    },
  })
}

export function mutationIdempotencyKey(request: Request): string | null {
  const value = request.headers.get('idempotency-key')?.trim()
  return value && value.length <= 200 ? value : null
}
