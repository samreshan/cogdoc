/**
 * Global Zustand store for Cogdoc.
 * Holds the current view, active project, positioned interventions (for
 * floating tooltip rendering), and modal state.
 */
import { create } from 'zustand'
import type { Project, Intervention, EngineType } from '@/lib/types'

export type View = 'dashboard' | 'editor'
export type ModalName = 'none' | 'library' | 'stats' | 'history'

export interface PositionedIntervention extends Intervention {
  position: { top: number } // y-offset relative to the scrollable content area
  fadingOut?: boolean
}

interface CogdocState {
  // Navigation
  view: View
  setView: (v: View) => void

  // Active project
  activeProject: Project | null
  setActiveProject: (p: Project | null) => void
  updateActiveProjectContent: (content: string, lastSaved?: string) => void

  // Positioned interventions (rendered as floating tooltips in the editor)
  positionedInterventions: PositionedIntervention[]
  pushPositionedIntervention: (i: Intervention, position: { top: number }) => void
  markInterventionFading: (id: string) => void
  removePositionedIntervention: (id: string) => void
  clearPositionedInterventions: () => void

  // Modals (Library / Stats / History — shown as overlays since we removed the right panel)
  activeModal: ModalName
  setActiveModal: (m: ModalName) => void

  // Library + analytics refresh triggers
  libraryVersion: number
  bumpLibrary: () => void
  analyticsVersion: number
  bumpAnalytics: () => void

  // Loading states per engine
  engineLoading: Record<EngineType, boolean>
  setEngineLoading: (engine: EngineType, b: boolean) => void

  // Focus mode (dims all paragraphs except the one being edited)
  focusMode: boolean
  toggleFocusMode: () => void
}

export const useCogdoc = create<CogdocState>((set) => ({
  view: 'dashboard',
  setView: (v) => set({ view: v }),

  activeProject: null,
  setActiveProject: (p) =>
    set({
      activeProject: p,
      positionedInterventions: [],
    }),
  updateActiveProjectContent: (content, lastSaved) =>
    set((s) => {
      if (!s.activeProject) return {}
      return {
        activeProject: {
          ...s.activeProject,
          document: s.activeProject.document
            ? { ...s.activeProject.document, content, lastSaved: lastSaved ?? s.activeProject.document.lastSaved }
            : { id: '', content, lastSaved: lastSaved ?? new Date().toISOString() },
        },
      }
    }),

  positionedInterventions: [],
  pushPositionedIntervention: (i, position) =>
    set((s) => ({
      positionedInterventions: [
        ...s.positionedInterventions,
        { ...i, position },
      ].slice(-8), // cap at 8 visible tooltips
    })),
  markInterventionFading: (id) =>
    set((s) => ({
      positionedInterventions: s.positionedInterventions.map((i) =>
        i.id === id ? { ...i, fadingOut: true } : i,
      ),
    })),
  removePositionedIntervention: (id) =>
    set((s) => ({
      positionedInterventions: s.positionedInterventions.filter((i) => i.id !== id),
    })),
  clearPositionedInterventions: () => set({ positionedInterventions: [] }),

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
}))
