/**
 * Shared test helpers for API route integration tests.
 *
 * These tests invoke the route handler functions directly with a constructed
 * NextRequest, mocking out db, auth, and the AIService. This exercises the
 * real request-validation + orchestration + response-shaping code in each
 * route without spinning up the Next.js server.
 */
import { NextRequest } from 'next/server'
import type { AIService } from '@/lib/ai-service'

/** Build a NextRequest with a JSON body, simulating what Next.js delivers. */
export function makeReq(body: unknown, url = 'http://localhost/api/x'): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/** A minimal fake AIService for integration tests. */
export function fakeAI(overrides: Partial<AIService> = {}): AIService {
  return {
    classifyPrompt: async () => ({ isDelegative: false, confidence: 0.9, raw: 'PASS' }),
    generateSocratic: async () => ({ question: 'Why is that?', raw: 'Why is that?' }),
    verifyClaim: async () => ({
      verdict: 'insufficient_evidence',
      explanation: 'none',
      supported_claims: [],
      unsupported_claims: [],
    }),
    generateScaffold: async () => ({ scaffold: 'Claim: __', raw: 'Claim: __' }),
    generateSuggestion: async () => ({ suggestion: 'a short phrase', raw: 'a short phrase' }),
    answerFromEvidence: async () => null,
    evaluateInterventionAnswer: async () => ({ satisfied: false, rationale: 'More detail is needed.', followUpQuestion: 'What evidence supports it?' }),
    draftFromResearchDialogue: async () => ({ draft: 'A working research draft.', reflection: 'Does this still represent your view?', sourceNeeds: [] }),
    planResearchKickoff: async () => ({
      title: 'Research project', description: 'A focused inquiry.',
      outline: [{ heading: 'Context', purpose: 'Define the problem.' }, { heading: 'Evidence', purpose: 'Assess available evidence.' }, { heading: 'Implications', purpose: 'Explain what follows.' }],
      questions: [{ id: 'q1', question: 'What do you think is happening?', why: 'Shows your current model.' }, { id: 'q2', question: 'What evidence would support it?', why: 'Tests evidence expectations.' }, { id: 'q3', question: 'What competing view matters?', why: 'Surfaces alternatives.' }],
    }),
    draftResearchKickoff: async () => ({ sections: [{ heading: 'Context', content: 'Working context.' }, { heading: 'Evidence', content: 'Working evidence.' }], reflection: 'Does this match your view?', sourceNeeds: [] }),
    restructureFromIntervention: async ({ passage }) => passage,
    provideContextualHelp: async () => ({ body: 'What evidence would change this account?', action: 'Compare it with the supplied material.', modelVersion: 'fake-contextual-provider' }),
    collaborateOnDocument: async () => ({ answer: 'Here is a direct answer grounded in the context you chose.', nextStep: 'Check the claim against one available passage.', hypothetical: false, modelVersion: 'fake-document-collaborator' }),
    draftArticleFromFindings: async () => ({ content: 'A bounded draft from reviewed findings.', sourceIndexes: [], unsupportedClaims: [], modelVersion: 'fake-article-provider' }),
    ...overrides,
  }
}

/** Default user returned by the mocked auth. */
export const DEFAULT_USER = { id: 'user-1', email: 'writer@cogdoc.local' }

/** Default project returned by the mocked db lookup. */
export const DEFAULT_PROJECT = { id: 'proj-1', userId: 'user-1', title: 'P' }
