import { mergeAttributes, Node } from '@tiptap/core'

export interface StructuredCitationAttrs {
  referenceId: string
  title: string
  author: string
  year: string | null
  locator: string | null
  verified: boolean
  metadataVersion: string | null
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    structuredCitation: {
      insertCitation: (attrs: StructuredCitationAttrs) => ReturnType
      updateCitationLocator: (locator: string | null) => ReturnType
    }
  }
}

export function citationLabel(attrs: Pick<StructuredCitationAttrs, 'author' | 'year' | 'locator'>) {
  const locator = attrs.locator?.trim() ? `, ${attrs.locator.trim()}` : ''
  return `(${attrs.author || 'Unknown'}, ${attrs.year || 'n.d.'}${locator})`
}

export const StructuredCitation = Node.create({
  name: 'structuredCitation',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      referenceId: { default: '' }, title: { default: '' }, author: { default: 'Unknown' },
      year: { default: null }, locator: { default: null }, verified: { default: false }, metadataVersion: { default: null },
    }
  },

  parseHTML() { return [{ tag: 'span[data-cogdoc-citation]' }] },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, {
      'data-cogdoc-citation': '',
      'data-reference-id': HTMLAttributes.referenceId,
      class: `cogdoc-citation${HTMLAttributes.verified ? '' : ' cogdoc-citation--unverified'}`,
      title: `${HTMLAttributes.title}${HTMLAttributes.verified ? '' : ' — metadata needs verification'}`,
    }), citationLabel(HTMLAttributes as StructuredCitationAttrs)]
  },

  renderText({ node }) { return citationLabel(node.attrs as StructuredCitationAttrs) },

  addCommands() {
    return {
      insertCitation: (attrs) => ({ chain }) => chain().focus().insertContent({ type: this.name, attrs }).run(),
      updateCitationLocator: (locator) => ({ commands }) => commands.updateAttributes(this.name, { locator }),
    }
  },
})
