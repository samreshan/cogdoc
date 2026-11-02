# Live guided research

## What changed

Home now offers **Try guided research — live tools** as the primary demo entry. It prefills an editable Java/Kubernetes topic and goal in the normal research form. Start writing creates a real database-backed workspace, using the configured provider and the normal source discovery, editor, collaborator, intervention, findings, article, and export implementations. There are no canned AI replies or fake source passages in this mode. The explicitly named **Watch offline example** remains a separate, deterministic simulation.

## Interaction contract

- A brief explanation and nonblocking target outline appear. After eight seconds, both give way to a small guide control. Try it myself dismisses them immediately; Show guidance reopens them; Keep explanation open supports slower reading. Escape collapses the guide.
- The guide never clicks tools, replaces writing, restores fictional snapshots, auto-reviews findings, or generates an article on the user's behalf.
- Real successful actions record completion by workspace, regardless of the order or whether guidance is collapsed. Reopening the workspace resumes at the first unfinished task, skipping already completed tasks.
- Progress is remembered in this browser's local storage, separately for each real project. It is not synced across browsers. The research itself is saved by the normal backend.
- API failures never masquerade as successful tool results. Metadata-only sources remain metadata-only; users can open originals or add a lawful excerpt. Provider errors retain the real tools' recovery paths.
- The guide is instructional history, not a validity score: completing a tool step means it ran successfully, not that a claim is true or that a finding remains reviewed after later edits.
- Export fetches the actual server-generated artifact; failed responses show an error and do not complete the export task. The browser performs the download only after the user's export action.

## Guided path

1. Home: edit the suggested topic/goal and create a real workspace.
2. Write an initial explanation in the editor; its successful save records progress.
3. Add/select a research question in Plan.
4. Explore automatically discovered source leads or add a source.
5. Choose an available source passage or add a sourced excerpt in Findings.
6. Ask the live AI collaborator a question.
7. Select writing, expand Run an intervention engine, and explore Clarify ownership, Probe reasoning, Check evidence, and Structure argument. Each invokes its normal backend engine.
8. Save a structured finding, then explicitly review the current revision, retaining uncertainty when appropriate.
9. In Share, create an outline or request a real AI draft from reviewed findings.
10. Export the actual working document or article. Continue using the saved project afterward.

There is no required lockstep order. Earlier independent actions count; explanations do not certify evidence or understanding.

## Verification

Focused regression coverage includes out-of-order actions, idempotent completion, workspace isolation, no GET-based fake completion, explicit uncertainty review, export failure, eight-second collapse, reading controls, resume, and live kickoff invoking normal APIs.

Browser smoke testing on localhost:3001 used the real database and configured Gemini provider: Home prefilled topic; real workspace creation; live source results; editable writing saved; real collaborator response before planning; question creation; guide skipped prior completed work; reload and Resume live research retained document/conversation/progress. See final task report for additional checks and limits.

Final validation: 5 focused test files / 20 tests passed; TypeScript, focused ESLint, and the production build passed. Live browser checks also verified Interceptor returning its real pass result, server-backed Markdown export completing, and a 390×844 guide with no horizontal overflow. The browser file itself was not separately inspected on disk; the export helper is covered with actual-response-Blob and failed-response tests. The live source-to-finding-to-reviewed-article sequence was not manually completed during this smoke run; it uses the existing production panels and focused regression coverage.
