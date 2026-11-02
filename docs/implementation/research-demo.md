# Research demo workspace

The research demo is a repeatable, persisted Cogdoc workspace. It exercises the same project, source, passage, notebook, intervention, action, citation, synthesis, and review records used by the application.

## Create the demo

Configure `DATABASE_URL` for the development PostgreSQL database, apply the current migrations, and run:

```bash
npm run demo:research
```

The command creates the development user when needed, replaces only the workspace carrying the `[COGDOC_RESEARCH_DEMO_V1]` marker, writes three small demonstration PDFs to private filesystem storage, seeds their indexed passages, and verifies the completed graph. Global library records are reused when their DOI, canonical URL, or content digest already exists.

To also copy the seeded passage IDs and content into a running FastAPI vector store:

```bash
docker compose -f docker-compose.dev.yml --profile full up -d --build rag
FASTAPI_URL=http://localhost:8000 npm run demo:research:embed
```

Embedding is optional for the built-in exact and semantic-like local mapper fallback. Keep the PostgreSQL job worker running separately when demonstrating automatic clerical jobs:

```bash
npm run research:worker
```

You can recheck an existing demo without replacing it:

```bash
npm run demo:research:verify
```

## Demonstration walkthrough

1. Start Cogdoc with `npm run dev`, then open **Cogdoc Research IDE — Demonstration** from the dashboard.
2. Expand **Guidance** in the navigator. The document contains exact highlighted anchors for Citation Sentinel, Prompt Interceptor, Structural Scaffold, and Socratic Spacer. Hover any highlighted sentence to answer it inline, or choose **Review highlighted questions** in the inspector for a focused conversation. An incomplete answer keeps the highlight and produces a follow-up; a sufficiently specific answer adds structured research lines to the notebook and offers an editable, undoable restructuring of the challenged passage.
3. Open **History** in the navigator. **Decision history** shows the seeded source, citation, priority, and structure choices; **Intervention history** preserves all four engine questions. The integrity banner should read **Audit chain verified**.
4. Open **Sources** and inspect a private PDF passage. Each page says “Demo paraphrase” so it cannot be mistaken for a verbatim quotation; the reference metadata links to the genuine publication.
5. Open **Source Mapper** and ask “What risks follow from treating fluent model output as evidence?” or “Why should research tools preserve human agency?” Inspect exact and semantic matches and their page-level provenance.
6. Use the linked note and annotation to move between a source passage and its document claim.
7. Place the editor cursor, inspect a verified source, and insert its structured citation. Cogdoc inserts citation metadata only, never generated submission prose.
8. Review the automatically ranked queue. Its pinned blocker and evidence gap expose every deterministic factor and the bounded AI relevance adjustment.
9. Open the grounded comparison and bibliography, then export with the seeded Harvard academic profile.

The fixture deliberately includes an evidence gap: the corpus motivates provenance-first assistance but does not directly evaluate Cogdoc. That makes the demo useful for showing how the companion asks a question, searches local passages, and surfaces the need for further research instead of inventing support.
