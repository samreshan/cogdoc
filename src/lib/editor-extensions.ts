import StarterKit from '@tiptap/starter-kit'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import Image from '@tiptap/extension-image'
import { WavyUnderline } from '@/lib/extensions/wavy-underline'
import { InterventionHighlight } from '@/lib/extensions/intervention-highlight'
import { ReviewItemHighlight } from '@/lib/extensions/review-item-highlight'
import { StructuredCitation } from '@/lib/extensions/citation-node'
import { DocumentOutlineAnchors } from '@/lib/extensions/document-outline-anchors'
import { ResearchActionHighlight } from '@/lib/extensions/research-action-highlight'

export function createEditorExtensions() {
  return [
    StarterKit.configure({ link: { openOnClick: false } }),
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
    Image.configure({ allowBase64: true }),
    WavyUnderline,
    InterventionHighlight,
    ReviewItemHighlight,
    ResearchActionHighlight,
    DocumentOutlineAnchors,
    StructuredCitation,
  ]
}
