/**
 * Global Zustand store for Cogdoc.
 * Holds the current view, active project, and live interventions.
 */
import { create } from 'zustand'
import type { Project, Intervention, EngineType } from '@/lib/types'

export type View = 'dashboard' | 'editor'

interface CogdocState {
  // Navigation
  view: View
  setView: (v: View) => void

  // Active project (in the editor view)
  activeProject: Project | null
  setActiveProject: (p: Project | null) => void
  updateActiveProjectContent: (content: string, lastSaved?: string) => void

  // Active interventions rendered in the Living Margin (active only)
  activeInterventions: Intervention[]
  pushIntervention: (i: Intervention) => void
  updateIntervention: (id: string, patch: Partial<Intervention>) => void
  removeIntervention: (id: string) => void

  // Research library refresh trigger (increment to trigger refetch)
  libraryVersion: number
  bumpLibrary: () => void

  // Analytics refresh trigger
  analyticsVersion: number
  bumpAnalytics: () => void

  // Socratic Spacer idle detector (live in the editor)
  socraticLoading: boolean
  setSocraticLoading: (b: boolean) => void

  // Citation Sentinel loading
  citationLoading: boolean
  setCitationLoading: (b: boolean) => void

  // Interceptor loading
  interceptorLoading: boolean
  setInterceptorLoading: (b: boolean) => void

  // Active engine filter for margin (default: all)
  marginFilter: EngineType | 'all'
  setMarginFilter: (f: EngineType | 'all') => void

  // Right panel tab
  rightTab: 'margin' | 'library' | 'analytics'
  setRightTab: (t: 'margin' | 'library' | 'analytics') => void

  // Left panel collapsed (editor focus mode)
  leftPanelCollapsed: boolean
  toggleLeftPanel: () => void
}

export const useCogdoc = create<CogdocState>((set) => ({
  view: 'dashboard',
  setView: (v) => set({ view: v }),

  activeProject: null,
  setActiveProject: (p) =>
    set({
      activeProject: p,
      activeInterventions: p?.interventions?.filter((i) => i.status === 'active') ?? [],
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
    set((s) => ({ activeInterventions: [i, ...s.activeInterventions].slice(0, 50) })),
  updateIntervention: (id, patch) =>
    set((s) => ({
      activeInterventions: s.activeInterventions.map((i) =>
        i.id === id ? { ...i, ...patch } : i,
      ),
    })),
  removeIntervention: (id) =>
    set((s) => ({ activeInterventions: s.activeInterventions.filter((i) => i.id !== id) })),

  libraryVersion: 0,
  bumpLibrary: () => set((s) => ({ libraryVersion: s.libraryVersion + 1 })),

  analyticsVersion: 0,
  bumpAnalytics: () => set((s) => ({ analyticsVersion: s.analyticsVersion + 1 })),

  socraticLoading: false,
  setSocraticLoading: (b) => set({ socraticLoading: b }),

  citationLoading: false,
  setCitationLoading: (b) => set({ citationLoading: b }),

  interceptorLoading: false,
  setInterceptorLoading: (b) => set({ interceptorLoading: b }),

  marginFilter: 'all',
  setMarginFilter: (f) => set({ marginFilter: f }),

  rightTab: 'margin',
  setRightTab: (t) => set({ rightTab: t }),

  leftPanelCollapsed: false,
  toggleLeftPanel: () => set((s) => ({ leftPanelCollapsed: !s.leftPanelCollapsed })),
}))
