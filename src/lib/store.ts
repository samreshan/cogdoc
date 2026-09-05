/**
 * Global Zustand store for Cogdoc.
 * Holds the current view, active project, active interventions (linked to
 * sentences, not positioned), and hovered-sentence state for the popover.
 */
import { create } from 'zustand'
import type { Project, Intervention, PositionedIntervention, EngineType, FrictionMode, EditorContext, IDEWorkspaceTab, ResearchEntityKind, ResearchAction, ReviewItem } from '@/lib/types'
import type { StructuredCitationAttrs } from '@/lib/extensions/citation-node'
import { dedupeInterventionsByPhrase } from '@/lib/intervention-dedupe'

export type View = 'dashboard' | 'workspace' | 'editor' | 'verification'
export type ModalName = 'none' | 'library' | 'stats' | 'history' | 'review'

interface CogdocState {
  // Navigation
  view: View
  setView: (v: View) => void

  // Active project
  activeProject: Project | null
  setActiveProject: (p: Project | null) => void
  updateActiveProjectContent: (content: string, lastSaved?: string, revision?: number, contentHash?: string) => void

  // Active interventions (linked to sentences via promptText)
  activeInterventions: Intervention[]
  pushIntervention: (i: Intervention) => void
  markInterventionFading: (id: string) => void
  removeIntervention: (id: string) => void
  updateIntervention: (id: string, patch: Partial<Intervention>) => void
  clearInterventions: () => void

  // Legacy floating margin compatibility. New review work uses ActionQueue.
  positionedInterventions: PositionedIntervention[]
  removePositionedIntervention: (id: string) => void

  // Hovered sentence (for popover display)
  hoveredSentenceKey: string | null
  hoveredPosition: { top: number; left: number } | null
  setHovered: (key: string | null, position: { top: number; left: number } | null) => void

  // A right-pane item can request that the editor select and reveal its text.
  editorFocusQuote: string | null
  focusEditorText: (quote: string) => void
  clearEditorFocus: () => void

  // Current review anchors rendered as visible document underlines.
  reviewHighlightQuotes: string[]
  setReviewHighlightQuotes: (quotes: string[]) => void
  reviewItems: ReviewItem[]
  setReviewItems: (items: ReviewItem[]) => void

  // Project actions are mirrored here so editor decorations and their inline
  // hover cards stay in sync with the automatic left-pane queue.
  researchActions: ResearchAction[]
  setResearchActions: (actions: ResearchAction[]) => void

  // A navigator permalink may need to open the Draft tab before its heading
  // exists in the DOM. The editor consumes this request after it mounts.
  editorOutlineTarget: string | null
  focusEditorOutline: (headingId: string) => void
  clearEditorOutlineFocus: () => void

  // The cursor bookmark survives switching from the draft to Sources or
  // References. Verified citations return to this exact author-owned position.
  editorSelectionBookmark: { from: number; to: number } | null
  setEditorSelectionBookmark: (bookmark: { from: number; to: number }) => void
  pendingCitation: StructuredCitationAttrs | null
  requestCitationInsertion: (citation: StructuredCitationAttrs) => void
  clearPendingCitation: () => void

  sourceMapperQuery: string
  setSourceMapperQuery: (query: string) => void

  // Modals
  activeModal: ModalName
  setActiveModal: (m: ModalName) => void

  // Refresh triggers
  libraryVersion: number
  bumpLibrary: () => void
  analyticsVersion: number
  bumpAnalytics: () => void

  // Loading states per engine
  engineLoading: Record<EngineType, boolean>
  setEngineLoading: (engine: EngineType, b: boolean) => void

  // Focus mode
  focusMode: boolean
  toggleFocusMode: () => void

  // Friction calibration (PRODUCT.md §9): socratic | coach | assistant
  frictionMode: FrictionMode
  setFrictionMode: (m: FrictionMode) => void

  // Blindspot Monitor anti-fatigue: max one [Lens] per session (§7.2)
  blindspotShownThisSession: boolean
  markBlindspotShown: () => void

  // Research IDE shell
  ideTabs: IDEWorkspaceTab[]
  activeTabId: string
  openIdeTab: (tab: IDEWorkspaceTab) => void
  closeIdeTab: (id: string) => void
  setActiveTab: (id: string) => void
  navigatorVisible: boolean
  inspectorVisible: boolean
  toggleNavigator: () => void
  toggleInspector: () => void
  showNavigator: () => void
  showInspector: () => void
  mobilePane: 'navigator' | 'work' | 'inspector'
  setMobilePane: (pane: 'navigator' | 'work' | 'inspector') => void
  editorContext: EditorContext | null
  selectResearchEntity: (kind: ResearchEntityKind, entityId?: string, passageId?: string) => void
}

const DOCUMENT_TAB: IDEWorkspaceTab = { id: 'document', kind: 'document', label: 'Working document', closable: false }
const entityKindForTab = (kind: IDEWorkspaceTab['kind']): ResearchEntityKind => kind === 'sources' ? 'source' : kind === 'notebook' ? 'note' : kind === 'evidence' ? 'claim' : kind === 'actions' ? 'action' : kind === 'references' ? 'reference' : kind === 'requirements' ? 'requirement' : kind === 'exports' ? 'export' : kind

export const useCogdoc = create<CogdocState>((set) => ({
  view: 'dashboard',
  setView: (v) => set({ view: v }),

  activeProject: null,
  setActiveProject: (p) =>
    set({
      activeProject: p,
      activeInterventions: dedupeInterventionsByPhrase((p?.interventions ?? [])
        .filter((intervention) => intervention.status === 'active'))
        .slice(-30),
      hoveredSentenceKey: null,
      editorFocusQuote: null,
      reviewHighlightQuotes: [],
      reviewItems: [],
      researchActions: [],
      editorOutlineTarget: null,
      editorSelectionBookmark: null,
      pendingCitation: null,
      sourceMapperQuery: '',
      blindspotShownThisSession: false,
      ideTabs: [DOCUMENT_TAB],
      activeTabId: 'document',
      editorContext: p ? { workspaceId: p.id, activeTabId: 'document', activeKind: 'document' } : null,
    }),
  updateActiveProjectContent: (content, lastSaved, revision, contentHash) =>
    set((s) => {
      if (!s.activeProject) return {}
      return {
        activeProject: {
          ...s.activeProject,
          document: s.activeProject.document
            ? {
                ...s.activeProject.document,
                content,
                lastSaved: lastSaved ?? s.activeProject.document.lastSaved,
                revision: revision ?? s.activeProject.document.revision,
                contentHash: contentHash ?? s.activeProject.document.contentHash,
              }
            : { id: '', content, lastSaved: lastSaved ?? new Date().toISOString(), revision: revision ?? 0, contentHash: contentHash ?? '' },
        },
      }
    }),

  activeInterventions: [],
  pushIntervention: (i) =>
    set((s) => ({
      activeInterventions: dedupeInterventionsByPhrase([...s.activeInterventions, i]).slice(-30),
    })),
  markInterventionFading: (id) =>
    set((s) => ({
      activeInterventions: s.activeInterventions.map((i) =>
        i.id === id ? { ...i, status: 'resolved' as const } : i,
      ),
    })),
  removeIntervention: (id) =>
    set((s) => ({
      activeInterventions: s.activeInterventions.filter((i) => i.id !== id),
    })),
  updateIntervention: (id, patch) =>
    set((s) => ({ activeInterventions: s.activeInterventions.map((item) => item.id === id ? { ...item, ...patch } : item) })),
  clearInterventions: () => set({ activeInterventions: [] }),

  positionedInterventions: [],
  removePositionedIntervention: (id) =>
    set((s) => ({ positionedInterventions: s.positionedInterventions.filter((item) => item.id !== id) })),

  hoveredSentenceKey: null,
  hoveredPosition: null,
  setHovered: (key, position) => set({ hoveredSentenceKey: key, hoveredPosition: position }),

  editorFocusQuote: null,
  focusEditorText: (quote) => set({ editorFocusQuote: quote.trim() || null }),
  clearEditorFocus: () => set({ editorFocusQuote: null }),
  reviewHighlightQuotes: [],
  setReviewHighlightQuotes: (quotes) => set({
    reviewHighlightQuotes: [...new Set(quotes.map((quote) => quote.trim()).filter((quote) => quote.length >= 5))],
  }),
  reviewItems: [],
  setReviewItems: (reviewItems) => set({ reviewItems }),
  researchActions: [],
  setResearchActions: (researchActions) => set({ researchActions }),
  editorOutlineTarget: null,
  focusEditorOutline: (editorOutlineTarget) => set({ editorOutlineTarget }),
  clearEditorOutlineFocus: () => set({ editorOutlineTarget: null }),
  editorSelectionBookmark: null,
  setEditorSelectionBookmark: (editorSelectionBookmark) => set({ editorSelectionBookmark }),
  pendingCitation: null,
  requestCitationInsertion: (pendingCitation) => set({ pendingCitation }),
  clearPendingCitation: () => set({ pendingCitation: null }),
  sourceMapperQuery: '',
  setSourceMapperQuery: (sourceMapperQuery) => set({ sourceMapperQuery }),

  activeModal: 'none',
  setActiveModal: (m) => set({ activeModal: m }),

  libraryVersion: 0,
  bumpLibrary: () => set((s) => ({ libraryVersion: s.libraryVersion + 1 })),
  analyticsVersion: 0,
  bumpAnalytics: () => set((s) => ({ analyticsVersion: s.analyticsVersion + 1 })),

  engineLoading: { socratic: false, interceptor: false, citation: false, scaffold: false },
  setEngineLoading: (engine, b) =>
    set((s) => ({ engineLoading: { ...s.engineLoading, [engine]: b } })),

  focusMode: false,
  toggleFocusMode: () => set((s) => ({ focusMode: !s.focusMode })),

  frictionMode: 'socratic',
  setFrictionMode: (m) => set({ frictionMode: m }),

  blindspotShownThisSession: false,
  markBlindspotShown: () => set({ blindspotShownThisSession: true }),

  ideTabs: [DOCUMENT_TAB],
  activeTabId: 'document',
  openIdeTab: (tab) => set((state) => ({
    ideTabs: state.ideTabs.some((item) => item.id === tab.id) ? state.ideTabs : [...state.ideTabs, tab],
    activeTabId: tab.id,
    mobilePane: 'work',
    editorContext: state.activeProject ? { workspaceId: state.activeProject.id, activeTabId: tab.id, activeKind: entityKindForTab(tab.kind), entityId: tab.entityId } : null,
  })),
  closeIdeTab: (id) => set((state) => {
    const tabs = state.ideTabs.filter((tab) => tab.id !== id || tab.closable === false)
    const activeTabId = state.activeTabId === id ? 'document' : state.activeTabId
    const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? DOCUMENT_TAB
    return { ideTabs: tabs, activeTabId, editorContext: state.activeProject ? { workspaceId: state.activeProject.id, activeTabId, activeKind: entityKindForTab(activeTab.kind), entityId: activeTab.entityId } : null }
  }),
  setActiveTab: (id) => set((state) => {
    const tab = state.ideTabs.find((item) => item.id === id)
    if (!tab) return {}
    return { activeTabId: id, mobilePane: 'work', editorContext: state.activeProject ? { workspaceId: state.activeProject.id, activeTabId: id, activeKind: entityKindForTab(tab.kind), entityId: tab.entityId } : null }
  }),
  navigatorVisible: true,
  inspectorVisible: true,
  toggleNavigator: () => set((state) => ({ navigatorVisible: !state.navigatorVisible })),
  toggleInspector: () => set((state) => ({ inspectorVisible: !state.inspectorVisible })),
  showNavigator: () => set({ navigatorVisible: true }),
  showInspector: () => set({ inspectorVisible: true }),
  mobilePane: 'work',
  setMobilePane: (mobilePane) => set({ mobilePane }),
  editorContext: null,
  selectResearchEntity: (kind, entityId, passageId) => set((state) => ({
    editorContext: state.activeProject ? { workspaceId: state.activeProject.id, activeTabId: state.activeTabId, activeKind: kind, entityId, passageId } : null,
    mobilePane: state.mobilePane === 'navigator' ? 'work' : state.mobilePane,
  })),
}))
