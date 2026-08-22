/**
 * Integration tests for GET /api/projects/[id]/export (md/txt/html).
 *
 * Exercises the format switch and the HTML→Markdown/Text conversion helpers.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/db', () => ({
  db: { project: { findUnique: vi.fn() } },
}))
vi.mock('@/lib/auth-supabase', () => ({ requireUserId: vi.fn().mockResolvedValue('u1') }))

import { GET } from '@/app/api/projects/[id]/export/route'
import { db } from '@/lib/db'

const findUnique = db.project.findUnique as ReturnType<typeof vi.fn>

beforeEach(() => findUnique.mockReset())

function ctx(id: string) {
  return { params: Promise.resolve({ id }) }
}
function req(id: string, format?: string) {
  const url = format
    ? `http://localhost/api/projects/${id}/export?format=${format}`
    : `http://localhost/api/projects/${id}/export`
  return new NextRequest(url)
}

const HTML = '<h1>Title</h1><p>Hello <strong>world</strong></p><ul><li>one</li></ul>'

describe('GET /api/projects/[id]/export', () => {
  it('returns 404 when the project does not exist', async () => {
    findUnique.mockResolvedValue(null)
    const res = await GET(req('x'), ctx('x'))
    expect(res.status).toBe(404)
  })

  it('exports as markdown by default', async () => {
    findUnique.mockResolvedValue({ id: 'p1', title: 'My Essay', document: { content: HTML } })
    const res = await GET(req('p1'), ctx('p1'))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('text/markdown')
    const text = await res.text()
    expect(text).toContain('# My Essay')
    expect(text).toContain('**world**')
    expect(text).toContain('- one')
    const cd = res.headers.get('Content-Disposition') ?? ''
    expect(cd).toContain('my-essay.md')
  })

  it('exports as plain text with format=txt', async () => {
    findUnique.mockResolvedValue({ id: 'p1', title: 'Doc', document: { content: '<p>Hi there</p>' } })
    const res = await GET(req('p1', 'txt'), ctx('p1'))
    expect(res.headers.get('Content-Type')).toContain('text/plain')
    const text = await res.text()
    expect(text).toContain('Doc')
    expect(text).toContain('Hi there')
    expect(text).not.toContain('<p>')
  })

  it('exports as html with format=html', async () => {
    findUnique.mockResolvedValue({ id: 'p1', title: 'Doc', document: { content: '<p>Body</p>' } })
    const res = await GET(req('p1', 'html'), ctx('p1'))
    expect(res.headers.get('Content-Type')).toContain('text/html')
    const text = await res.text()
    expect(text).toContain('<!DOCTYPE html>')
    expect(text).toContain('<p>Body</p>')
  })

  it('falls back to markdown for unknown formats', async () => {
    findUnique.mockResolvedValue({ id: 'p1', title: 'Doc', document: { content: '<p>x</p>' } })
    const res = await GET(req('p1', 'weird'), ctx('p1'))
    expect(res.headers.get('Content-Type')).toContain('text/markdown')
  })

  it('handles a project with no document (empty content)', async () => {
    findUnique.mockResolvedValue({ id: 'p1', title: 'Empty', document: null })
    const res = await GET(req('p1', 'md'), ctx('p1'))
    const text = await res.text()
    expect(text).toContain('# Empty')
  })
})
