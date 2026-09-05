import type { Project } from '@/lib/types'

export * from '@/lib/document-collaborator-contract'

/** The only boundary Home needs in order to open the real document workspace. */
export type OpenWorkspaceHandler = (project: Project) => void
