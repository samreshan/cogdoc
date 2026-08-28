# ADR-0010: Production research assistance and frictionless UX

**Date:** 2026-08-28
**Status:** Accepted, implementation in progress
**Scope:** editor navigation, source discovery, citation assistance, onboarding, model configuration, and SDG 4 positioning

## Context

The original product specification deliberately optimized for productive
friction and described interventions in a Living Margin. Later assignment and
verification work added a separate Action queue. In practice, intervention
details became fragmented across hover popovers, a flat signal list, a history
modal, and document-review items. Long documents also made underlines hard to
rediscover. Source search required users to retype a claim, document formatting
was mainly available through keyboard shortcuts, and no first-login education
explained how these systems fit together.

The product goal is now a production-oriented research assistant that remains
faithful to Cogdoc's educational boundary: it supports research literacy,
evidence evaluation, citation hygiene, and document structure without writing
the student's final prose or making unsupported authorship claims.

## Decisions

### 1. One intervention model, two complementary views

- The editor underline is the spatial view. Hovering it shows every active
  intervention anchored to that passage and exposes contextual actions.
- The right-pane Action queue is the persistent overview. It groups active
  interventions into Evidence checks, Claim clarity, Reasoning prompts, and
  Structure. Clicking an item selects and scrolls to the exact underlined text.
- Mark addressed and Dismiss persist through the existing intervention API;
  neither action changes document text.
- Document-review actions remain distinct because they represent deterministic
  verification state and certificate blockers, not live writing guidance.

This deviates from the original single Living Margin presentation. The
conceptual intervention system remains unchanged, but navigation is now usable
for long documents and keyboard users.

### 2. Selection is the primary research affordance

The editor exposes a persistent formatting bar. When the author selects at
least ten characters, **Find sources** becomes available and opens research
search with a snapshot of the exact selected passage. The search begins on
open, so the action remains one click. Selection is never sent merely because
it changed; the author explicitly starts the search.

This adds an explicit selection trigger to the original automatic Citation
Sentinel design. Automatic checks remain, while intentional research becomes
one step instead of a copy/paste workflow.

### 3. Scholarly search does not depend on LLM quota

OpenAlex is the primary source-discovery provider. Basic requests work without
a key, and a free `OPENALEX_API_KEY` increases the daily allowance. Crossref is
the second scholarly discovery provider as well as a DOI metadata authority.
Semantic Scholar's relevance-ranked Academic Graph search is the third
provider; it works without a key, while `SEMANTIC_SCHOLAR_API_KEY` opts into a
dedicated introductory allowance instead of the shared anonymous pool. Gemini
grounded search is considered only when all three scholarly indexes return no
usable records or are unavailable. The response names every provider tried and
each result names its record provider.

OpenAlex open-access locations are exposed when present. When
`UNPAYWALL_EMAIL` is configured, DOI-bearing results without an OpenAlex copy
are checked through Unpaywall. Lookup results are cached in-process for six
hours, transient 429/5xx responses receive one bounded retry, and at most four
lookups run concurrently. The interface labels the access resolver separately
from the metadata provider and displays host type, manuscript version, and
license when supplied. A free-copy link does not mean Cogdoc has read or
verified the work.

This reverses the first implementation, which called Gemini first and used
OpenAlex only after a quota failure. The change makes the common academic
search path deterministic, cheaper, and resilient to model quota. See the
[OpenAlex API reference](https://help.openalex.org/api/),
[Crossref REST API access guide](https://www.crossref.org/documentation/retrieve-metadata/rest-api/access-and-authentication/),
[Semantic Scholar API tutorial](https://www.semanticscholar.org/product/api/tutorial),
[Unpaywall API documentation](https://data.unpaywall.org/products/api), and
[Gemini rate-limit documentation](https://ai.google.dev/gemini-api/docs/rate-limits).

### 4. Citation suggestions are deterministic and author-controlled

OpenAlex metadata is converted to CSL-JSON and rendered by Citation.js using
the citeproc-js engine and its built-in APA or Harvard template. Both the
bibliography entry and in-text citation come from the same processor. The
author may copy either value. Cogdoc labels the result as metadata-derived and
asks the author to verify author, year, venue, DOI, and locator against the
original source. See the [Citation.js CSL plugin](https://citation.js.org/api/0.7/module-%40citation-js_plugin-csl.html)
and [CSL processor overview](https://citationstyles.org/developers/).

The application never inserts or silently rewrites citations. This is a
deliberate deviation from conventional "complete assistant" products and
preserves the Product Specification's human-authorship boundary. CSL rendering
is now implemented for the two citation styles supported by the workspace
model. The author chooses APA 7 or Harvard Cite Them Right when creating a
workspace and can change it from the workspace overview. A style change
re-renders every metadata-backed saved reference from its structured fields and
reports legacy or unstructured entries that still require manual review. The
server, rather than the browser, selects the workspace style and renders saved
discovery records so a client cannot persist a mixed-style library. Volume,
issue, page, publisher, and venue fields remain structured during that change.
Institution-specific variants and additional styles remain separate product
extensions.

Saving a discovered reference stores bibliographic metadata separately from
indexed full text. It does not scrape DOI landing pages or imply that a
paywalled paper has been read. The library labels unverified metadata and asks
the author to upload a lawful PDF copy before passage-level evidence checks.
The author can check a saved record against Crossref/DataCite; Cogdoc records a
high-confidence registry match, a mismatch, or no match. **I checked the
original** is a separate explicit action and creates a distinct audit event, so
manual confirmation is never confused with an automated registry match.

### 5. Formatting is visible but document semantics remain canonical

The Tiptap toolbar supports paragraph and three heading levels, bold, italic,
strike, inline code, lists, block quotations, dividers, tables, clear format,
undo, and redo. Intervention underlines stay separate ProseMirror decorations
and are never serialized into the document. Academic DOCX export remains the
canonical structured export path.

That export now applies a deterministic normalized academic profile: one-inch
page margins, Times New Roman 12-point body text, 1.5 line spacing, centered page
numbers, explicit title and heading hierarchy, indented block quotations,
monospaced code, bordered tables with differentiated header cells, dividers,
and safe HTTP(S) hyperlinks. These choices prioritize a readable, editable
baseline. They do not claim conformance with a particular university, journal,
or assessment brief; the export label and workspace copy state that boundary.

Ordinary underline formatting is intentionally omitted from the initial bar
because wavy underlines already carry interaction meaning in Cogdoc. This is a
small visual-language deviation from generic word processors.

### 6. Onboarding persists at account level

The first authenticated visit opens a four-step tutorial explaining workspaces,
interventions, selection-based research, review, and export. Completion is
stored as `User.onboardingCompletedAt`; local storage is only a failure-mode
fallback. A persistent Tutorial button reopens the flow from every authenticated
screen.

This adds a nullable database field to the original schema. The field contains
no research content and is used only to avoid repeating onboarding.

### 7. Cloud model by default, local adapter available

The current test adapter uses `gemini-3.5-flash-lite`, selected because it is an
available stable Flash-Lite model with Google Search support at the time of
implementation. Existing `AI_MODEL=gemini-2.0-flash` configurations are mapped
to the current default because the old model is retired. Explicit
`GEMINI_MODEL` configuration always wins.

The same `AIService` can use `AI_PROVIDER=ollama` against Ollama's local
OpenAI-compatible endpoint, or a configured Groq/custom compatible endpoint.
Ollama does not require an API key and defaults to `qwen3:8b` when the existing
model setting still names Gemini. Bundling and automatically downloading model
weights remains deferred until supported deployment hardware, quantization,
context limits, safety evaluation, and latency targets are fixed. This is a
deliberate deviation from forcing a multi-gigabyte runtime into every install.

The editor header exposes an **Assistant** readiness control. Its explicit
check uses the provider's model-list or model-metadata endpoint with a 3.5
second timeout; it never sends draft content or requests a completion. The
public response contains only provider, model, local/hosted mode, and a bounded
status such as reachable, quota limited, model unavailable, or unreachable.
The connectivity probe does not claim that hosted generation quota remains;
recent real generation failures are retained in-process for ten minutes and
override the connectivity result. Keys and base URLs are never returned.
Research discovery remains available through OpenAlex, Crossref, and Semantic Scholar when
model-backed interventions are unavailable.

### 8. Dependency remediation is part of the release gate

The citation milestone added the MIT-licensed Citation.js core and CSL plugin.
The same change removed two unused editor/highlighter packages, updated the
framework/auth dependency graph within compatible ranges, aligned Sharp with
the installed Next.js release, and moved the Prisma CLI to development tooling.
`npm audit --omit=dev --omit=optional` is the deployable web-runtime gate and
reports zero known vulnerabilities at this checkpoint. Prisma CLI advisories
remain visible in the full development-tool audit; the CLI is used during
container initialization, not imported by request handlers.

## Environment variables

| Variable | Requirement | Purpose |
|---|---|---|
| `AI_PROVIDER` | Optional | `gemini` (default), `ollama`, `groq`, or `custom` |
| `AI_API_KEY` or `GEMINI_API_KEY` | Required for hosted AI interventions | Gemini credential; provider-specific name takes precedence. Not required for Ollama |
| `AI_BASE_URL` | Required for custom; optional otherwise | OpenAI-compatible endpoint. Ollama defaults to `http://127.0.0.1:11434/v1` |
| `AI_MODEL` | Optional | Generic model setting; current default is `gemini-3.5-flash-lite` |
| `GEMINI_MODEL` | Optional | Provider-specific override |
| `OPENALEX_API_KEY` | Optional | Free key for a larger OpenAlex daily allowance |
| `OPENALEX_MAILTO` | Optional | Courteous contact identity for OpenAlex |
| `CROSSREF_MAILTO` | Recommended | Contact identity for DOI metadata requests |
| `SEMANTIC_SCHOLAR_API_KEY` | Optional | Dedicated Semantic Scholar request allowance; anonymous access remains available |
| `UNPAYWALL_EMAIL` | Recommended | Contact identity required for legal open-access DOI resolution |

## SDG 4 contribution boundary

Cogdoc aligns with **SDG 4: Quality Education** by designing for independent
argumentation, source evaluation, citation literacy, transparent feedback, and
revisable learning rather than answer generation. The interface makes research
support accessible through no-key scholarly search and keeps educational
decisions with the learner.

This is a product-design alignment, not evidence that the application has
already improved SDG outcomes. That claim requires consented usability and
learning-outcome studies across representative student groups. Production
messaging must distinguish implemented affordances from evaluated impact.

## Production boundaries still open

- Additional CSL styles and institution-specific document templates beyond the shipped APA/Harvard processors and normalized academic DOCX profile.
- Bundled local-model distribution and hardware-specific evaluation (the Ollama adapter itself is implemented).
- WCAG audit with assistive-technology testing.
- Supabase RLS/storage policy deployment and malware-scanning service.
- Load, recovery, quota, and external provider-failover exercises beyond automated route coverage.
- Consented usability and learning-outcome evaluation.

These boundaries must remain visible in release documentation; passing unit
tests does not prove the external operational or educational outcomes.
