/**
 * Unit tests for the typed api-client (api-client.ts).
 *
 * The client is a thin wrapper around fetch; we stub global.fetch to assert
 * correct URL construction, method, headers, body, and error handling.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { api } from '@/lib/api-client'

function mockJsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('jsonFetch error handling', () => {
  it('throws an Error with the server error message on non-ok', async () => {
    fetchMock.mockResolvedValue(mockJsonResponse({ error: 'Project not found' }, false, 404))
    await expect(api.getProject('p1')).rejects.toThrow('Project not found')
  })

  it('falls back to statusText when no error body', async () => {
    fetchMock.mockResolvedValue(mockJsonResponse({}, false, 500))
    await expect(api.getProject('p1')).rejects.toThrow(/Request failed: 500/)
  })
})

describe('project endpoints', () => {
  it('listProjects GETs /api/projects', async () => {
    fetchMock.mockResolvedValue(mockJsonResponse({ projects: [] }))
    await api.listProjects()
    expect(fetchMock).toHaveBeenCalledWith('/api/projects', expect.objectContaining({ headers: expect.any(Object) }))
  })

  it('createProject POSTs title + description', async () => {
    fetchMock.mockResolvedValue(mockJsonResponse({ project: { id: 'p1' } as any }))
    await api.createProject('Title', 'desc')
    const init = fetchMock.mock.calls[0][1]
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify({ title: 'Title', description: 'desc' }))
  })

  it('saveDocument PUTs content', async () => {
    fetchMock.mockResolvedValue(mockJsonResponse({ ok: true, lastSaved: 'now' }))
    await api.saveDocument('p1', 'content')
    expect(fetchMock.mock.calls[0][0]).toBe('/api/projects/p1/document')
    expect(fetchMock.mock.calls[0][1].method).toBe('PUT')
  })

  it('deleteProject DELETEs', async () => {
    fetchMock.mockResolvedValue(mockJsonResponse({ ok: true }))
    await api.deleteProject('p1')
    expect(fetchMock.mock.calls[0][0]).toBe('/api/projects/p1')
    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE')
  })
})

describe('pdf endpoints', () => {
  it('uploadPdfText POSTs JSON', async () => {
    fetchMock.mockResolvedValue(mockJsonResponse({ pdf: {} }))
    await api.uploadPdfText('p1', 'notes.txt', 'text')
    expect(fetchMock.mock.calls[0][1].method).toBe('POST')
  })

  it('uploadPdfFile uses FormData (not JSON)', async () => {
    fetchMock.mockResolvedValue(mockJsonResponse({ pdf: {} }))
    const file = new File(['x'], 'a.pdf', { type: 'application/pdf' })
    await api.uploadPdfFile('p1', file)
    const body = fetchMock.mock.calls[0][1].body
    expect(body).toBeInstanceOf(FormData)
  })

  it('uploadPdfFile throws on non-ok', async () => {
    fetchMock.mockResolvedValue(mockJsonResponse({ error: 'bad pdf' }, false, 400))
    await expect(api.uploadPdfFile('p1', new File(['x'], 'a.pdf'))).rejects.toThrow('bad pdf')
  })
})

describe('engine endpoints', () => {
  it('interceptor POSTs the right body', async () => {
    fetchMock.mockResolvedValue(mockJsonResponse({ action: 'pass', isDelegative: false, confidence: 0.9 }))
    await api.interceptor('p1', 'write x', 'ctx', 'para1')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      projectId: 'p1', prompt: 'write x', context: 'ctx', paragraphId: 'para1',
    })
  })

  it('citationSentinel returns typed evidence', async () => {
    fetchMock.mockResolvedValue(mockJsonResponse({
      verdict: 'supported', explanation: 'yes', supportedClaims: [], unsupportedClaims: [],
      evidence: [], intervention: {} as any,
    }))
    const r = await api.citationSentinel('p1', 'a claim')
    expect(r.verdict).toBe('supported')
  })
})

describe('interventions + analytics', () => {
  it('listInterventions builds the query string', async () => {
    fetchMock.mockResolvedValue(mockJsonResponse({ interventions: [] }))
    await api.listInterventions('p1')
    expect(fetchMock.mock.calls[0][0]).toBe('/api/interventions?projectId=p1')
  })

  it('patchIntervention PATCHes', async () => {
    fetchMock.mockResolvedValue(mockJsonResponse({ intervention: {} as any }))
    await api.patchIntervention('iv-1', { userAction: 'engaged' })
    expect(fetchMock.mock.calls[0][0]).toBe('/api/interventions/iv-1')
    expect(fetchMock.mock.calls[0][1].method).toBe('PATCH')
  })

  it('getAnalytics hits the analytics endpoint', async () => {
    fetchMock.mockResolvedValue(mockJsonResponse({ total: 0, byEngine: {}, byAction: {}, byVerdict: {}, engagementRate: 0 }))
    await api.getAnalytics('p1')
    expect(fetchMock.mock.calls[0][0]).toContain('/api/analytics?projectId=p1')
  })
})

describe('find-sources + add-source', () => {
  it('findSources POSTs claim', async () => {
    fetchMock.mockResolvedValue(mockJsonResponse({ sources: [] }))
    await api.findSources('a claim here', 'p1')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ claim: 'a claim here', projectId: 'p1' })
  })

  it('addSource POSTs url + title', async () => {
    fetchMock.mockResolvedValue(mockJsonResponse({ ok: true }))
    await api.addSource('p1', 'https://x.com', 'Title')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ url: 'https://x.com', title: 'Title' })
  })
})
