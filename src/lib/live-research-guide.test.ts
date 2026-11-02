// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { completeGuideAction, nextGuideStep, observeGuideSuccess, readGuideProgress, registerLiveGuide, downloadGuideArtifact } from './live-research-guide'
const storage = new Map<string, string>()
beforeEach(() => {
  storage.clear()
  vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) })
})
describe('live research progress', () => {
  it('records out-of-order real actions once and resumes at the first unfinished task', () => {
    registerLiveGuide('p')
    completeGuideAction('p', 'collaborate')
    completeGuideAction('p', 'source')
    completeGuideAction('p', 'collaborate')
    expect(readGuideProgress('p')).toEqual(['collaborate', 'source'])
    expect(nextGuideStep(readGuideProgress('p'))?.id).toBe('write')
    completeGuideAction('p', 'write')
    completeGuideAction('p', 'question')
    expect(nextGuideStep(readGuideProgress('p'))?.id).toBe('evidence')
  })
  it('does not change unrelated projects or count a fetched finding as reviewed', () => {
    registerLiveGuide('p')
    completeGuideAction('other', 'review')
    observeGuideSuccess('/api/workspaces/p/findings/f/review', undefined, { review: {} })
    observeGuideSuccess('/api/workspaces/p/findings', { method: 'POST', body: JSON.stringify({ action: 'save_finding' }) }, { finding: {} })
    expect(readGuideProgress('p')).toEqual(['finding'])
    expect(readGuideProgress('other')).toEqual([])
  })
  it('recognizes explicit review with uncertainty, not a request for more evidence', () => {
    registerLiveGuide('p')
    const review = (decision: string) => observeGuideSuccess('/api/workspaces/p/findings/f/review', { method: 'POST', body: JSON.stringify({ decision }) }, { review: {} })
    review('request_more_evidence')
    expect(readGuideProgress('p')).toEqual([])
    review('retain_uncertainty')
    expect(readGuideProgress('p')).toEqual(['review'])
  })
  it('does not mark failed export as complete', async () => {
    registerLiveGuide('p')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))
    await expect(downloadGuideArtifact('p', '/export', 'research.md')).rejects.toThrow('500')
    expect(readGuideProgress('p')).toEqual([])
  })
})

it('downloads the server artifact and records completion only after success', async () => {
  registerLiveGuide('p')
  const artifact = new Blob(['# My actual research\nA researcher-written finding.'])
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, blob: async () => artifact }))
  const create = vi.fn().mockReturnValue('blob:test')
  vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: vi.fn() })
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  await downloadGuideArtifact('p', '/api/projects/p/export?format=md', 'research.md')
  expect(create).toHaveBeenCalledWith(artifact)
  expect(click).toHaveBeenCalledOnce()
  expect(readGuideProgress('p')).toEqual(['export'])
})
