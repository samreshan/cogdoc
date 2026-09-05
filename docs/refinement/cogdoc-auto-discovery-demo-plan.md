# CogDoc auto-discovery and guided demo plan

Date: 5 September 2026

## Objective

Restore automatic scholarly source suggestions inside the document-first workflow and add an optional, resumable demonstration path. The document remains primary; discovery, source inspection, findings, and article composition remain contextual tools.

## Existing capabilities to reuse

- `/api/find-sources` already queries OpenAlex, Crossref, Semantic Scholar, and an optional grounded Gemini fallback, merges duplicate DOI/URL identities, ranks bounded candidates, and exposes metadata/access limitations.
- `save_discovered_source` already persists a discovery record and links it to a stable research question without claiming that metadata is evidence.
- The Sources dock already loads durable `WorkspaceSource` rows and distinguishes metadata, abstract, transcript, manual excerpt, and extracted text.
- `scripts/research-demo-fixture.js` and `scripts/seed-research-demo.js` already contain a dedicated marked demo workspace with verified publication identities and clearly labelled demonstration paraphrases.

## Implementation

1. Add a small client orchestration service that accepts a confirmed topic/question context, performs one bounded search, saves at most three unique suggestions through the existing APIs, and returns `saved`, `empty`, `partial`, or `unavailable` status. Use a stable context key, in-flight deduplication, and local completion cache so rendering or typing cannot create loops.
2. Trigger it after a topic is durably saved and again when a stable question is selected. Do not delay opening the document. Existing saved sources remain intact when providers return no results or fail.
3. Let the Sources dock receive a refresh signal, show honest automatic-discovery status, and retain explicit retry plus manual URL/import paths.
4. When a collaborator request asks for evidence or sources, run the same discovery providers and render bounded source-lead cards in the conversation with title, DOI/URL, access basis, rationale, and explicit save/explore actions.
5. Restore deliberate access to the four existing intervention engines from selected document text: Interceptor, Socratic Spacer, Citation Sentinel, and Scaffold. Show their actual API result and persist normal intervention records, but do not restore idle or keystroke-triggered interruptions.
6. Reuse `ResearchJob` and the existing worker for bounded background engine prompts after stable semantic events (source added, document revision saved, finding revision saved). Coalesce superseded document jobs, create at most one pending prompt, and persist it as a collaborator exchange with engine/context provenance. Only a pending prompt tied to the exact current finding revision blocks that finding's review; an answer—including an explicit uncertainty answer—releases the prompt but never auto-reviews the finding.
7. Add an optional Home affordance to create or resume the marked guided demo. Creation uses existing workspace, investigation, question, and document APIs; it never deletes or overwrites another workspace. The scenario is prefilled from the existing verified CogDoc research fixture and all starter prose is labelled demonstration material.
8. Extend the optional guide into a project-scoped, resumable sequence with one visible action per step. Progress is stored locally per demo project. Steps that cannot be observed safely use an explicit **Continue** action and say so.
9. Add a detailed supervisor walkthrough covering setup, a timed 5–10 minute presentation, click paths, narration, fallback paths, epistemic distinctions, intervention engines, limitations, and manual acceptance checks.

## Safety and acceptance

- Suggestions are metadata/abstract leads until the researcher opens lawful content; they are never auto-cited, auto-accepted, or described as verified support.
- Automatic search runs only for a durable topic or stable selected question, never per keystroke.
- Provider failure preserves existing sources and presents retry/manual continuation.
- Demo initialization is idempotent by marker and resumes the existing demo. A new demo is created only when no marked workspace exists; reset is implemented as another demo, not deletion.
- No schema change, credential exposure, database reset, Docker rebuild, or remote push.
- Focused tests cover orchestration deduplication/failure, topic/question wiring, demo isolation/resume, and guide persistence. TypeScript and a production build verify integration when disk permits.
