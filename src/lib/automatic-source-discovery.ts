import { api } from '@/lib/api-client'

type DiscoveryApi = Pick<typeof api, 'findSources' | 'researchFindingAction' | 'saveWorkspaceSource'>
export type SourceDiscoveryCandidate = Awaited<ReturnType<typeof api.findSources>>['sources'][number]

export type AutomaticDiscoveryStatus = 'saved' | 'empty' | 'partial' | 'unavailable' | 'skipped'

export interface AutomaticDiscoveryResult {
  status: AutomaticDiscoveryStatus
  saved: number
  message: string
  contextKey: string
}

const activeRequests = new Map<string, Promise<AutomaticDiscoveryResult>>()

export function sourceDiscoveryContextKey(projectId: string, query: string, questionId?: string) {
  return [projectId, questionId ?? 'topic', query.toLowerCase().trim().replace(/\s+/g, ' ')].join(':')
}

function sourceIdentity(source: { url: string; citation?: { doi: string | null } }) {
  return source.citation?.doi?.toLowerCase().replace(/^https?:\/\/doi\.org\//, '') || source.url.toLowerCase().replace(/\/$/, '')
}

function validSource(source: { title: string; url: string; recordProvider: string }) {
  if (!source.title.trim() || !['openalex', 'crossref', 'semantic_scholar', 'gemini'].includes(source.recordProvider)) return false
  try { return ['http:', 'https:'].includes(new URL(source.url).protocol) } catch { return false }
}

export async function discoverSourceCandidates(input: {
  projectId: string
  query: string
  questionId?: string
  purpose?: string | null
  uncertainty?: string | null
  apiClient?: Pick<DiscoveryApi, 'findSources'>
}) {
  const response = await (input.apiClient ?? api).findSources(input.query, input.projectId, input.questionId ? {
    questionId: input.questionId, purpose: input.purpose, uncertainty: input.uncertainty,
  } : undefined)
  return { ...response, sources: [...new Map(response.sources.filter(validSource).map((source) => [sourceIdentity(source), source])).values()] }
}

export async function automaticallyDiscoverSources(input: {
  projectId: string
  query: string
  questionId?: string
  purpose?: string | null
  uncertainty?: string | null
  apiClient?: DiscoveryApi
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null
  force?: boolean
}): Promise<AutomaticDiscoveryResult> {
  const query = input.query.trim()
  const contextKey = sourceDiscoveryContextKey(input.projectId, query, input.questionId)
  if (query.length < 10) return { status: 'skipped', saved: 0, contextKey, message: 'The confirmed topic is too short for a useful automatic search.' }
  const cacheKey = `cogdoc:auto-source-discovery:${contextKey}`
  const cached = Number(input.storage?.getItem(cacheKey))
  if (!input.force && cached > Date.now() - 5 * 60_000) return { status: 'skipped', saved: 0, contextKey, message: 'Cogdoc already searched this unchanged research context.' }
  const existing = activeRequests.get(contextKey)
  if (existing && !input.force) return existing

  const apiClient = input.apiClient ?? api
  const task = (async (): Promise<AutomaticDiscoveryResult> => {
    try {
      const response = await discoverSourceCandidates({
        projectId: input.projectId, query, questionId: input.questionId,
        purpose: input.purpose, uncertainty: input.uncertainty, apiClient,
      })
      if (response.error) return { status: 'unavailable', saved: 0, contextKey, message: response.detail ? `${response.error}: ${response.detail}` : response.error }
      const unique = response.sources.slice(0, 3)
      if (!unique.length) {
        // Empty searches remain retryable; never permanently cache an outage.
        return { status: 'empty', saved: 0, contextKey, message: response.message ?? 'No useful scholarly matches were found. Existing sources were kept.' }
      }
      const saves = await Promise.allSettled(unique.map((source) => input.questionId
        ? apiClient.researchFindingAction(input.projectId, {
          action: 'save_discovered_source', questionId: input.questionId, title: source.title, url: source.url,
          doi: source.citation?.doi, role: source.role ?? 'evidence_candidate', rationale: source.relevanceExplanation ?? source.snippet,
          rationaleBasis: source.rationaleBasis ?? 'metadata', recordProvider: source.recordProvider,
          accessState: source.accessState ?? 'metadata_only',
          metadata: { authors: source.citation?.authors ?? [], year: source.citation?.year ?? null, venue: source.citation?.venue ?? null, automaticSuggestion: true, inspectedContent: false },
        })
        : apiClient.saveWorkspaceSource(input.projectId, {
          title: source.title, url: source.url, doi: source.citation?.doi,
          metadata: {
            authors: source.citation?.authors ?? [], year: source.citation?.year ?? null, venue: source.citation?.venue ?? null,
            recordProvider: source.recordProvider, relevanceExplanation: source.relevanceExplanation ?? source.snippet,
            accessState: source.accessState ?? 'metadata_only', automaticSuggestion: true, inspectedContent: false,
          },
        })))
      const saved = saves.filter((result) => result.status === 'fulfilled').length
      const providersPartial = Object.values(response.providerStatus ?? {}).some((status) => status === 'unavailable')
      const partial = saved < unique.length || providersPartial
      if (saved) input.storage?.setItem(cacheKey, String(Date.now()))
      return {
        status: saved ? (partial ? 'partial' : 'saved') : 'unavailable', saved, contextKey,
        message: saved
          ? `${saved} source suggestion${saved === 1 ? '' : 's'} saved as metadata leads. Open the original before using any as evidence.${partial ? ' Some providers or saves were unavailable.' : ''}`
          : 'Source providers responded, but suggestions could not be saved. Existing sources were kept.',
      }
    } catch (error) {
      return { status: 'unavailable', saved: 0, contextKey, message: `${error instanceof Error ? error.message : 'Automatic source search was unavailable.'} Existing sources were kept; retry or add one manually.` }
    } finally {
      activeRequests.delete(contextKey)
    }
  })()
  activeRequests.set(contextKey, task)
  return task
}
