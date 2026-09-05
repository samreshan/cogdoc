/**
 * Integration contract: adapt persisted workspace records into the exported
 * presentation types, keep mutations in the parent, and pass callbacks for
 * navigation, editing, source linking, finding review and article selection.
 * The components intentionally do not fetch data or infer review eligibility.
 */
export * from './types'
export * from './refined-workspace'
export * from './question-plan'
export * from './source-passage-reader'
export * from './reasoning-workspace'
export * from './findings'
