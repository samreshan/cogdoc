# CogDoc research collaborator product refinement requirements

Status: documentation-only system change request, prepared 5 September 2026. This specification records confirmed product decisions and proposes an implementation contract; it does not claim that the target product is implemented or validated. Implementation has subsequently been authorized for separate coordinated tasks, after these documents are complete, through the [successive sprint prompts](cogdoc-research-collaborator-sprint-prompts.md). No deployment, database migration, or system change is authorized by the creation of these documents.

## 1. Intent and outcome

Refine CogDoc from a feature-heavy research and writing IDE into a topic-first research collaborator that an ordinary person can understand. The researcher brings a question, examines material, explains what they think it means, and develops structured findings with CogDoc's help. The central outcome is a useful, inspectable set of findings, including uncertainty and disagreement. An article is an optional expression of selected findings after review.

The original BSc IT final-year project investigated cognitive offloading and sought to mitigate cognitive atrophy through a tool for thought. Preserve that motivation by supporting source inspection, explanations, reasoning, and meaningful revision. Do not claim that the product prevents cognitive atrophy, proves understanding, certifies authorship, or improves long-term cognition. Those outcomes require evidence beyond software behavior or short usability sessions.

The immediate problem is usability and coherence: even the author finds the current interface complex. Adding a chat box to the existing collection of primary tools would not resolve this. Consolidate the research activity around questions and findings while reusing the existing source, evidence, annotation, editor, export, and audit infrastructure.

### 1.1 Confirmed decisions

| Decision | Binding direction |
| --- | --- |
| D01 | Start with a topic and a brief assessment of purpose, research question, and existing understanding. Unknown answers are acceptable. |
| D02 | Offer an editable question-based investigation plan. Researchers can add, remove, reorder, branch, pause, or revisit questions. |
| D03 | Recommend small purposeful sets of material with an explanation of relevance. Distinguish learning resources from evidence and be honest about inspected content. |
| D04 | Support researcher-owned sources and nonlinear investigation. Questions must advance the work, not act as exams or arbitrary hurdles. |
| D05 | Help with context-specific questions, hints, examples, passages, contradictions, assumptions, and reasoning. Idle time is not evidence of passivity. |
| D06 | Accumulate durable structured findings: question, conclusion, evidence and locators, researcher explanation, uncertainty, limitations, and conflicting evidence. Inconclusive findings are valid. |
| D07 | Reviewed means a particular finding revision has been examined and explicitly accepted by the researcher. AI analysis alone cannot confer review. Review of one finding does not complete the investigation. |
| D08 | Offer both an outline the researcher writes and an AI-generated article draft from selected reviewed findings. AI prose is explicitly accepted at this later stage. |
| D09 | Article assistance must preserve evidence and uncertainty, flag new bridging inferences, avoid invented claims/citations, and require human review. Upstream changes mark affected articles review-needed. No automatic publishing. |
| D10 | Simplify the experience without destroying existing documents, evidence, references, histories, or user changes. |
| D11 | The user wants a substantially more polished, visually appealing interface that remains easy to understand. Greater visual sophistication must not introduce research-flow complexity. |

### 1.2 Proposed defaults and open questions

These choices make the request implementable without treating every design choice as user-confirmed. Defaults can be revised with evidence; changes to D01–D11 require an explicit product decision.

| Area | Proposed default | Open question and decision point |
| --- | --- | --- |
| Initial audience | Individual undergraduate or early-career researcher investigating a bounded, non-emergency question; plain-language interface usable beyond academia | Validate audience fit in Sprint 9 before expanding onboarding terminology. “Collaborator” means human plus CogDoc; multi-user coauthoring is not assumed. |
| Starting scope | English text, an owned PDF or lawful pasted excerpt, one question and one finding | Add additional languages or OCR only after the complete initial journey works. |
| Source batch | Up to three recommendations initially; “Find more” is explicit | Test whether three gives useful choice without overload; never fill quota with poor matches. |
| Investigation guidance | One active contextual question, optional hint and skip controls; user can request more | Measure interruption burden rather than impose answer quotas. |
| Main navigation | Investigate, Findings, Sources; optional Write & share entry after findings exist | Validate wording and discovery in usability sessions. |
| Video support | Save URL and metadata; timestamped manual excerpt if supplied; transcript analysis only when legitimately available | Automated transcript acquisition is an extension dependent on provider terms, access and implementation capacity. |
| Article size | Short article from explicitly selected findings; user chooses audience and purpose | Longer manuscripts and journal templates are later extensions. |
| Retention | Reuse existing workspace deletion/retention controls; state provider processing clearly | Confirm actual hosting and provider retention before deployment, not by inventing compliance promises. |
| Visual foundation | Prefer the existing shadcn-compatible/Radix component foundation for clean, consistent controls and polished interaction states | This is a component preference, not a library migration. Use the approved core reference recorded in §5.1 for final styling. |

### 1.3 Scope and non-goals

Release scope includes a complete topic-to-finding journey; persistent planning and explanations; source access transparency; grounded help; finding review and revisions; the two optional article paths; simplified navigation; safe migration; accessibility; and evaluation materials. A researcher can finish with findings and never create an article.

Exclude autonomous research completion, bulk unattended literature reviews, automatic publication, plagiarism/authorship detection, cognitive scoring, academic grading or acceptance guarantees, mandatory reflection tests, a new reference manager, real-time team collaboration, universal scraping, automatic video transcription, and a complete rewrite of the application. Legacy assignment verification can remain accessible through a secondary route during migration; it must not define the collaborator's workflow.

### 1.4 Current implementation priority

The confirmed near-term priority is a functional prototype. Preserve existing protections and user data, but do not make new production security, authentication, RLS, concurrency, or operational-hardening infrastructure a prerequisite for the prototype. The prototype work still needs the functional product boundary: investigation must not use the old early-draft routes to generate article prose, and an unknown background-job kind must not be reported as completed. Keep existing authorization and data-preservation behavior intact; defer broader hardening, live-RLS validation, multi-tab conflict infrastructure, and production readiness to the post-prototype hardening/release phase.

The smallest useful path is foundation → topic/plan → owned source/explanation/finding → explicit manual finding acceptance. This manual review slice should be demonstrated before expanding discovery or AI-led guidance. The full revision/dependency hardening remains Sprint 6; the coordinator may take its minimum manual review transition earlier without pulling forward its optional AI analysis work. The release requirements below remain required later and are not claims that the prototype satisfies them.

## 2. Evidence and verified current baseline

### 2.1 Research evidence and limitations

The source is the original [investigation report](../../upload/Samreshan_Sahani_NP069749_Cogdoc_IR_Report%20%281%29%20%281%29.docx). Its DOCX body was inspected directly for this request. Section 3.3 describes 33 preliminary questionnaire responses with item-specific missingness. This is requirements evidence about reported practices and attitudes, not a post-build efficacy study or UAT.

The report needs source reconciliation before statistics are reused. Section 3.3.1 contains inconsistent demographic prose and counts; the facts/statistics trust item describes counts and a fraction that do not agree; memory reliance is described with a percentage inconsistent with 15/33 and with a later table; interview language alternates between completed and planned, while the conclusion says three interviews were not completed. Do not select the most convenient value, silently repair charts, or treat planned interviews as participant evidence. Obtain the raw questionnaire export and interview records, record denominator and missingness per item, and document corrections with provenance. If records are unavailable, retain a clearly marked limitation and omit unreliable derived percentages.

[Final report Chapter 5 source](../fyp/final-src/content_ch5.js), particularly sections 5.8–5.9, explicitly distinguishes pre-build questionnaire evidence from outstanding target-user UAT. Historical automated-test counts in that file describe a previous run. They are not evidence that this refinement or the current dirty checkout passes tests. This documentation task did not execute the application, benchmark retrieval, run the test suite, or observe participants.

### 2.2 Inspection basis

Baseline inspected: local working tree based on commit `9bcb1b8`, 5 September 2026, with many pre-existing modified and untracked files. Paths below include current uncommitted implementation. A later agent must inspect the then-current files and diff before coding. No applicable AGENTS.md was found in the repository or ancestor locations inspected. This is not permission to ignore one introduced later.

| Current surface and evidence | Observed behavior or structure | Refinement implication |
| --- | --- | --- |
| [Package manifest](../../package.json) | Next.js 16, React 19, Tiptap 3, Prisma 6, Zustand, Vitest; PostgreSQL schema | Keep the stack. Avoid adding a second client state or document framework without need. |
| [Schema](../../prisma/schema.prisma) | Physical `Project` already serves user-facing workspaces; document/version, PDF/chunks, references, claims/evidence links, notes, annotations, actions, synthesis, jobs, audit, reports and certificates exist | Add explicit research concepts without renaming/deleting Project. Existing `SynthesisFinding` is an AI synthesis point, not yet the reviewed research finding specified here. |
| [Navigator](../../src/components/cogdoc/research-navigator.tsx), [shell](../../src/components/cogdoc/editor-shell.tsx), [work pane](../../src/components/cogdoc/research-work-pane.tsx) | Document-led navigator exposes outline, guidance, sources/source mapper, notebook, evidence map, references, history, writing/export; shell has navigator/work/inspector panes | Recompose around research objects. Preserve useful detail in contextual panels and secondary menus. |
| [Kickoff route](../../src/app/api/research-kickoff/route.ts), [kickoff component](../../src/components/cogdoc/research-kickoff.tsx) | Plan and draft actions exist. Topic minimum is four words; draft requires at least three outline items and three sufficiently long answers | Replace arbitrary word/count gates with persistable topic/question/plan data. Initial answers are not eligibility for article generation. |
| [Dialogue route](../../src/app/api/research-dialogue/route.ts), [AI service](../../src/lib/ai-service.ts) | Four fixed answers, each four-word minimum, lead to generated paragraphs; AI prompts describe “earned drafting” and “demonstrated understanding” | These routes conflict with the confirmed stage boundary. Migrate/retire early drafting behavior and remove unsupported understanding claims. |
| [Guard](../../src/lib/engine-guard.ts), [friction](../../src/lib/friction.ts) | Engine guard applies a heuristic non-generation contract; rejected output becomes a generic question; behavior differs by cadence settings | Introduce explicit server-side operation policy. Neither disabling the guard globally nor leaving article generation subject to blanket rejection is acceptable. |
| [Source discovery](../../src/app/api/find-sources/route.ts) | Current body queries scholarly providers and Gemini in parallel, merges/ranks results, enriches access metadata; comment about fallback order is not a reliable description | Reuse discovery and metadata provenance. Distinguish recommendation rationale from actual reading of full content. |
| [Source helpers](../../src/lib/research-source.ts), [library bridge](../../src/lib/research-source-server.ts) | DOI/URL/hash identity, library links and heuristic quality scores already exist | Preserve deduplication. DOI and metadata completeness do not prove credibility or claim support. |
| [Source content route](../../src/app/api/workspaces/[id]/sources/[sourceId]/content/route.ts), [source mapper](../../src/lib/source-mapper.ts), [retrieval](../../src/lib/retrieval.ts) | Existing source content and passage retrieval seams; optional FastAPI vector service | Reuse passage access, but validate ownership and source revision at every new evidence attachment. Manual source/excerpt flow must survive retrieval outages. |
| [Synthesis route](../../src/app/api/workspaces/[id]/syntheses/route.ts), [grounding validator](../../src/lib/research-grounding.ts) | Explicit author request plus owned passage IDs; validator checks nonempty text and passage membership | Useful building blocks. ID membership does not establish entailment; absence of passages must be representable for an honest inconclusive research finding. |
| [Jobs](../../src/lib/research-jobs.ts), [retry policy](../../src/lib/research-job-policy.ts), [worker](../../scripts/research-worker.mjs) | Durable jobs, idempotency keys, leases/retries; clerical jobs and synthesis infrastructure | Reuse for slow operations with revision snapshots and cancellation. Do not run autonomous reasoning/article jobs without researcher action. |
| [Content conversion](../../src/lib/document-content.ts), [editor](../../src/components/cogdoc/editor-tiptap.tsx) | Stored ProseMirror JSON with legacy HTML compatibility despite stale schema comment describing HTML | Preserve canonical content and citation nodes. Do not blindly convert every stored document. |
| [Workspace server](../../src/lib/workspace-server.ts), [auth](../../src/lib/auth-supabase.ts), [private storage](../../src/lib/private-storage.ts) | Shared workspace operations, audit, authentication and storage abstractions | Reuse authorization boundaries; verify new nested IDs belong to the same owned, active workspace. |
| [Engine firing](../../src/lib/use-engine-firing.ts), [analyzer](../../src/lib/content-analyzer.ts) | Existing intervention/cadence machinery includes idle-related logic | Audit triggers; silence alone cannot trigger claims of disengagement or mandatory questions. |
| [Gate script](../../scripts/gate.sh), [release readiness](../deployment/release-readiness.md) | Coverage gate runs TypeScript and Python if FastAPI exists | Run appropriate checks during implementation and report actual results. Existing documentation is not a green build certificate. |

### 2.3 Reuse and gap decisions

Reuse source identity, PDF passages, references, Tiptap, canonical export, audit events, auth, jobs, and the useful parts of interventions. Adapt discovery to questions and content availability, syntheses to assistive proposals, and document revision infrastructure to separate article artifacts. Add durable questions, researcher explanations, finding revisions, review decisions, article input snapshots and dependency tracking.

Do not reuse Claim as the canonical finding: Claim is tied to a document version and does not hold the full reasoning structure. Do not silently promote SynthesisFinding or confirmedByStudent evidence flags into reviewed findings. Do not infer human comprehension from an AI `satisfied` response. Existing facts and research ideas can be explicitly imported as unreviewed candidates with provenance.

## 3. Conceptual model and invariants

### 3.1 Objects and relationships

| Object | Required information | Relationships and rules |
| --- | --- | --- |
| Research workspace | Topic, purpose, existing understanding, scope, owner, lifecycle and revision | Extends Project; contains questions, sources, conversations, findings and optional articles. |
| Research question | Stable ID, wording, why it matters, parent, ordering, state, revision | Belongs to one workspace. Parent forms an acyclic tree; cross-question relations may be separate links. Many findings may address it. |
| Investigation plan | Ordered current questions plus change history | A plan is a research structure, not the article outline or document headings. AI proposal is separate until accepted. |
| Resource | Identity, bibliographic metadata, medium, provenance, availability and content revision | Reuses LibrarySource/WorkspaceSource. A source can support multiple questions and roles; learning/evidence is contextual. |
| Question resource link | Question, resource, role, relevance explanation and rationale basis | A tutorial may teach vocabulary without supplying evidence for a conclusion. |
| Passage or excerpt | Exact text, source revision/hash, locator, acquisition method, verification state | Locators can be PDF page/chunk, section/paragraph, or video timestamp range. Manual excerpts are explicitly researcher-supplied. |
| Research exchange | Question context, speaker, message, referenced passages, suggested next action, model/prompt version when applicable | Human explanations retain original wording and authorship even if AI proposes a paraphrase. Messages do not automatically become findings. |
| Finding | Stable identity, primary question, current revision and review state | Primary durable outcome; optionally links secondary questions without duplicating conclusions. |
| Finding revision | Conclusion or inconclusive answer, researcher explanation, evidence links, uncertainty, limitations, conflicts, origin, revision/hash | Immutable accepted snapshot; edits produce a new revision or save an unreviewed draft. Empty fields distinguish “not considered” from explicitly “none identified.” |
| Finding evidence link | Source/passage revision, locator, excerpt, support/challenge/context role and human interpretation | Role is not an AI truth verdict. A contradiction remains inspectable. Missing original content is visible. |
| Review analysis | Target finding revision and dependency snapshot, concerns, evidence checks, provider and completion state | Advisory. Failed/unavailable analysis does not fabricate a clean result. |
| Review decision | Researcher ID, target revision, accept/revise/investigate/retain uncertainty, acknowledgement and timestamp | Acceptance is explicit and scoped. AI cannot write a human acceptance event. |
| Article | Title, audience, purpose, path, canonical content, revision, status | Separate from findings and legacy Document; manual and generated paths can share editor/export utilities. |
| Article input | Selected finding revision IDs, evidence/metadata revisions, question context, generated policy/model version | Immutable dependency manifest. Unrelated finding changes do not invalidate this article. |
| Article review concern | Location, kind, linked input, unresolved/resolved decision | New bridging inference or unsupported statement cannot disappear merely because generation succeeded. |

Proposed persisted names are design suggestions: `ResearchQuestion`, `ResearchExchange`, `ResearchFinding`, `FindingRevision`, `FindingEvidence`, `FindingReview`, `ResearchArticle`, `ArticleInput`. Sprint 1 must document exact schema choices. Use normalized relations for ownership and revision dependencies; validated JSON is acceptable for bounded payloads, not as a substitute for referential integrity.

Evidence locator precision is part of the contract. The current `PdfChunk.pageApprox` field in `prisma/schema.prisma` is explicitly an approximate/simulated page number; it must not be displayed or exported as an exact printed page. Record locator type, precision and origin. Rechunking may change passage IDs: preserve source/content fingerprints, invalidate unresolved anchors and never silently attach an old quote to a new chunk. User-confirmed external locators remain labeled as user-confirmed, not machine-verified. Workspace unlink and library deletion are distinct operations with different impact.

### 3.2 Finding state transitions

Separate answer disposition (`tentative`, `supported_with_limits`, `inconclusive`) from review state. A reviewed inconclusive answer is coherent; “reviewed” does not mean “supported.”

| Event | Before | After | Required behavior |
| --- | --- | --- | --- |
| Save explanation or candidate | No finding | Draft revision | Persist incomplete work. No minimum word count or AI pass score. |
| Request analysis | Draft or review-needed | Same review state; analysis pending | Pin revision/dependency hash. Researcher can continue editing. |
| Analysis completes | Pending | Advisory result attached to target snapshot | If inputs changed, mark result outdated and do not apply it as current. |
| Researcher edits | Any current revision | New draft revision | Retain older accepted snapshot and mark dependencies stale where applicable. |
| Explicitly accept | Draft/review-needed with required fields addressed | Reviewed revision | Record researcher decision on exact current snapshot; reject stale acceptance with conflict response. AI analysis is optional assistance, not a mandatory pass gate. |
| Retain with uncertainty | Draft/review-needed | Reviewed revision with recorded uncertainty | Researcher must state what is unresolved; inconclusive with no available evidence is allowed and identified. |
| Evidence content, locator, relevant metadata, or question meaning changes | Reviewed current finding | Review-needed | Retain review history and explain exactly what changed. |
| Withdraw acceptance | Reviewed | Review-needed | Record the researcher withdrawal; dependent articles become review-needed and the prior acceptance remains historical. |
| Archive | Any | Archived | Remove from active selection, retain history; affected article dependencies need review. Restore does not magically reinstate current acceptance. |

A minimally reviewable finding has a question, answer or explicit inconclusive outcome, the researcher's explanation, evidence entries or an explicit evidence-unavailable statement, and addressed uncertainty/limitations/conflicts. “No conflicts identified” is a valid explicit statement, not proof of exhaustive search. An empirical claim presented as established cannot use an evidence-gap declaration as substitute support: attach evidence, revise it to tentative/inconclusive, or retain it as an unreviewed hypothesis. An absence-of-evidence finding records the search scope and material examined; it must not imply universal nonexistence. Personal observation may be recorded with its actual basis and must not masquerade as published evidence. The server checks structure and current revision, not whether the researcher is smart enough to proceed.

### 3.3 Workspace and article states

Workspace states are proposed as `exploring`, `paused`, `concluded`, `archived`, separate from existing verification lifecycle. The researcher can conclude with unresolved questions and reopen later. No automatic research-complete percentage based on question answers or source opens.

Article states: `outline` or `draft` → `review_needed` → `ready_to_export`, with generation job state tracked separately (`queued`, `running`, `failed`, `cancelled`, `completed`). A generated result always begins review-needed. Partial streamed output is explicitly partial and cannot be accepted as a completed artifact. Editing article text must invalidate or recheck mappings for changed claim spans/sections; an old evidence map cannot silently attach to a new substantive statement. A manual draft also requires explicit readiness acknowledgement to appear ready. Editing ready content returns it to review-needed. “Ready to export” means researcher-reviewed expression, not publishable quality or external acceptance.

Withdrawing acceptance of a selected finding, changing any selected finding revision, relevant evidence/locator/metadata, removing a selected source, or changing the meaning of a dependent question marks affected articles review-needed with a change list. Preserve old article content; never regenerate over human edits automatically. At generation start capture input versions, at completion recheck, and at export recheck again. If inputs changed during generation, keep the result as an outdated draft and explain why. Late worker completion cannot overwrite a cancelled job or a newer article revision.

Raw draft export may remain available with explicit status and unresolved issues included; readiness is not a prohibition on downloading one's work. Export must never claim certification. No publishing endpoint or public share is invoked automatically.

## 4. Experience and flows

### 4.1 First complete journey

Use a bounded example such as “How might campus library hours affect students' ability to study?” This is an illustrative research task, not a claim about actual students.

1. On the dashboard choose “Start research,” enter a topic, and save immediately. Ask what the researcher wants to understand or decide and what they already think. Allow “I'm not sure yet”; retain partially completed responses across reloads.
2. Propose a small editable set of questions with a purpose for each. Researcher narrows to one question, accepts it, and can keep the rest for later. Initial planning does not produce an article or conclusions.
3. Open the question's workspace. Offer “Add a source” and, when available, “Find useful sources.” Show a few recommendations with role, relevance, provenance and availability. The first implementation can use one owned source without live discovery.
4. Open a real passage with a locator. The reader can move between the source and their explanation without losing text. Opening the passage records an interaction only; it does not mark it read or understood.
5. Researcher explains a provisional answer. CogDoc can ask, for example, “Does this passage show that opening hours caused the difference, or only that they occurred together?” The question must cite the actual explanation/passage that prompted it. A synthetic example must be labeled as an example, never evidence.
6. Researcher revises or retains their view, attaches supporting/challenging passages, and saves a finding. Show the finding alongside the conversation and the question it addresses. User can also save “This evidence does not yet answer the question” with a reason.
7. On request, inspect the finding for claim/evidence fit, missing reasoning, limitations and contradictions. The researcher accepts that revision, revises, seeks more evidence, or retains uncertainty. Review is not a test to unlock the rest of the product.
8. Stop with findings, investigate another branch, or choose selected reviewed findings for optional article work. At no point is a fixed number of questions or sources mandatory.

### 4.2 Returning and branching

A returning workspace shows the active question, last saved explanation, current findings and one useful continuation, not a dashboard of diagnostic scores. Selecting a different question preserves unfinished explanations. Branching creates a new stable question with a parent relation; moving questions preserves IDs and linked findings. Deleting a populated question means archive with clear impact, not cascading destruction. Rewording that changes the research meaning requires linked findings to be reconsidered; purely cosmetic edits can be classified as such with a recorded reason.

A researcher can bring an existing document or library source first, then choose the question it informs. Imported notes remain notes until explicitly incorporated. Existing project documents remain available under “Existing writing”; no automatic conversion to reviewed findings or a researched article.

### 4.3 Help when stuck and targeted interventions

Intervene on meaningful events: the user asks for help; submits an explanation for feedback; attaches potentially conflicting evidence; requests finding review; or asks what to investigate next. A saved contradictory assertion can produce one unobtrusive suggestion. Background typing analysis must not continually interrupt the reader.

Each intervention carries target question/finding revision, relevant explanation or excerpt, why it might help, and an actionable next step. Offer “Show a hint,” “Explain this passage,” “Give an example,” “Find a different perspective,” “Save for later,” and “Continue without this.” These actions are affordances, not six mandatory buttons on every message. Default to the most relevant one or two.

Deduplicate by target revision and concern. Suppress repeated prompts after dismissal unless evidence or the explanation materially changes. A single unresolved concern can remain in context; do not escalate through endless follow-up questions. When the explanation is adequate for the stated scope and no useful concern is identified, say so briefly or offer to save the finding; do not manufacture a challenge. User-requested clarification can continue as long as useful. Never interpret inactivity, fast typing, short explanations, pasted material, or disabled guidance as proof of poor cognition or misconduct.

### 4.4 Optional article paths

The entry describes two equal choices: “Make an outline and write it myself” and “Draft an article from these findings.” Select reviewed current findings, intended audience and purpose. Selection need not include every question; preview the included scope and outstanding uncertainty.

For the manual path, provide an editable outline that maps sections to selected findings. The researcher writes the prose; optional structural suggestions require an explicit action. Reuse source citation insertion and export. There is no requirement to use AI to complete this path.

For the generated path, fetch selected reviewed snapshots on the server, construct a bounded evidence manifest, and create a new editable draft. No client-supplied “reviewed: true” flag is trusted. Preserve tentative language, source locators, disagreements and limitations. Label new connective interpretations for researcher review and distinguish them from supported conclusions. If selected material is only inconclusive, generate an account of uncertainty and evidence gaps, not a definitive answer.

Show provenance and a compact review list before readiness acknowledgement. The researcher can accept, edit, remove a proposed inference, or return to a finding. They can rerun generation into a new draft with comparison; never replace their edits silently. Explicit export downloads the chosen artifact. Nothing publishes it.

### 4.5 Failure and recovery matrix

| Situation | Visible state | Recovery and persistence |
| --- | --- | --- |
| Empty workspace | Topic field and one sentence describing findings | Manual creation works without AI. |
| Vague topic | Suggest a narrower question, allow user wording | No arbitrary four-word gate; blank/oversized input validation remains. |
| AI planning unavailable | Plain template labeled as a template | Save/edit questions manually; keep previous proposal. |
| Discovery returns zero | “No useful matches found” with query context | Refine question, upload or paste own material; distinguish zero hits from provider outage. |
| Some providers fail | Display available results and partial availability notice | Retry failed providers without losing selections or duplicating library entries. |
| Metadata-only/paywalled item | “Full text not available in CogDoc” | Open lawful external link or attach lawful copy; do not fabricate a passage. |
| Parse/indexing job runs | Saved source with pending text/index status | Work on another source; text extraction and vector indexing statuses are separate. |
| Corrupt/scanned PDF | Saved metadata plus extraction error | Replace with accessible text or manual excerpt; no fake ready state. |
| Video lacks transcript | URL/title if known, transcript unavailable | User supplies timestamped notes; AI cannot claim to have watched it. |
| AI feedback invalid/unavailable | Analysis failed, saved human work visible | Retry explicitly or review manually with “AI analysis unavailable” recorded. |
| Save failure/network loss | Unsaved indicator and recoverable local draft scoped to user/workspace | Retry; warn before losing text; don't claim saved or silently overwrite server state. |
| Two tabs edit same revision | Conflict with server and local versions | Compare, reload or save as a new revision; no last-write-wins loss. |
| Source changed/deleted | Affected findings/articles show review-needed and missing provenance | Relink/replace or retain explicit limitation; historical snapshot retained subject to deletion policy. |
| Job timeout/cancel/retry | Accurate terminal or retryable status | Same idempotency key does not create duplicate findings/articles; failed payload is not accepted content. |
| Workspace archived/deleted during a request | Operation rejected; no resurrection | Return to workspace list; retain draft recovery where lawful and appropriate. |
| New interface disabled | Existing workspace routes still usable | No schema rollback that drops new research work. |

## 5. Information architecture and accessibility

Default workspace header: topic/title, saved state, and compact project menu. Main area: selected question, source/explanation interaction, and a visible findings summary. On wide screens findings can sit alongside the conversation; on small screens use explicit accessible tabs with preserved drafts and selection. The UI must answer “What am I investigating?”, “What can I do next?”, and “What have I found?” without requiring knowledge of engines, chunks, priority factors or certificates.

Proposed main destinations are Investigate, Findings and Sources. Write & share is optional once findings exist. Place references within Sources and article citation tools; notes within questions/sources; evidence map within a finding's evidence details; history within an activity menu; review concerns within the affected finding. Legacy verification/assignment tools remain in a secondary workspace menu until a separate retirement decision. Remove certification calls to action from the collaborator journey, without deleting historical certificates.

Keyboard users must be able to start research, edit/reorder questions without dragging, open/close a passage, enter an explanation, save/review a finding, choose article inputs and export. Preserve focus when panels close and announce save/job/error status through appropriate live regions without reading every streaming token. Use visible labels, text status in addition to color, accessible headings and errors connected to fields. Test at 200% zoom and a narrow viewport; primary actions must not require hover. Support reduced motion, adequate contrast and comfortable body text. These are proposed accessibility targets to validate, not a claim of audited standards compliance.

### 5.1 Visual quality and direction selection

The user finds the current UI and initial mockups insufficiently polished. The desired result is visibly more refined and appealing, with deliberate typography, spacing, hierarchy, source reading, findings presentation and coherent interaction states. Prefer the existing shadcn-compatible components and Radix primitives in `src/components/ui/` as the implementation foundation; reuse and refine them rather than initiating a component-library migration. Library choice alone is not evidence of design quality.

Visual implementation must preserve clear primary actions, progressive disclosure, readable evidence and an obvious connection between a question, explanation and finding. Assess representative empty, populated, loading, error, review-needed and narrow-screen states against the selected visual reference. Do not make the product look advanced by adding panes, controls, badges, decorative dashboards or excessive animation.

The approved core reference is [the generated workspace image](/Users/samreshan/.codex/generated_images/01a070a2-eaee-7a01-a233-a5e8c06effff/exec-6384f8a5-de70-4082-be69-6223fe7abb51.png). Its approved direction is a charcoal navigation/sidebar beside a light mineral workspace, restrained periwinkle/violet accents, refined but legible typography, and shadcn-compatible controls. Keep the question contextual, place sources to the left of reasoning where the layout permits, and retain a visible findings strip. Translate only the layout and styling direction: fictional topics, source labels, claims and citations depicted in the image are not product content.

The related [planning image](/Users/samreshan/.codex/generated_images/01a070a2-eaee-7a01-a233-a5e8c06effff/exec-ed08c0a9-5c76-42de-b9fd-0da1a00584f5.png) and [findings image](/Users/samreshan/.codex/generated_images/01a070a2-eaee-7a01-a233-a5e8c06effff/exec-a28945c3-250c-4f9e-9744-8724c38cd834.png) are consistent extension references, not independently approved specifications. Earlier mockups are superseded. Record the core reference/version in the Sprint 8 handoff and assess representative states against it; passing component tests alone does not constitute visual approval.

## 6. Requirements and observable acceptance criteria

P0 means necessary for the coherent collaborator release. P1 is useful after the core journey or a later capability within this release. “Owner sprint” identifies delivery responsibility, not a date. Later integration may verify requirements owned earlier.

| ID | Priority / owner sprint | Requirement and observable acceptance |
| --- | --- | --- |
| RC-01 | P0 / 1 | Record baseline and additive architecture. A migration rehearsal preserves counts, IDs, document hashes and relationships in representative legacy data; pre-existing changes remain intact. |
| RC-02 | P0 / 2 | Persist topic, purpose and existing understanding, including explicit unknowns. Reload restores input and a short meaningful topic is accepted without a word-count test. |
| RC-03 | P0 / 2 | Persist editable questions and plan with stable IDs. Add/reorder/branch/archive works; cycles and cross-workspace parents are rejected; linked findings survive moves. |
| RC-04 | P0 / 2 | Manual planning fallback remains useful during provider failure. AI plans are proposals; accepting a plan does not create final prose or imply understanding. |
| RC-05 | P0 / 4 | Recommend a small set for a selected question with relevance rationale, contextual role and rationale basis. Partial outage and zero useful results are distinct; no quota-filling fabricated sources. |
| RC-06 | P0 / 3 | Show availability and provenance for metadata, abstract, excerpt, extracted full text and transcript separately. A metadata-only result cannot be shown as inspected evidence. |
| RC-07 | P0 / 3 | Import/reuse owned source and locate a passage. Same source does not duplicate library identity; question links can differ; foreign source IDs are rejected. |
| RC-08 | P1 / 4 | Save a video resource and manual timestamped excerpt; clearly label absent transcript. No full-video analysis claim without accessible analyzed content. |
| RC-09 | P0 / 3 | Persist researcher explanations in question context and original wording. Saving or refreshing does not replace them with AI text; explicit incorporation of suggestions records origin. |
| RC-10 | P0 / 5 | Contextual help responds to evidence/reasoning and supports hints/skip/snooze. A dismissal suppresses repeats for unchanged context; idle alone produces no intervention or passivity label. |
| RC-11 | P0 / 3 | Create/edit durable structured finding including limitations, conflicts and uncertainty. Incomplete drafts save; an inconclusive finding with explicit evidence gap is representable. |
| RC-12 | P0 / 3 minimum acceptance; 6 hardening | Finding review is explicit, revision-specific and researcher-owned. Sprint 3 demonstrates the minimum manual acceptance path; Sprint 6 adds stale-revision handling and full revision/dependency hardening. AI success alone never sets reviewed; retained uncertainty stays visible. |
| RC-13 | P0 / 6 | Detect relevant question/evidence/finding changes and invalidate affected review state. Unrelated edits leave unrelated findings/articles unchanged; change reason is visible. |
| RC-14 | P0 / 6 | Findings remain visible alongside research; workspace completion is separate. Reviewing one finding does not resolve all questions or conclude the project. |
| RC-15 | P0 / 7 | Manual article path maps outline sections to selected reviewed findings and supports human prose, citations and export without invoking AI generation. |
| RC-16 | P0 / 7 | Generated article path validates current reviewed selections on server and produces a separate draft with traceable claims/citations and preserved uncertainty. Unknown/unowned/unreviewed IDs fail before provider call. |
| RC-17 | P0 / 7 | Enforce server-side operation-specific AI policy across old/new routes. Investigation cannot request final article prose through a forged mode; legitimate article drafting is not blanket-blocked. |
| RC-18 | P0 / 7 | Article input manifest drives review-needed state after relevant upstream changes, including changes during generation/export. Human edits survive regeneration; late jobs cannot replace newer drafts. |
| RC-19 | P0 / 7 | Export selected artifact and its bibliography/status accurately. Unsupported/bridging claims are flagged; no automatic publication or claim of journal readiness, authorship or cognitive certification. |
| RC-20 | P0 / 8 | Simplified navigation makes the complete journey discoverable and keeps legacy work accessible. User need not open notebook/evidence-map/history/verification as separate mandatory stages. Final styling is assessed against the approved core visual reference across representative states, using existing shadcn-compatible primitives where suitable. |
| RC-21 | P0 / 8 | Keyboard, narrow-screen, zoom and assistive status flows work through the full journey; defects and manual checks are recorded rather than presumed passed. |
| RC-22 | P1 / post-prototype hardening | Authorization, validation, optimistic concurrency and idempotency protect new data. Foreign nested IDs, stale revisions and duplicate commands are tested at the server boundary. Preserve existing protections during the prototype; complete this expanded hardening before release. |
| RC-23 | P0 / 5 | AI/source content is untrusted. Unknown citations/passages and prompt injection cannot create evidence links, accept findings, or invoke tools/actions outside an allowed operation. |
| RC-24 | P0 / 1 | Feature-controlled additive rollout preserves legacy documents/sources/audit and supports disabling new UI without data deletion or rewriting accepted history. |
| RC-25 | P0 / 9 | Evaluation separates functional correctness, AI grounding, task usability, participant evidence and long-term cognition. Report actual denominators, run versions and unexecuted checks. |
| RC-26 | P0 / 9 | Reconcile investigation statistics/interview status using raw records if supplied; otherwise document unresolved discrepancies. UAT remains outstanding until consented sessions have records. |
| RC-27 | P0 / 9 | Demo shows topic → source → explanation → finding → review → both optional article paths and upstream invalidation. Synthetic fixtures are explicitly labeled. |
| RC-28 | P0 / 8 | Explain provider processing, preserve user control over sensitive text, and follow existing access/deletion controls. No raw research text in routine analytics or logs by default. |
| RC-29 | P0 / 3 | Empty/loading/error/retry/conflict states preserve user input. A provider outage does not prevent manual source/explanation/finding work; a save failure is never shown as success. |
| RC-30 | P1 / 9 | Measure explanation and revision quality plus task success and interruption burden with a documented rubric; do not use clicks, dwell time or word counts as learning proof. |

## 7. Scoped AI contract and trust boundaries

The original blanket no-final-prose position deliberately evolves here. Investigation supports the researcher's thinking; article mode supports expression of research the person has examined. This is a scoped product decision, already confirmed, not an exception agents must seek again. It does not justify drafting from a topic or passing a fixed number of questions.

| Operation | Permitted | Prohibited or requires review |
| --- | --- | --- |
| Plan | Question proposals, scope clarification, sequencing and rationale | Findings invented from the topic; prose presented as completed research |
| Discover | Search queries, metadata-based relevance explanation, accessible-content summaries labeled by basis | Invented references; claiming full-text/transcript inspection from metadata |
| Explain/help | Plain-language explanation, clearly hypothetical example, hints and passage comparisons | Silently authoring the researcher's explanation or using an example as evidence |
| Analyze finding | Reasoning concerns, possible contradictions, suggested narrower conclusion | AI acceptance, comprehension score, truth/authorship certification |
| Propose finding structure | Organize user's explanation into fields, visibly mark suggestions | Automatic reviewed status; erasing original wording or unresolved evidence gaps |
| Manual article | Outline/structural suggestions when requested, citation formatting | Automatic prose insertion |
| Draft article | Grounded prose from selected reviewed snapshots, uncertainty and citation mapping | New factual claims/citations absent from manifest; unlabeled bridging inference; auto-publication |

Implement an operation enum or similarly validated server contract; infer eligibility from persisted objects and endpoint responsibilities. Friction mode is a cadence preference, not authorization. Provider prompts are one defense, not the only enforcement. Parse constrained output, validate referenced IDs and revisions, check citations against an allowed manifest and treat source text as quoted data. Unknown output must produce an actionable error or flagged proposal, not silently become evidence. Do not rely on paragraph-count heuristics to decide semantic correctness.

Article statements should carry a stable mapping to one or more finding/evidence inputs, with bridging concerns separately addressable. A citation existing in the database does not prove support for a sentence. Use deterministic provenance validation plus AI-assisted semantic checks and human review. If grounding cannot be verified, keep text review-needed or reject the unsupported output; never add a fake reference to make validation pass.

Audit the actual current prose-producing surfaces, including `draftResearchKickoff`, `draftFromResearchDialogue`, `restructureFromIntervention`, synthesis jobs, autocomplete, and legacy engine routes. Existing saved drafts remain readable. For collaborator workspaces, old draft actions should return a clear transition response directing the user to reviewed findings/article selection; they must not remain a hidden bypass. Legacy features kept for compatibility must retain their prior bounded behavior and never grant collaborator article eligibility.

## 8. Data and API architecture

### 8.1 Proposed API shape

The following routes are proposed contracts, not claims that files exist. Exact naming may be adjusted in Sprint 1 with a mapping recorded in its handoff.

| Endpoint family | Commands and expected semantics |
| --- | --- |
| `/api/workspaces/:id/research-context` | GET/PATCH topic, purpose, understanding and workspace revision |
| `/api/workspaces/:id/questions` and `/:questionId` | List/create/update/reorder/archive; expectedRevision; parent validation |
| `/api/workspaces/:id/questions/:questionId/resources` | Attach owned library resource with role and question rationale |
| `/api/workspaces/:id/questions/:questionId/exchanges` | Persist human message before optional AI request; speaker origin enforced server-side |
| `/api/workspaces/:id/findings` and `/:findingId` | Create/get/update structured revisions; list filter by question/review state |
| `/api/workspaces/:id/findings/:findingId/analyze` | Explicit asynchronous analysis of pinned snapshot; idempotent request |
| `/api/workspaces/:id/findings/:findingId/reviews` | Explicit acceptance or return-to-investigation decision using expected revision and dependency hash |
| `/api/workspaces/:id/articles` and `/:articleId` | Create manual or generated path; selection includes finding revision IDs; maintain separate article revision |
| `/api/workspaces/:id/articles/:articleId/generate` | Validate eligibility, enqueue bounded generation, return job ID and input hash |
| `/api/workspaces/:id/articles/:articleId/export` | Recheck dependencies and export selected revision/status using existing format utilities |

Mutation envelope: validated input, `expectedRevision` when editing, and idempotency key for creation/slow work. Responses return stable ID, resulting revision/status and machine-readable error code with humane text. Use 400 for malformed input, 401 for unauthenticated, 404 for missing/unowned resources, 409 for revision conflict, 422 for invalid transition/selection, 202 for accepted asynchronous work, and appropriate 429/503 for budget/provider unavailability. Avoid returning cross-tenant existence or raw provider errors.

### 8.2 Persistence and concurrency

All nested resource IDs must be validated against the authenticated owner and current workspace. A user's source from another workspace is not automatically eligible until explicitly attached. Archive/deletion conditions must be checked on reads and writes consistently. Server-generated actor and model metadata must not be accepted from arbitrary client fields.

Commit new finding revision, dependency edges, review invalidations and audit event atomically. For slow work, commit request plus durable job together or use a recoverable outbox; the current synthesis route's separate enqueue step should be assessed rather than copied as a new failure mode. A worker claims a lease, reads the pinned snapshot, validates provider output, then conditionally writes if the job is still applicable. Retry with bounded backoff and a unique request key; never create duplicate article revisions on replay.

Store both source content revision/hash and citation metadata revision. A title typo might require only bibliography review, whereas changed excerpt text or page locator invalidates evidence interpretation. The conservative initial default marks dependent artifacts review-needed for any relevant cited metadata change; refined classification can be added later. Capture question semantic changes in the same dependency model.

### 8.3 Migration and compatibility

1. Inventory data shape and existing migrations before generating a new one. Use a disposable representative database or approved backup copy, never reset the user's live database.
2. Add nullable/defaulted fields and new tables. Preserve Project IDs, legacy lifecycleState, Document content/revision, source IDs/chunks, references, citation nodes, notes, audit hashes and certificate payloads. Avoid using `db:push` or destructive reset as a production migration strategy.
3. Introduce explicit collaborator experience version/feature flag rather than infer readiness from old project state. A legacy `certified` workspace does not imply reviewed research findings.
4. Backfill only safe identity/context mappings. Preserve lineage to original notes/claims/synthesis; any offered finding import is unreviewed and researcher initiated. A previous working document can be linked as existing writing, never falsely labeled as generated from reviewed findings.
5. Keep legacy HTML/ProseMirror parsing compatibility and current citation/export round trips. Article storage must not overwrite the one legacy Document row per Project; select a separate table or a proven versioned artifact abstraction.
6. Rehearse migration twice, record count/hash checks and verify idempotency. Test owned/unowned data, projects without sources, failed jobs, archived/deleted workspaces, and legacy certificates.
7. Roll back application exposure by disabling the new UI/routes as appropriate while retaining additive data. Roll forward schema defects with a corrective migration; do not drop new user work to emulate an old database.

## 9. Privacy, reliability and operating constraints

Send only relevant selected question/explanation/passages to the configured provider. Explain what leaves the application before the user invokes AI and retain a manual route. Source text and pasted instructions are untrusted; do not execute embedded instructions or fetch private/internal URLs from user material. Reuse existing private-storage controls and implement URL/file validation, size limits and safe fetch boundaries where importing external content is added.

Logs should contain request IDs, object IDs, policy/model versions, timing and safe error codes rather than raw documents or explanations. Product analytics are optional and separate from necessary saved research history; no hidden cognitive profiling. Deletion must cover new records, derived content, provider request caches and local draft recovery according to the product's documented retention policy. Do not rewrite historical audit hashes to change terminology. Where privacy deletion removes source text, preserve only permitted minimal lineage and make the evidence unavailable visibly.

Paginate stored exchanges/findings and lazy-load source files; provider context truncation must not truncate durable research history. Cancellation after provider dispatch is best effort: a later fetch resolves actual committed state and cancellation must not promise refunded provider cost. Set bounded input sizes and context budgets at every AI route. Proposed usability target: acknowledge a local save action immediately with pending status, show slow-operation state promptly, and allow cancellation without blocking manual work. Establish measured save and provider latency budgets in Sprint 1/9 based on deployment; do not claim numeric service guarantees without measurements. Degraded mode must support manual planning, sources already available, explanations, findings and manual review.

## 10. Delivery plan and readiness

| Sprint | Demonstrable increment | Must precede |
| --- | --- | --- |
| 1 | Additive domain model, operation boundaries, migration rehearsal and compatibility harness | All new persisted workflows |
| 2 | Topic and editable question plan with manual fallback | Question-focused sources/findings |
| 3 | First complete manual topic → owned source → explanation → structured finding journey | Discovery expansion and sophisticated AI help |
| 4 | Purposeful source discovery, role/access transparency and optional video fallback | Broader source-assisted UX |
| 5 | Contextual reasoning help and structured finding suggestions with control over interruptions | Assisted review experience |
| 6 | Explicit finding review, revisions, dependency invalidation and separate project completion | Both article paths |
| 7 | Manual outline/writing plus grounded article generation, scoped policy and export | Full release candidate |
| 8 | Simplified integrated IA, accessibility, recovery/privacy and legacy access | Human evaluation candidate |
| 9 | Evaluation, UAT materials/results only if actually conducted, demo, accurate report updates | Release decision |

Do not wait until Sprint 8 to make earlier increments usable. Each sprint supplies a narrow working UI and persists its work. Sprint 8 integrates and removes competing primary navigation. For the functional-prototype phase, demonstrate a minimal manual acceptance transition after Sprint 3 before advancing to broad discovery or AI-led guidance; finish the full Sprint 6 invalidation work before article eligibility. Freeze broad extensions until this first loop works. Production hardening is a later release gate, not a current prototype blocker. No mandatory calendar dates or speculative parallel editing plan is implied.

Release criteria: P0 acceptance criteria exercised, no known cross-tenant access/data-loss/policy-bypass failure, successful migration rehearsal, traceable article output, recoverable provider failures, and documented accessibility/usability findings. Outstanding UAT blocks claims of user acceptance; it does not justify fabricating sessions or preventing delivery of clearly labeled evaluation materials. Real deployment requires its own readiness decision.

## 11. Verification and evaluation plan

### 11.1 Functional and migration tests

Use existing Vitest/component/API infrastructure and FastAPI tests where retrieval changes. Test transitions and observable behavior rather than snapshots that mirror implementation. Include nested ownership, stale writes, double submits, plan cycles, archive/restore, source relinking, missing excerpt, changed locator, inconclusive review, changed finding during generation, cancelled jobs and export revision selection. Verify legacy document and citation round trips and additive migration fixture counts/hashes. Run relevant lint/type/build checks and the repository gate as appropriate; report environment failures separately from regressions. Never relax thresholds merely to make the sprint green.

### 11.2 AI and evidence evaluation

Build a small versioned, lawfully usable corpus with annotated questions, passages and expected support limits. Cases must include an adequate explanation needing no further question, irrelevant but plausible sources, opposing evidence, abstract-only records, mismatched page numbers, removed passages, prompt injection, uncertain findings, and an attempted article request during investigation. Deterministic tests validate ID membership and policy eligibility; a human-reviewed rubric checks semantic support and preserved uncertainty. Record provider/model/prompt/policy versions and actual run date. A mocked provider pass is not evidence of live-model accuracy; a live model success is not evidence of user understanding.

For article evaluation, trace every substantive claim to selected finding(s), classify unsupported additions, verify locator and bibliography fidelity, and inspect bridging concerns. Report error counts with denominators, examples and known limits. Do not substitute a single opaque confidence score for inspection.

### 11.3 Usability and human evidence

Prepare a consent script, participant log using pseudonyms, neutral task instructions, observation sheet, assistance log and post-task questions. Proposed first round: at least three intended users for formative discovery, explicitly too small for efficacy claims. Recruit and schedule only with authorization; never manufacture attendance or statements.

Tasks: start a topic; change the plan; add/open a source; explain what it supports; save an inconclusive or qualified finding; respond to or skip one question; explicitly review; choose each article path; identify a changed-source warning; export and explain what reviewed means. Observe where users get lost and whether they can find their saved finding without coaching. Record completion, assistance, errors, recovery, time-on-task and perceived interruption burden. Distinguish participants who received help from unassisted successes.

Proposed interpretation rubric, scored by human reviewers on a documented sample: explanation connects evidence to conclusion (0 absent, 1 assertion, 2 plausible connection, 3 specific bounded justification); uncertainty identifies a relevant limit (0 absent through 3 specific consequence); revision meaningfully changes a claim, evidence link or limitation rather than wording alone. Use double review of a subset and disclose disagreement. These are task-quality measures, not validated cognitive scales.

Source opens, clicks, dwell time, number of questions answered, word count and amount typed are interaction traces only. More friction can indicate harm. Evaluate whether a suggestion helps resolve a real uncertainty and whether the user can decline it. Long-term learning/retention or cognitive atrophy claims require a separately designed longitudinal study and cannot be inferred from this release.

### 11.4 Reporting rules

Update final-report text to distinguish original rationale, implemented scope, tested behavior, participant evidence, and future work. Explicitly document the scoped evolution from blanket non-generation to reviewed-finding article assistance. Preserve the historical investigation report unchanged; corrections belong in a reconciliation note with source provenance. Do not reuse old screenshots, test counts, benchmarks or claims as current evidence without rerunning/verifying them. If no UAT records arrive, provide ready-to-run materials and mark results outstanding.

## 12. Risks and mitigations

| Risk | Mitigation and evidence required |
| --- | --- |
| Simplification becomes superficial chat over feature sprawl | Inspect primary navigation and test the complete task with ordinary users; findings must stay visible and durable. |
| AI prose slips into investigation through existing routes | Central operation policy, route inventory, adversarial endpoint tests and removal of question-count drafting gates. |
| “Reviewed” implies objective truth | Plain-language scoped label, explicit human decision and retained uncertainty; test user interpretation. |
| Source metadata looks authoritative | Separate metadata completeness, access and evidence support; disclose basis and missing content. |
| Findings become another demanding form | Progressive fields, autosaved incomplete drafts, extraction proposals with confirmation, and valid inconclusive outcomes. |
| Unlimited Socratic questioning drives abandonment | User-triggered/contextual prompts, deduplication, skip/snooze and measured interruption burden. |
| Migration destroys a mature but messy prototype | Additive schema, dirty-tree preservation, fixture rehearsal and reversible exposure. |
| Export detaches claims from evidence | Versioned input manifests, citation/locator validation and readiness checks at generation and export. |
| Academic narrative overstates achievement | Reconcile survey discrepancies; separate UAT from requirements; record actual test and participant evidence. |

Dependencies are current authentication/storage correctness, a migration-capable development database, legal source fixtures, optional provider credentials for live AI/discovery, optional FastAPI retrieval deployment, and access to raw survey/UAT records for empirical claims. Missing AI providers must degrade assistance, not disable the manual core.

## 13. Documentation completion boundary

These two Markdown artifacts define the requested refinement and implementation sequence. Their preparation verifies source references, requirement coverage, dependencies and policy consistency, not system correctness. Implementation, migrations, new tests, UAT recruitment, report regeneration and deployment remain future work governed by the sprint prompts and actual execution evidence.

### Canonical reconciliation note

This saved-project pair is the authoritative implementation contract. A separately completed isolated draft was reviewed for useful differences. Its alternate requirement numbering and sprint order are not used here: this pair uses RC-01–RC-30 and the nine-sprint sequence in section 10. Incorporated details include approximate locator fidelity, review withdrawal, adequate-explanation/no-question behavior, article mapping invalidation after human edits, and worktree reference-file preservation. Navigation labels and source batch sizes remain proposed defaults; the two article paths remain required for the complete release. Sprint 3 demonstrates a complete manual loop, including minimum explicit researcher acceptance of a finding. Sprint 6 hardens revision/dependency invalidation before article eligibility. A Sprint 3 pilot remains a functional prototype, not the complete agreed release.
