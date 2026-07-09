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
    ...overrides,
  }
}

/** Default user returned by the mocked auth. */
export const DEFAULT_USER = { id: 'user-1', email: 'writer@cogdoc.local' }

/** Default project returned by the mocked db lookup. */
export const DEFAULT_PROJECT = { id: 'proj-1', userId: 'user-1', title: 'P' }
