/**
 * Characterization tests for the Zustand store (store.ts).
 *
 * The store is the single source of truth for view navigation, active project,
 * active interventions, and engine loading state. Locking these transitions
 * protects the frontend during the Tiptap/SSE migration.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useCogdoc } from '@/lib/store'
import type { Intervention, Project } from '@/lib/types'

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    title: 'Test Project',
    description: null,
    archived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    document: { id: 'd1', content: '', lastSaved: new Date().toISOString() },
    pdfs: [],
    interventions: [],
    _count: { pdfs: 0, interventions: 0 },
    ...overrides,
  }
}

function makeIntervention(overrides: Partial<Intervention> = {}): Intervention {
  return {
    id: 'iv-1',
    userId: 'u1',
    projectId: 'p1',
    paragraphId: null,
    promptTemplateTag: 'Provocation',
    engineType: 'socratic',
    promptText: 'some sentence text here',
    responseText: 'a question',
    verdict: null,
    status: 'active',
    userAction: null,
    createdAt: new Date().toISOString(),
    resolvedAt: null,
    ...overrides,
  }
}

// Zustand stores are singletons — reset state between tests by restoring defaults.
beforeEach(() => {
  useCogdoc.setState({
    view: 'dashboard',
    activeProject: null,
    activeInterventions: [],
    hoveredSentenceKey: null,
    hoveredPosition: null,
    editorFocusQuote: null,
    activeModal: 'none',
    libraryVersion: 0,
    analyticsVersion: 0,
    engineLoading: { socratic: false, interceptor: false, citation: false, scaffold: false },
    focusMode: false,
    frictionMode: 'socratic',
    blindspotShownThisSession: false,
  })
})

describe('view navigation', () => {
  it('starts on the dashboard', () => {
    expect(useCogdoc.getState().view).toBe('dashboard')
  })

  it('switches to editor and back', () => {
    useCogdoc.getState().setView('editor')
    expect(useCogdoc.getState().view).toBe('editor')
    useCogdoc.getState().setView('dashboard')
    expect(useCogdoc.getState().view).toBe('dashboard')
  })
})

describe('active project', () => {
  it('sets the active project and clears interventions', () => {
    useCogdoc.getState().pushIntervention(makeIntervention())
    const project = makeProject({ id: 'p2' })
    useCogdoc.getState().setActiveProject(project)
    expect(useCogdoc.getState().activeProject?.id).toBe('p2')
    expect(useCogdoc.getState().activeInterventions).toHaveLength(0)
  })

  it('updates document content without replacing the project', () => {
    useCogdoc.getState().setActiveProject(makeProject())
    useCogdoc.getState().updateActiveProjectContent('new content', '2026-01-01')
    const p = useCogdoc.getState().activeProject
    expect(p?.document?.content).toBe('new content')
    expect(p?.document?.lastSaved).toBe('2026-01-01')
  })

  it('does nothing if no active project is set', () => {
    useCogdoc.getState().updateActiveProjectContent('x', 'y')
    expect(useCogdoc.getState().activeProject).toBeNull()
  })
})

describe('interventions', () => {
  it('pushes and caps at 30 interventions', () => {
    for (let i = 0; i < 35; i++) {
      useCogdoc.getState().pushIntervention(makeIntervention({ id: `iv-${i}` }))
    }
    expect(useCogdoc.getState().activeInterventions).toHaveLength(30)
    // the last 30 are retained
    expect(useCogdoc.getState().activeInterventions[29].id).toBe('iv-34')
  })

  it('marks an intervention as fading (resolved status)', () => {
    useCogdoc.getState().pushIntervention(makeIntervention({ id: 'iv-1' }))
    useCogdoc.getState().markInterventionFading('iv-1')
    expect(useCogdoc.getState().activeInterventions[0].status).toBe('resolved')
  })

  it('removes an intervention by id', () => {
    useCogdoc.getState().pushIntervention(makeIntervention({ id: 'iv-1' }))
    useCogdoc.getState().pushIntervention(makeIntervention({ id: 'iv-2' }))
    useCogdoc.getState().removeIntervention('iv-1')
    expect(useCogdoc.getState().activeInterventions.map((i) => i.id)).toEqual(['iv-2'])
  })

  it('clears all interventions', () => {
    useCogdoc.getState().pushIntervention(makeIntervention())
    useCogdoc.getState().clearInterventions()
    expect(useCogdoc.getState().activeInterventions).toHaveLength(0)
  })
})

describe('engine loading state', () => {
  it('sets and clears loading flags per engine', () => {
    useCogdoc.getState().setEngineLoading('citation', true)
    expect(useCogdoc.getState().engineLoading.citation).toBe(true)
    useCogdoc.getState().setEngineLoading('citation', false)
    expect(useCogdoc.getState().engineLoading.citation).toBe(false)
  })
})

describe('focus mode', () => {
  it('toggles focus mode', () => {
    expect(useCogdoc.getState().focusMode).toBe(false)
    useCogdoc.getState().toggleFocusMode()
    expect(useCogdoc.getState().focusMode).toBe(true)
  })
})

describe('editor focus requests', () => {
  it('stores a right-pane quote until the editor consumes it', () => {
    useCogdoc.getState().focusEditorText('  Find this sentence in the draft.  ')
    expect(useCogdoc.getState().editorFocusQuote).toBe('Find this sentence in the draft.')
    useCogdoc.getState().clearEditorFocus()
    expect(useCogdoc.getState().editorFocusQuote).toBeNull()
  })

  it('clears a pending focus request when switching projects', () => {
    useCogdoc.getState().focusEditorText('A stale sentence')
    useCogdoc.getState().setActiveProject(makeProject({ id: 'p2' }))
    expect(useCogdoc.getState().editorFocusQuote).toBeNull()
  })
})

describe('friction mode', () => {
  it('defaults to socratic', () => {
    expect(useCogdoc.getState().frictionMode).toBe('socratic')
  })

  it('transitions socratic → coach → assistant', () => {
    useCogdoc.getState().setFrictionMode('coach')
    expect(useCogdoc.getState().frictionMode).toBe('coach')
    useCogdoc.getState().setFrictionMode('assistant')
    expect(useCogdoc.getState().frictionMode).toBe('assistant')
    useCogdoc.getState().setFrictionMode('socratic')
    expect(useCogdoc.getState().frictionMode).toBe('socratic')
  })

  it('survives a project switch (persists in the store)', () => {
    useCogdoc.getState().setFrictionMode('assistant')
    useCogdoc.getState().setActiveProject(makeProject({ id: 'p2' }))
    expect(useCogdoc.getState().frictionMode).toBe('assistant')
  })
})

describe('blindspot session flag (§7.2 anti-fatigue)', () => {
  it('defaults to not-shown', () => {
    expect(useCogdoc.getState().blindspotShownThisSession).toBe(false)
  })

  it('marks shown and stays shown within the session', () => {
    useCogdoc.getState().markBlindspotShown()
    expect(useCogdoc.getState().blindspotShownThisSession).toBe(true)
  })

  it('resets to not-shown on project switch (one per session per project)', () => {
    useCogdoc.getState().markBlindspotShown()
    useCogdoc.getState().setActiveProject(makeProject({ id: 'p2' }))
    expect(useCogdoc.getState().blindspotShownThisSession).toBe(false)
  })
})

describe('refresh triggers', () => {
  it('bumps the library version', () => {
    expect(useCogdoc.getState().libraryVersion).toBe(0)
    useCogdoc.getState().bumpLibrary()
    expect(useCogdoc.getState().libraryVersion).toBe(1)
  })

  it('bumps the analytics version', () => {
    expect(useCogdoc.getState().analyticsVersion).toBe(0)
    useCogdoc.getState().bumpAnalytics()
    expect(useCogdoc.getState().analyticsVersion).toBe(1)
  })
})
