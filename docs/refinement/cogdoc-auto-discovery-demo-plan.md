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

## Interactive demo mode revision

The basic floating checklist is replaced by a versioned, deterministic tour that operates on the real editor shell and research dock.

### Experience architecture

1. A prominent **Try interactive demo** action on Home creates a client-only, tagged sample project. It does not call workspace, provider, AI, worker, or review APIs.
2. The existing Tiptap editor remains the writing surface. Demo-only imperative controls reveal text in paced chunks, select the exact passage, apply a reviewed replacement, and insert the sample citation.
3. The existing navigator and dock remain mounted. A demo adapter supplies deterministic source, collaborator, engine, finding, article, and export states inside those surfaces.
4. A target-aware overlay finds stable `data-demo-target` attributes, scrolls the real control into view, draws a click-through spotlight, and positions an accessible coach card within the viewport.
5. Expected real clicks advance steps. **Show me** performs one bounded scripted action. Pause cancels typing, Back restores the deterministic snapshot for that stage, and Escape exits without changing normal projects.

### Ordered action coverage

| Moment | Real target | Observable state change | Test |
| --- | --- | --- | --- |
| Start | Home demo button | Isolated sample project opens | creation/isolation |
| Frame | document surface | Topic, goal, and question explained | target resolution |
| Write | Tiptap editor | Draft visibly grows; pause/resume works | timer cleanup/content |
| Plan | Plan control | Prefilled questions appear | expected click |
| Discover | Sources control | queued, searching, then three fixture leads | deterministic transition |
| Inspect | source card | Verified identity and labelled sample excerpt open | provenance boundary |
| Cite | evidence action | Sample citation appears in real document | editor content assertion |
| Collaborate | Collaborator control | Sample request and response appear | no network assertion |
| Intervene | four engine controls | Each role produces a labelled question/result | engine sequence |
| Revise | preview/apply controls | Selected passage changes through existing preview | stale-safe apply |
| Find | Findings control | Rationale, uncertainty, and limits fill; review remains explicit | review state |
| Compose | Share control | Article outline and draft appear from sample finding | eligibility state |
| Export | Markdown button | Explicit user click downloads meaningful sample file | Blob/download |
| Finish | completion coach | Replay or return to own research | persistence/reset |

### Safety boundary

- Every simulated response, excerpt, engine result, finding, and article is visibly labelled sample material.
- Publication titles, DOI values, and URLs come from the verified demo fixture. The excerpt is a labelled demonstration paraphrase, not a quotation.
- Normal projects retain their existing live API behavior. The demo never creates jobs, attachments, findings, reviews, or exports in the database.
- Autoplay never downloads. Export requires a direct researcher click.
