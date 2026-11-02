import { beforeEach, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({ project: vi.fn(), chunks: vi.fn(), sources: vi.fn(), retrieve: vi.fn(), index: vi.fn(), pdfs: vi.fn() }))
vi.mock('@/lib/db', () => ({ db: { project: { findFirst: mocks.project }, pdfChunk: { findMany: mocks.chunks }, workspaceSource: { findMany: mocks.sources }, pdf: { findMany: mocks.pdfs } } }))
vi.mock('@/lib/auth-supabase', () => ({ requireUserId: async () => 'user' }))
vi.mock('@/lib/ai-gateway', () => ({ retrieveVectorChunks: mocks.retrieve }))
vi.mock('@/lib/source-indexing', () => ({ indexSourceChunks: mocks.index }))
import { POST } from './route'
const call = (body: object) => POST(new NextRequest('http://localhost/api/workspaces/p/retrieval', { method: 'POST', body: JSON.stringify(body) }), { params: Promise.resolve({ id: 'p' }) })
beforeEach(() => { vi.resetAllMocks(); mocks.project.mockResolvedValue({ id: 'p' }); mocks.sources.mockResolvedValue([{ id: 'source', librarySourceId: 'lib' }]) })
it('returns only owned canonical passages with source identifiers', async () => {
  mocks.retrieve.mockResolvedValue([{ chunkId: 'c', content: 'remote text', similarityScore: 0.8 }, { chunkId: 'foreign', content: 'wrong project' }])
  mocks.chunks.mockResolvedValue([{ id: 'c', content: 'Canonical source text', pdf: { librarySourceId: 'lib' } }])
  const response = await call({ query: 'stable Service address' })
  expect((await response.json()).passages).toEqual([expect.objectContaining({ content: 'Canonical source text', workspaceSourceId: 'source' })])
  expect(mocks.retrieve).toHaveBeenCalledWith('p', 'stable Service address', 5)
  expect(mocks.chunks.mock.calls[0][0].where.pdf).toEqual({ projectId: 'p' })
})
it('rejects unowned workspaces before contacting the retrieval service', async () => {
  mocks.project.mockResolvedValue(null)
  expect((await call({ query: 'a question' })).status).toBe(404)
  expect(mocks.retrieve).not.toHaveBeenCalled()
})
it('reports failure instead of fabricating retrieval results', async () => {
  mocks.retrieve.mockRejectedValue(new Error('offline'))
  const response = await call({ query: 'a question' })
  expect(response.status).toBe(503)
  expect((await response.json()).passages).toBeUndefined()
})
