import { beforeEach, describe, expect, it } from 'vitest'
import { useCogdoc } from './store'

describe('research IDE navigation state', () => {
  beforeEach(() => useCogdoc.setState({ ideTabs: [{ id: 'document', kind: 'document', label: 'Draft', closable: false }], activeTabId: 'document', mobilePane: 'work', navigatorVisible: true, inspectorVisible: true }))

  it('opens reusable tabs and restores work focus on mobile', () => {
    const tab = { id: 'source:s1', kind: 'source' as const, label: 'Source', entityId: 's1', closable: true }
    useCogdoc.getState().openIdeTab(tab)
    useCogdoc.getState().openIdeTab(tab)
    expect(useCogdoc.getState().ideTabs).toHaveLength(2)
    expect(useCogdoc.getState().activeTabId).toBe('source:s1')
    expect(useCogdoc.getState().mobilePane).toBe('work')
    useCogdoc.getState().closeIdeTab('source:s1')
    expect(useCogdoc.getState().activeTabId).toBe('document')
  })
})
