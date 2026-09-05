# CogDoc guided demo: supervisor walkthrough

Date: 5 September 2026

Length: 5–10 minutes
Scenario: researcher agency in AI-assisted writing

## Purpose and boundary

This walkthrough demonstrates a document-first research workflow: a researcher frames a stable question, receives bounded source leads, inspects material, records a finding, responds to a reasoning intervention, and makes a separate review decision. It does **not** claim that CogDoc improves cognition, grades, or learning outcomes. The demo source records establish publication identity only. A title, DOI, URL, or abstract is a lead—not inspected evidence.

The prefilled project is optional and isolated. Resuming it preserves edits. **Create another demo copy** makes a fresh workspace and does not delete or overwrite the old one. Restarting the floating guide resets guide progress only.

## Prerequisites and launch

From the saved local project:

```bash
cd /Users/samreshan/Programming/cogdoc-workspace
docker compose --env-file .env.local -f docker-compose.dev.yml --profile full up -d --build
```

Open `http://localhost:3000`. The full profile also starts PostgreSQL, the research background worker, and the retrieval service. The worker is required for automatic engine questions; if it is stopped, writing, source discovery, manual engine controls, and manual collaboration still work, but no background question will appear. Do not display `.env.local` during the presentation. Source providers and the optional Gemini collaborator use the existing local configuration; provider outages are handled as unavailable, not replaced with invented results.

Useful non-destructive checks:

```bash
docker compose --env-file .env.local -f docker-compose.dev.yml --profile full ps
docker compose --env-file .env.local -f docker-compose.dev.yml --profile full logs --tail=80 worker
```

## Timed presentation

### 0:00–1:00 — Create or resume safely

1. On Home, click **Open prefilled guided demo**. If it already exists, click **Resume guided demo**; use **Create another demo copy** for a clean run.
2. Point out the prominent “DEMONSTRATION MATERIAL” notice in the starter document.
3. Narrate: “This is an editable starting position, not an accepted finding. The real document stays central.”

The project includes three stable questions and three verified publication identities:

- UNESCO, *Guidance for generative AI in education and research* (2023).
- Kasneci et al., *ChatGPT for good?* (2023), DOI `10.1016/j.lindif.2023.102274`.
- Bender et al., *On the dangers of stochastic parrots* (2021), DOI `10.1145/3442188.3445922`.

These entries are explicitly marked metadata-only. Open the original before quoting or treating it as support.

### 1:00–2:30 — Stable question and automatic discovery

1. Open **Plan** in the left rail and select: “What does researcher control mean in an AI-assisted writing workspace?”
2. Open **Sources**. A confirmed topic or selected question starts one bounded search across the existing scholarly providers. It does not fire on each keystroke.
3. Show the status banner and any saved suggestions. Explain that results are cached and deduplicated by DOI/URL, at most three are saved for a context, and existing sources survive an empty result or provider failure.
4. If discovery is unavailable, click **Retry discovery** once or use the manual URL/import path. Say plainly that no new lead was found; do not imply coverage.

### 2:30–4:00 — Collaborator and source leads

1. Select the sentence beginning “My starting position…” in the document.
2. Open **Collaborator** and ask: “What evidence would test this idea?”
3. Show the context chips: only the active question, exact selected text, and explicitly chosen source context are sent.
4. If the request asks for evidence, the collaborator can show real provider-backed **Source leads to explore** cards. **Save lead** persists the record; **Explore original** opens the DOI/URL. Neither action turns it into evidence.
5. If AI is unavailable, the request is still saved and the interface says it could not answer reliably. Continue with Sources or the manual tools.

### 4:00–5:30 — Background intervention and valid uncertainty

1. With the worker running, a durable save event—source added, meaningful document revision saved, or finding revision saved—can enqueue one engine question. The collaborator polls for the persisted question; it is not an idle timer or keystroke interruption.
2. Show the engine label and answer field. For the citation prompt, answer: “I have the publication record, but I’m not sure which passage is relevant—help me investigate.”
3. Narrate: “Uncertainty is a valid response. It releases this question but is not counted as evidence and does not review the finding.”
4. If no background question is visible, verify the worker and save one meaningful document edit. Document prompts wait about 15 seconds so rapid saves can coalesce. Do not repeatedly edit just to manufacture prompts; use the manual controls for a deterministic demo fallback.

### 5:30–7:30 — Four intervention engines and a finding

Select a meaningful passage and expand **Run a reasoning engine** in Collaborator. The controls call the existing engines directly and show their real output without editing the document:

- **Interceptor** surfaces uncertainty or a point where fluent wording may outrun support.
- **Socratic Spacer** asks the researcher to explain or test the reasoning.
- **Citation Sentinel** asks for source-content and locator support.
- **Scaffold** structures Claim — Evidence — Limitation — Implication.

Open **Findings**. Record a bounded conclusion in your own words, include uncertainty and limitations, and attach only content you actually inspected with a usable locator. Saving a source is not the same as attaching evidence. If a pending background prompt is tied to this exact finding revision, CogDoc asks for its response before review. Other editing remains available, and newer/unrelated findings are not globally blocked.

Then make the separate review choice: accept, retain uncertainty, request more evidence, or withdraw acceptance. CogDoc never auto-reviews a finding after an engine answer.

### 7:30–9:00 — Optional article and close

1. Open **Share**.
2. If current reviewed findings exist, optionally generate an outline or article draft. Article composition uses reviewed current revisions; it stays separate from the working document.
3. If nothing is eligible, leave the article step undone. That is an honest outcome, not a demo failure.
4. Close with: “Discovery suggests records. Inspection establishes what content was available. A finding connects reasoning to inspected evidence. The researcher makes the review decision.”

## Event and failure model

The automatic path is:

`stable saved event → idempotent ResearchJob → worker selects a bounded gap → persisted collaborator question → researcher response → separate manual finding review`

- Rapid document saves supersede older queued document prompts.
- The worker allows at most one pending engine question per project and discards stale document/finding revisions.
- Source and question identity are stored with the exchange; a finding review gate applies only to the exact affected current revision.
- Provider failure produces an unavailable state. Worker absence produces no background question. Neither condition fabricates evidence, answers, or review state.
- The manual engine controls remain available for a presentation even when the background worker is unavailable.

## Acceptance checklist

- [ ] Home creates/resumes a separate marked demo and can create another copy without deletion.
- [ ] Starter content says demonstration material and no finding is pre-accepted.
- [ ] Selecting a stable question triggers at most one cached discovery cycle; typing does not.
- [ ] Sources show provenance/access state and provider errors honestly.
- [ ] Collaborator evidence requests show actionable real source leads when providers return them.
- [ ] All four manual engine buttons return visible results for selected text.
- [ ] A stable saved event creates at most one durable background question when the worker is running.
- [ ] “I’m not sure—help me investigate” records uncertainty without creating evidence or a review.
- [ ] Only the affected finding revision is gated until that question is answered.
- [ ] Review remains an explicit researcher action; article composition uses reviewed current revisions only.

## Known limitations

Live source results vary by provider availability and ranking. Metadata and abstracts can be incomplete; full text may require lawful access outside CogDoc. The deterministic background policy identifies missing workflow fields, not truth or cognitive quality. The demo is an interaction walkthrough, not an evaluation of educational effectiveness.
