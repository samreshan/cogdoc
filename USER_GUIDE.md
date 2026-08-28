# Cogdoc — User Guide

*For writers, students, researchers, and examiners.*

Cogdoc is a writing tool that uses AI to make you a better thinker — not a faster typist. It never writes your prose for you. Instead, it reads what you write, identifies weak spots (vague claims, unverified facts, absolute statements), and intervenes with questions, challenges, and evidence.

This guide explains how to use it.

---

## Getting started

1. **Open Cogdoc** in your browser (http://localhost:3000 if running locally).
2. Follow the first-login tutorial. You can reopen it at any time with the **Tutorial** button in the lower-left corner.
3. Create an **Assignment** or **Research** workspace, or import an existing DOCX.
4. Start writing in the editor. The text auto-saves every 1.5 seconds.

That's it. As you write, Cogdoc's four AI engines will analyze your sentences and intervene.

---

## The four AI engines

### 1. Interceptor (amber underline)

**When it fires**: When you use vague language ("basically", "stuff", "literally", "etc") or make absolute claims ("always", "never", "everyone", "obviously").

**What it does**: Reframes your sentence as a Socratic question that forces you to be specific.

**Example**: You write *"AI is basically bad and stuff."*
Interceptor asks: *"What specific evidence supports your claim that AI is 'basically bad'?"*

**Actionable insights**:
- **Rewrite this** — make the claim specific and evidenced
- **Find evidence** — search your library for supporting sources
- **Answer this** — type your answer in the editor

### 2. Socratic Spacer (rose underline)

**When it fires**: When you pause for 2 seconds mid-sentence, or when you write a question.

**What it does**: Asks a provocative question that challenges your assumptions.

**Example**: You write *"AI can replace humans now."* and pause.
Socratic asks: *"If AI replaces human cognition, what unique intellectual capacities remain exclusively human?"*

**Actionable insights**:
- **Answer this** — type your answer in the editor
- **Show scaffold** — get a structural outline for your answer
- **Find sources** — search your library for relevant evidence

### 3. Citation Sentinel (emerald underline)

**When it fires**: When you make a factual claim (sentences containing "research", "study", "shows", "%", "found", etc. — 6+ words).

**What it does**: Verifies your claim against your uploaded research library using RAG (retrieval-augmented generation). Returns a verdict: Supported, Partially Supported, Unsupported, or Insufficient Evidence.

**Example**: You write *"Research demonstrates that AI reduces critical thinking."*
Citation Sentinel retrieves the top-5 most relevant passages from your PDFs and returns: *"Insufficient Evidence — No evidence was retrieved to support the claim."*

**Actionable insights**:
- **Find sources** — search your library for more evidence
- **Rewrite claim** — adjust the claim to match the evidence
- **View evidence** — read the cited passages in full

### 4. Scaffold (sky underline)

**When it fires**: When you write a long sentence (25+ words) or complete a paragraph (press Enter on a new line).

**What it does**: Offers an empty structural outline — Claim / Evidence / Limitation / Implication — that you fill in yourself.

**Example**: You finish a long paragraph and press Enter.
Scaffold returns:
```
- Claim: __
- Evidence: __
- Limitation: __
- Implication: __
```

**Actionable insights**:
- **Apply scaffold** — insert the outline into your draft
- **Answer this** — fill in the blanks yourself

---

## How interventions appear

When an engine fires on a sentence, that sentence gets a **colored wavy underline**:

- 🟡 Amber wavy = Interceptor
- 🌹 Rose wavy = Socratic
- 🟢 Emerald wavy = Citation Sentinel
- 🔵 Sky wavy = Scaffold
- 🁢 Stone wavy = multiple engine types on one sentence

The underline appears about 2.5 seconds after the engine fires (a debounce to avoid interfering with your typing).

**Hover** over an underlined sentence to see a popover with all interventions for that sentence, stacked vertically. Each intervention has its own actionable insights.

The right-side **Action queue** keeps a persistent overview grouped into Evidence checks, Claim clarity, Reasoning prompts, and Structure. Click any item to scroll to and select its underlined passage. From the detail panel you can locate it again, find sources, mark it addressed, or dismiss it.

## Finding sources from your draft

1. Highlight a claim or research question in the editor.
2. Click **Find sources** in the formatting bar. Search begins immediately.
3. Review the scholarly matches. Open the original record before relying on it.
4. Copy the CSL-rendered in-text citation or reference if useful, then verify its metadata.
5. Choose **Save** to keep the bibliographic record in your workspace library.
6. If you have a legal full-text copy, upload its PDF for passage-level evidence checks.

Cogdoc searches OpenAlex first, then Crossref, and uses grounded web search
only when neither scholarly index returns a record. Each result labels its
metadata provider. When `UNPAYWALL_EMAIL` is configured, DOI results may also
show **Open legal copy** with the resolver, repository or publisher location,
manuscript version, and license when those details are available. Citation text
is a suggestion, not an authoritative replacement for your institution's
guidance.

Saved references and indexed full text are intentionally distinct. A saved
record helps organize and format the bibliography; Cogdoc does not claim to
have checked the paper's contents until full text has been uploaded and
indexed.

In **Library → Saved references**, choose **Check registry** to compare a
record with Crossref or DataCite. A registry match is automated evidence about
the metadata only. Choose **I checked the original** only after opening the
source and manually comparing the bibliographic details. Cogdoc records those
two outcomes separately.

## Formatting the document

The editor bar includes paragraph and heading styles, bold, italic,
strikethrough, inline code, bulleted and numbered lists, block quotes,
horizontal dividers, tables, clear formatting, undo, and redo. Intervention
underlines are interface decorations and are not exported into the document.

---

## Uploading research PDFs

The Citation Sentinel can only verify claims if you give it sources to verify against.

1. Click **Library** in the top bar.
2. Click **Upload PDF** (drag-and-drop) or **Paste text** (for web articles or notes).
3. The PDF is parsed, chunked into ~500-token passages, and indexed.
4. Close the Library modal.
5. Now when you write a factual claim and complete it with a period, the Citation Sentinel will retrieve the most relevant passages from your library and verify the claim.

**Tip**: You can paste text from anywhere — a blog post, an e-book, your own notes. Just give it a descriptive filename so you recognize it in the citations.

---

## Exporting your work

Click **Export** in the top bar to download your draft as:
- **Markdown (.md)** — for Notion, Obsidian, GitHub
- **Plain text (.txt)** — for email or simple editors
- **HTML (.html)** — styled standalone page
- **Print / PDF** — via your browser's print dialog

---

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Cmd/Ctrl + B` | Bold |
| `Cmd/Ctrl + I` | Italic |
| `Esc` | Clear selection / close popover |
| `Enter` | New paragraph (may trigger Scaffold) |
| `Shift + Enter` | Line break (no new paragraph) |

---

## Focus mode

Click **Focus** in the top bar to dim all paragraphs except the one you're editing. This reduces visual noise when you're deep in a paragraph and don't want distractions from earlier content.

---

## Stats and History

- **Stats** — see how many interventions each engine has fired, your engagement rate, and citation verdict breakdowns.
- **History** — browse every intervention ever fired on this project, with timestamps and your response (engaged/dismissed).

Both are accessible from the top bar.

---

## Troubleshooting

**"The Citation Sentinel says Insufficient Evidence"**
You haven't uploaded any research PDFs, or the PDFs you uploaded don't contain content relevant to your claim. Open the Library modal and add more sources.

**"No interventions are appearing"**
Make sure you're ending sentences with `.`, `?`, or `!`. The engines only fire on completed sentences. Also check that your AI provider is configured (the Docker wizard handles this on first run).

**"The underlines disappeared"**
If you edit a sentence after it was underlined, the underline may not match anymore. Cogdoc uses fuzzy matching, but major edits can break it. The underline will reappear on the next sentence you complete.

**"The popover disappeared before I could click"**
Move your cursor slowly from the underlined sentence into the popover. The popover stays visible as long as your cursor is over it.

---

## Why Cogdoc works

Cogdoc is based on the principle of **productive friction** — making tasks slightly harder in the short term to improve learning in the long term. Every intervention forces you to articulate your own claim, find your own evidence, or question your own assumptions. The AI never does the thinking for you.

This is the opposite of ChatGPT, Gemini, and Grammarly, which optimize for speed and fluency. Cogdoc optimizes for understanding.

---

*Cogdoc is a Final Year Project by Samreshan Sahani, BSc (Hons) IT, Asia Pacific University, 2026.*
