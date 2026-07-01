/**
 * Global Zustand store for Cogdoc.
 * Holds the current view, active project, active interventions (linked to
 * sentences, not positioned), and hovered-sentence state for the popover.
 */
import { create } from 'zustand'
import type { Project, Intervention, EngineType } from '@/lib/types'

export type View = 'dashboard' | 'editor'
export type ModalName = 'none' | 'library' | 'stats' | 'history'

interface CogdocState {
  // Navigation
  view: View
  setView: (v: View) => void

  // Active project
  activeProject: Project | null
  setActiveProject: (p: Project | null) => void
  updateActiveProjectContent: (content: string, lastSaved?: string) => void

  // Active interventions (linked to sentences via promptText)
  activeInterventions: Intervention[]
  pushIntervention: (i: Intervention) => void
  markInterventionFading: (id: string) => void
  removeIntervention: (id: string) => void
  clearInterventions: () => void

  // Hovered sentence (for popover display)
  hoveredSentenceKey: string | null
  hoveredPosition: { top: number; left: number } | null
  setHovered: (key: string | null, position: { top: number; left: number } | null) => void

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
}

export const useCogdoc = create<CogdocState>((set) => ({
  view: 'dashboard',
  setView: (v) => set({ view: v }),

  activeProject: null,
  setActiveProject: (p) =>
    set({
      activeProject: p,
      activeInterventions: [],
      hoveredSentenceKey: null,
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

  activeInterventions: [],
  pushIntervention: (i) =>
    set((s) => ({
      activeInterventions: [...s.activeInterventions, i].slice(-30),
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
  clearInterventions: () => set({ activeInterventions: [] }),

  hoveredSentenceKey: null,
  hoveredPosition: null,
  setHovered: (key, position) => set({ hoveredSentenceKey: key, hoveredPosition: position }),

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
