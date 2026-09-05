# CogDoc document-first redesign

Status: implementation contract, 5 September 2026. This document supersedes the navigation, onboarding sequence, and primary-outcome emphasis in `cogdoc-research-collaborator-prd.md` and its sprint prompts. It preserves their data model, provenance, access-level, human-review, revision, recovery, and article-safety requirements.

## Product decision

CogDoc is a document workspace with a research collaborator, not a sequence of research screens that eventually leads to writing. The working document is the durable center of the experience from project creation onward. Sources, conversation, findings, and the investigation plan are contextual tools that help the researcher make progress in that document.

The product promise is deliberately modest: CogDoc helps a researcher develop an explanation they understand and can support while making progress on their research or study document. Cognitive benefit remains a hypothesis. The interface must not claim to prove understanding, improve grades, certify authorship, prevent cognitive atrophy, or establish that a finding is true.

## Audit and diagnosis

The implementation at `2cdb295` already contains strong research-domain infrastructure: additive research objects, question planning, source identity and access state, exact/manual passage provenance, exchanges, finding revisions and human review, article artifacts, dependency invalidation, Tiptap autosave/recovery/conflict handling, citation insertion, and existing document export.

The user-facing composition does not express that infrastructure coherently:

- `editor-shell.tsx` returns `CollaboratorWorkspace` before rendering the Tiptap editor. The document is therefore a legacy escape hatch rather than the main workspace.
- `collaborator-workspace.tsx` defaults to an Overview destination and swaps full-page panels for Investigate, Findings, Sources, and Write. This recreates an obstacle course and unmounts working context.
- “Existing writing” and the legacy/research switch imply two products and make an existing user's real work secondary.
- The legacy editor fires interventions after sentence endings, paragraph completion, and idle time, shows “Cogdoc is listening,” runs decorative pets, and contains an interceptor prompt bar. These behaviors conflict with an optional, user-directed collaborator.
- Navigator, tabs, inspector, and primary destinations duplicate each other. Notebook, evidence map, history, exports, source mapper, and verification appear as peer workflows even when they should be contextual or secondary.
- Multiple palettes coexist: beige/green legacy surfaces and the newer charcoal/mineral/violet visual direction. Typography is often 9–11px, below the target reading size.
- The current editor preserves valuable behavior but does not publish selection identity as a stable, typed context for contextual tools.

## End-to-end journey

### Home

Home has one dominant action: **Start research** with a topic input. A meaningful topic is enough to create a durable project and blank working document. **Import document** is secondary. Recent projects open their actual document directly. Search and recency use real project data; the interface contains no invented activity or metrics.

On first use, concise inline copy explains the model: write in the document, inspect and cite sources, and ask the collaborator for help. There is no automatic modal tour.

### Create and import

Project creation saves the topic immediately and opens the blank document. Purpose and prior understanding are optional inline prompts and may be skipped. The researcher can request three to five editable investigation questions, then accept, edit, reorder, or dismiss them. Manual creation works when AI is absent or fails. No word-count, answer-count, or automatic-draft gate may delay the document.

Import preserves document content and citations and opens it in the same workspace. Retrying creation must preserve project identity and the user's input.

### Document workspace

Create, import, resume, reload, and browser refresh all land on the document. The Tiptap editor remains mounted while contextual tools open and close, so selection, undo history, cursor, recovery draft, and pending save are not discarded.

Desktop composition:

1. A compact charcoal rail contains Home, project outline/questions, Collaborator, Sources, Findings, Plan, and Share. History, references, settings, and legacy assignment tools live in a secondary menu.
2. A cool mineral field centers a white, readable paper surface. The document body is approximately 17px with a restrained line length. Title, formatting, truthful save state, focus mode, and export remain immediately available.
3. At most one context dock opens beside the document. Its width may be resized or collapsed, but it never replaces the document.
4. A source can temporarily expand into a split reader. Closing it restores the document selection and scroll position.

Mobile composition uses one readable surface at a time. The document is the default. Context opens as a labelled sheet/tab with an explicit return to the document. Switching surfaces preserves drafts and selection.

Focus mode collapses rail and dock. Leaving focus mode restores their previous state without losing cursor or unsaved content.

### Collaborator

The collaborator is a persistent conversation grounded in explicitly visible context. The default input is free form. **Explain**, **Find evidence**, **Challenge reasoning**, and **Help me plan** are shortcuts that seed an intent, not a required sequence.

Context chips show the active question, current document selection, and explicitly chosen sources. The researcher can remove any chip before sending. CogDoc answers teaching questions directly, then offers one short useful next step. Examples are marked hypothetical. The model/provider and deterministic fallback are represented honestly.

The collaborator may propose a plan, summary, evidence lead, finding draft, or targeted document revision. It never silently edits the document. A document proposal contains the exact selected text, document revision, range, replacement, reason, and provenance. The user previews and explicitly applies it. If the selection or revision is stale, apply is rejected and the proposal remains available for manual use.

No idle event, typing speed, short answer, paste, or disabled guidance implies disengagement. Nudges occur only on explicit request/check or a deliberate user-visible boundary. Dismiss and snooze persist for unchanged context. On failure, the typed request and selected context remain, with Retry and manual alternatives.

### Sources and findings

Sources show a small relevant set and why each may help. Each item distinguishes metadata-only, abstract, researcher excerpt, extracted full text, and transcript availability. “Recommended” does not mean “read,” “credible,” or “supports the claim.” Imports include owned files, URL/manual excerpts, and video links with researcher-supplied timestamps when no transcript is available.

Selected passages may be sent directly to the collaborator with their locator and access basis. A selected document passage may become the researcher's explanation through an explicit action; the user is not forced to retype it into a second form. Source passage inspection and verified citation insertion retain their current provenance behavior.

Findings are project-wide and grouped by question and review state. A finding presents its conclusion or inconclusive outcome, researcher explanation, evidence and locators, uncertainty, limitations, and conflicts together. AI proposals are editable drafts. Only the researcher accepts a current revision or retains it with uncertainty; this review is not an AI truth verdict. The user may stop at findings or explicitly insert a chosen finding into the working document with provenance.

### Share and article artifacts

Share manages export of the working document and optional article composition. A `Document` remains the researcher's working text. A `ResearchArticle` remains a separate artifact created from selected current reviewed finding revisions.

The article surface preserves an editable outline and generated/manual draft history, uncertainty, pinned inputs, review concerns, stale status, and export. Regeneration creates a new version and never overwrites human edits. Nothing publishes automatically and “ready to export” is not a publishability guarantee.

## Integration contracts and ownership

The executable contract lives in `src/lib/document-workspace-contract.ts`.

### Lead/integrator owns

- `src/components/cogdoc/editor-shell.tsx`
- `src/components/cogdoc/collaborator-workspace.tsx`
- `src/components/cogdoc/editor-tiptap.tsx`
- `src/components/cogdoc/editor-toolbar.tsx`
- `src/components/cogdoc/research-work-pane.tsx`
- `src/components/cogdoc/research-navigator.tsx`
- `src/components/cogdoc/research-inspector.tsx`
- `src/lib/store.ts`, existing shared type mutations, and adapters for citation/selection events
- `src/app/globals.css`, `src/app/layout.tsx`, and shared visual tokens

### Home/onboarding lane owns

- `src/app/page.tsx`
- `src/components/cogdoc/dashboard.tsx`
- `src/components/cogdoc/login.tsx`
- `src/components/cogdoc/auth-gate-state.tsx`
- `src/components/cogdoc/onboarding-tour.tsx`
- `src/components/cogdoc/research-kickoff.tsx`
- new entry-only helpers and their tests

It opens a project only through `OpenWorkspaceHandler`: set the selected `Project`, then enter the document workspace. It must not add shell/global styling or a competing editor path.

### Context-dock lane owns

- new dock composition and section components
- conversation, source, finding, plan, and share/article presentation modules it explicitly creates or is assigned
- related provider/API modules that do not mutate the lead-owned shared store/types/api client

It consumes `DocumentDockProps`. It must not mount another editor, dispatch untyped global replacement events, or write global tokens.

Any required change to `store.ts`, `types.ts`, or `api-client.ts` is requested from and made by the lead. Cross-lane UI uses the typed callback contract rather than reaching into Tiptap.

## Typed interaction rules

`DocumentSelectionIdentity` is valid only for one project, document, saved document revision, and exact range/text fingerprint. Empty selection is represented by `null`, not a zero-length fake passage.

`DocumentWorkspaceContext` contains the active question and only sources the user explicitly chose. The UI may suggest adding context, but it does not silently transmit all project material.

`DocumentChangeProposal` is immutable input to preview. The shell decides whether it is current and calls `onPreviewDocumentChange`; only an explicit user action calls `onApplyDocumentChange`. Apply returns `applied` or a recoverable reason such as `stale-selection`.

The editor publishes selection changes through `onSelectionChange` and exposes document commands through a stable handle/callback adapter. Context docks can close without remounting the editor.

## Visual system

The approved reference is `exec-6384f8a5-de70-4082-be69-6223fe7abb51.png`, used for direction rather than fictional content. Shared runtime tokens live in `src/app/globals.css`; font registration and global metadata live in `src/app/layout.tsx`. Feature lanes must consume semantic tokens/classes rather than introduce a parallel palette.

- Rail: charcoal, compact, high contrast.
- Workspace: cool mineral background; paper: white; accent: restrained violet.
- Text: Geist for UI and Newsreader for document/editorial material.
- UI text: normally 14–16px; compact metadata never below 12px. Document body: approximately 17px/1.75 with a 68–72ch measure.
- Surfaces use fine cool borders and limited, tinted shadow. Avoid nested dashboard cards, gradients, fake metrics, and decorative imagery.
- Controls have visible hover, pressed, disabled, loading, error, and focus states. Motion uses opacity/transform, remains subtle, and is removed under `prefers-reduced-motion`.

## Acceptance

The redesign is complete only when the configured launch path exercises the real implementation:

- Start with a topic, skip optional questions, and arrive in a blank editable document with a durable project.
- Import and resume open the original content/citations in the same visual system.
- Refresh preserves the document, question, source selection, collaborator thread, focus/dock preference, and truthful save state.
- Select text, open the collaborator, inspect/remove context chips, request help, preview a scoped revision, and explicitly apply it without remounting the editor.
- Reject a stale revision rather than replacing a changed passage.
- Open a source/passage, preserve its actual access/locator basis, insert a verified citation, and return to the previous document position.
- Save and review a finding, see uncertainty and evidence together, and optionally insert that chosen finding into the document with provenance.
- Open Share, export the working document, and inspect/edit a distinct article artifact without implying publication.
- Provider/save/source failures preserve user input and offer retry/manual continuation.
- On a narrow viewport, the document and dock are each readable with a clear return path.
- Keyboard focus is visible and restored; save/error state is announced; reduced motion removes nonessential animation.

Verification must distinguish targeted automated tests, build/type results, browser inspection, mocked providers, and live-provider behavior. Final manual UAT belongs to the user and cannot be claimed from implementation checks.
