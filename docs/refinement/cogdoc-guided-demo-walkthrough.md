# CogDoc interactive demo walkthrough

Date: 6 September 2026

Length: 8 to 12 minutes

Scenario: researcher agency in AI-assisted writing

## What this demo proves

The interactive demo is a deterministic, client-only replay of CogDoc's complete research-writing journey. It uses the real editor, navigation, dock layout, source reader, revision preview, and download interaction. Source discovery, collaborator responses, reasoning-engine results, and finding content are stable sample fixtures. They make the product easy to demonstrate without claiming that a live provider or background worker ran.

Every simulated surface says **Simulated** or **Demonstration**. The three displayed publication identities are real and link to their original records. The displayed source passage is explicitly a demonstration paraphrase, not a quotation or fabricated evidence.

The demo never writes to the project API, database, source providers, AI provider, or background-job queue. It never publishes. The final Markdown download occurs only after the presenter or visitor clicks the highlighted export button.

## Launch

Run the application by the project's usual development or Compose workflow, then open Home. No live AI, research provider, retrieval service, or worker is required for this interactive path.

1. Click **Try interactive demo**, the primary action under the Home introduction.
2. The app opens an isolated project named **Interactive demo: researcher agency**.
3. A 27-step coach highlights one real control at a time. The page around that control is dimmed.

The separate **Resume guided demo** action still opens the older saved workspace. Use **Try interactive demo** for the deterministic presentation described here.

## Coach controls

- **Show me** performs the highlighted non-destructive action. The visitor can click the highlighted control directly instead.
- **Pause** stops the paced writing playback. The editor remains usable, so the visitor can take over.
- **Back** restores the exact document, dock, modal, and simulated state required by the previous step.
- **Escape** hides the coach without discarding progress. **Resume demo** brings it back.
- **Exit interactive demo** returns to Home. Progress is versioned in local storage.
- **Replay** resets the isolated sample after completion.
- The answer and final export steps are manual-only. The coach cannot answer or download on the visitor's behalf.

## Presentation route

### 1. Document and paced writing

Introduce the mounted document as the center of the workspace. Continue to **Watch the argument take shape**, then click **Show me**. Words appear at a readable pace in the real editor. Point out **Pause** and explain that a visitor can interrupt playback and type directly.

The starter claim is intentionally too broad: writing speed alone does not establish researcher control.

### 2. Plan and stable questions

Use the highlighted route icon to open **Plan**. Show the prefilled topic, goal, context, and three questions. The primary question asks what researcher control means in an AI-assisted writing workspace. Explain that this stable context would guide real discovery and collaboration.

### 3. Simulated discovery and source inspection

Open the highlighted **Sources** book icon, then run the deterministic discovery replay. It moves through queued, searching, and ready states before showing three verified publication identities:

- UNESCO, *Guidance for generative AI in education and research* (2023).
- Kasneci et al., *ChatGPT for good?* (2023), DOI `10.1016/j.lindif.2023.102274`.
- Bender et al., *On the dangers of stochastic parrots* (2021), DOI `10.1145/3442188.3445922`.

Open the highlighted Kasneci record. The modal distinguishes the verified publication identity from the labelled sample paraphrase. Continue, then choose **Use this sample passage**. This changes the simulated evidence state but does not create or accept a finding.

Click **Insert sample citation**. The real document changes visibly and retains the sample-citation label.

### 4. Collaborator and four engines

Open **Collaborator**, ask the prepared research question, and show the deterministic answer plus a source lead. Explain that the source lead is a direction to investigate, not proof.

Run each highlighted engine:

- **Interceptor** detects when fluent wording takes ownership of the conclusion.
- **Socratic Spacer** asks for the researcher's own explanation.
- **Citation Sentinel** distinguishes a publication record from inspected support with a locator.
- **Scaffold** separates claim, evidence, limitation, and implication.

At **Uncertainty is a valid response**, click **Use sample answer**, then **Record response**. This releases the question; it does not create evidence or review a finding.

### 5. Safe document revision

Click **Show me** at **Preview before changing prose**. CogDoc selects the broad claim in the real editor and opens the real revision preview. The current passage and narrower proposal are both visible.

At **Apply remains explicit**, click **Show me** or **Apply change**. The editor changes only after that action. The revised claim now makes source visibility, inspection, uncertainty, and separate review explicit.

### 6. Finding and review

Open **Findings**. Fill the deterministic sample conclusion, explanation, uncertainty, and limitation. Then use **Retain with uncertainty** as a separate review decision. Emphasize that no engine answer performs this review automatically.

### 7. Article and explicit export

Open **Share**, compose the deterministic article, and inspect the result. It preserves both the simulation label and uncertainty. Continue to the last step, then personally click **Download sample Markdown**. The completion card appears only after that explicit download action.

The Markdown contains a meaningful article, the reviewed sample finding, the verified source identities, the demonstration-paraphrase boundary, and a simulation disclosure.

## Resize, accessibility, and recovery checks

- The coach targets the visible desktop or mobile copy of a control rather than a hidden duplicate.
- It scrolls a target into view and remeasures after resize or layout mutation.
- The coach prefers a position beside the target and falls back above or below it to avoid covering the highlighted action.
- Reduced-motion preference removes smooth scrolling and paced delay.
- Coach progress and status updates are exposed to assistive technology; Escape always provides a quick exit.
- If a target does not appear within a bounded interval, the coach explains how to restore the panel or go Back rather than waiting forever.

## Verification checklist

- [ ] Home prominently offers **Try interactive demo**.
- [ ] Starting the demo performs no project, source, AI, or job API request.
- [ ] The real editor shows paced writing, pause, takeover, citation insertion, and applied revision.
- [ ] Plan contains the prefilled topic, goal, context, and three questions.
- [ ] Discovery visibly transitions and returns only the three stable publication fixtures.
- [ ] Source identity and demonstration paraphrase are visibly distinguished.
- [ ] Evidence selection does not auto-create a finding.
- [ ] Collaborator and all four engines have distinct, deterministic outputs.
- [ ] Answering an engine does not create evidence or review.
- [ ] Revision preview shows before-and-after text; apply remains explicit.
- [ ] Finding fill and finding review are separate actions.
- [ ] Article composition follows the reviewed finding.
- [ ] Export has no **Show me** control and occurs only on the visitor's click.
- [ ] Back, replay, Escape/resume, resize, and missing-target recovery work.

## Known boundary

This is a product-behavior demonstration, not evidence that CogDoc improves learning, cognition, or research quality. Real projects still depend on lawful source access, exact locators, comparison, uncertainty, and researcher judgement.
