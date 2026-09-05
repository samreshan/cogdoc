import { db } from '@/lib/db'

export const AUTOMATIC_RESEARCH_JOBS = ['parse', 'deduplicate', 'quality', 'index', 'backlink', 'reprioritize'] as const
export type AutomaticResearchJob = typeof AUTOMATIC_RESEARCH_JOBS[number]

export async function enqueueResearchJob(input: {
  projectId: string
  kind: string
  payload?: Record<string, unknown>
  idempotencyKey?: string
}) {
  const idempotencyKey = input.idempotencyKey ?? `${input.kind}:${crypto.randomUUID()}`
  return db.researchJob.upsert({
    where: { projectId_idempotencyKey: { projectId: input.projectId, idempotencyKey } },
    update: {},
    create: {
      projectId: input.projectId,
      kind: input.kind,
      payloadJson: JSON.stringify(input.payload ?? {}),
      idempotencyKey,
    },
  })
}

export async function enqueueClericalResearchJobs(projectId: string, trigger: 'source_import' | 'document_save', entityId: string) {
  const kinds: AutomaticResearchJob[] = trigger === 'source_import'
    ? ['parse', 'deduplicate', 'quality', 'index', 'backlink', 'reprioritize']
    : ['backlink', 'reprioritize']
  return Promise.all(kinds.map((kind) => enqueueResearchJob({
    projectId,
    kind,
    payload: { trigger, entityId },
    idempotencyKey: `${trigger}:${entityId}:${kind}`,
  })))
}
