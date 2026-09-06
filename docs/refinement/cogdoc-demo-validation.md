# CogDoc interactive demo validation

Date: 6 September 2026

Base commit: `0d72bdeab59236e90a636b142cb917abc0b4a50b`

Scope: the deterministic, client-only **Try interactive demo** path. This run did not use Docker, Gemini, source providers, the database, or a real user project.

## Automated checks run

The following commands were executed from `/Users/samreshan/Programming/cogdoc-workspace` with 33 GiB free on the macOS data volume.

```text
npm test -- --run src/lib/interactive-demo.test.ts src/components/cogdoc/interactive-demo-tour.test.tsx src/components/cogdoc/document-research-dock.test.tsx src/components/cogdoc/research-kickoff.test.tsx
```

Result: **4 test files passed, 21 tests passed** in 2.59 seconds. The run printed the existing localStorage experimental warning and three mocked `localhost:3000` source-fetch 404 diagnostics; exit status was zero.

After the browser-found fixes and added regressions:

```text
npm test -- --run src/components/cogdoc/interactive-demo-tour.test.tsx src/components/cogdoc/research-kickoff.test.tsx
```

Result: **2 test files passed, 16 tests passed** in 2.43 seconds.

The final canonical rerun after all fixes and regressions used the original four-file command and passed **4 test files, 23 tests** in 2.51 seconds.

The following checks also passed with no diagnostics:

```text
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/eslint src/components/cogdoc/research-kickoff.tsx src/components/cogdoc/research-kickoff.test.tsx src/components/cogdoc/interactive-demo-tour.tsx src/components/cogdoc/interactive-demo-tour.test.tsx src/components/cogdoc/interactive-demo-dock.tsx src/components/cogdoc/editor-shell.tsx src/lib/interactive-demo.ts src/lib/interactive-demo.test.ts
git diff --check
```

No full test suite or production build was run for this validation.

## Browser walkthrough

A fresh Next.js 16.3.3 development server was started from the saved checkout on `http://localhost:3001`. The browser loaded the current source rather than an older build. An isolated in-app browser tab was used.

The following journey was completed through real rendered controls and observable state changes:

1. Home showed **Try interactive demo**. The topic was visibly written character by character and the goal word by word before **Start writing** opened the isolated sample.
2. The real editor mounted, paced writing increased the document from its opening state to the deliberately broad claim and explanation, and the coach advanced only after writing completed.
3. Displayed step 8 opened **Plan** and showed the Java/Kubernetes topic, goal, and three questions.
4. **Sources** replayed searching and ready states, then showed the Dev.java, Kubernetes Deployments, and Kubernetes Service official identities and links.
5. Displayed step 13 presented the passive reader explanation with **Next**. Displayed step 14 separately highlighted **Use this sample passage**. The citation was then inserted into the actual document.
6. **Collaborator** produced its labelled deterministic answer and documentation lead. Interceptor, Socratic Spacer, Citation Sentinel, and Scaffold each produced distinct visible output.
7. **Use sample answer** populated the response and **Record response** advanced the journey. The response was visibly distinct from evidence and review.
8. The broad claim remained unchanged in the revision preview. **Apply change** then replaced it with the narrower wording in the document.
9. **Findings** filled conclusion, explanation, and limitation fields. **Retain with uncertainty** was a separate explicit action.
10. **Share** composed the labelled article. Displayed step 31 used **Next** to reach the manual-only export step; there was no **Show me** export control.
11. Only an explicit click on **Download sample Markdown** produced the UI acknowledgement and completion card. **Start my own research** returned to the normal empty Home form without demo-only fields or coach state.

Reload/resume was exercised in the editor and restored the saved step and surrounding Plan state. Back restored the preceding Plan action step. Escape hid the coach and Resume restored it. The timer behavior is additionally covered by regressions for Back, hidden-coach actions, and a native Escape event arriving before React effect cleanup.

At a temporary `390 × 844` viewport, displayed steps 31 and 32 kept the coach, article, and download control visible and usable. The viewport override was reset after the check.

## Browser-found fixes

- The Home topic textarea had an HTML `id` but lacked the `data-demo-target="research-topic"` hook used by the spotlight resolver. This made the first coach step report its visible field as missing and disabled **Next**. The hook and a focused Home regression were added.
- Pending expected-action timers now consult an open-state ref synchronously. Escape and the close button set the ref before React state/effect cleanup, preventing a queued or newly dispatched action from advancing a hidden coach. Resume and replay restore the ref deliberately. A focused native-event regression covers the pre-cleanup interval.

## Export evidence and limitation

The browser visibly acknowledged **Sample Markdown downloaded by your explicit action** and advanced to **Interactive demo complete** only after the manual click. The in-app browser did not expose a Playwright download event or persist an inspectable file in `~/Downloads`, so this run does **not** claim an independently retrieved browser file.

The targeted fixture test separately verified that export creates a Markdown `Blob`, invokes exactly one anchor click only when requested, and that the generated content contains the simulation label, revised explanation, limitation, and three official documentation links. This is strong implementation evidence, but it is recorded separately from browser-file retrieval.

## Result

The complete 32-step simulated journey was traversable after the two scoped fixes above. The tested path remained isolated from real projects and external services. The only unverified acceptance detail is retrieval and byte-for-byte inspection of the in-app browser's downloaded file outside the page; the export handler and content are covered by the focused automated test.

## Step 13 pointer-stall follow-up

Follow-up date: 6 September 2026

Follow-up base: `0711f69575157dda44b83e8e45609bbfa6daec6a`

A user-reported stall at displayed step 13 was reproduced on the current-source preview with an ordinary pointer path. The source-reader uses a modal Radix dialog. While it is open, Radix sets `pointer-events: none` on the body and restores pointer events only for its dialog content. The coach is intentionally rendered above the dialog but outside that content. Before the fix, live computed styles at step 13 were:

```text
body pointer-events: none
coach pointer-events: none
Next pointer-events: none
```

The card and **Next** button therefore looked available while normal pointer clicks were swallowed. Accessibility activation could bypass the pointer restriction, which explains why the earlier walkthrough did not expose the user's pointer-path failure.

The active coach, hidden-state Resume control, and completion coach are now explicit `pointer-events-auto` interaction layers. Live computed styles with the same modal open became `body: none`, `coach: auto`, and `Next: auto`. An ordinary browser pointer click advanced from step 13 to the separate step-14 evidence action.

Passive explanatory steps no longer disable **Next** when their highlighted target disappears. Advancing still calls the deterministic snapshot restore for the following step: closing the source reader manually at step 13 and then choosing **Next** reopened the reader at step 14 with **Use this sample passage** available and without preselecting evidence. Missing actionable targets use **Show me** to restore their current snapshot before locating and clicking the control.

The final browser checks covered:

- a mixed manual and **Show me** route from Home to step 13;
- ordinary pointer activation at step 13 on a desktop viewport;
- reload/resume directly at step 13;
- Back from 14 to 13 and forward to 14 again;
- step 13 to 14 at `390 × 844`;
- a manually closed reader followed by safe recovery to the unselected step-14 evidence action;
- the revision-preview modal, where the coach's ordinary pointer action successfully applied the reviewed change;
- the remaining journey through finding review, article composition, explicit Markdown export, and completion.

The follow-up targeted command passed **4 files and 25 tests** in 5.53 seconds. TypeScript, focused tour ESLint, and `git diff --check` passed without diagnostics.

Runtime distinction: `http://localhost:3001` is the live Next.js source checkout and contains this fix. `http://localhost:3000` is served by the `cogdoc-full-app-1` Docker container using `cogdoc:local`; its image predates this follow-up source change and must not be used to assess the fix unless it is rebuilt later.
