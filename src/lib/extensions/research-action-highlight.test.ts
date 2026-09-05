import { describe, expect, it } from 'vitest'
import { Schema } from '@tiptap/pm/model'
import { buildResearchActionDecorations } from './research-action-highlight'
import type { ResearchAction } from '@/lib/types'

const schema = new Schema({
  nodes: {
    doc: { content: 'paragraph+' },
    paragraph: { content: 'text*' },
    text: { group: 'inline' },
  },
})

const action: ResearchAction = {
  id: 'action-1',
  projectId: 'project-1',
  kind: 'evidence_gap',
  title: 'Verify the central claim',
  detail: 'Attach a grounded source passage.',
  state: 'open',
  pinned: false,
  snoozedUntil: null,
  priority: 82,
  priorityFactorsJson: '{}',
  targetKind: 'claim',
  targetId: null,
  documentAnchorJson: JSON.stringify({ quote: 'The central claim needs evidence.' }),
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
}

describe('ResearchActionHighlight', () => {
  it('links an open automatic action to its exact passage', () => {
    const doc = schema.node('doc', null, [schema.node('paragraph', null, schema.text('The central claim needs evidence.'))])
    const decoration = buildResearchActionDecorations(doc, [action]).find()[0]
    expect(decoration).toMatchObject({ from: 1, to: 34 })
    expect(decoration.type.attrs).toMatchObject({ id: 'action-action-1', 'data-action-id': 'action-1', tabindex: '0' })
  })

  it('does not highlight completed actions', () => {
    const doc = schema.node('doc', null, [schema.node('paragraph', null, schema.text('The central claim needs evidence.'))])
    expect(buildResearchActionDecorations(doc, [{ ...action, state: 'completed' }]).find()).toEqual([])
  })
})
