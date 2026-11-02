# CogDoc live demo runbook

## Start the app

The live demo uses a real saved document, real sources, Gemini, and PostgreSQL with pgvector. The separate **Watch offline example** is a simulation.

For the current local setup, open http://localhost:3001. The updated retrieval service runs on http://127.0.0.1:8001. Keep the existing PostgreSQL database running.

To restart these local services, from the repository root:

```sh
npm run rag:setup
```

Run the following in separate terminals:

```sh
npm run rag:dev
```

```sh
npm run demo:dev
```

The setup command is needed only once. These commands read the existing `.env.local`. Keep its Gemini key private. `DATABASE_URL` must point to the existing PostgreSQL database; `FASTAPI_URL` must be `http://127.0.0.1:8001`. The database must already have the application schema and `fastapi/migrations/0001_pdfchunk_embedding_pgvector.sql` applied. The local startup script uses the same database for retrieval and the application.

Alternatively, the complete Docker stack (Next.js frontend and API, PostgreSQL, vector initialization, FastAPI retrieval, and configured worker services) is started with:

```sh
docker compose --env-file .env.local -f docker-compose.dev.yml --profile full up -d --build
```

Open http://localhost:3000 for Docker. The current changes were verified using the local services above. Docker Desktop was unresponsive during verification, so the rebuilt Docker stack has not been verified in this session. Do not delete database volumes to resolve a startup issue.

## Prepare before presenting

1. On Home, choose the live guided research experience.
2. Select **Java on Kubernetes**, **How services find each other**, or **Updating an app safely**. The topic and research purpose fill automatically and remain editable.
3. Start the workspace. The main writing view contains a labelled, editable starting explanation and questions to investigate. It is deliberately a hypothesis, not a reviewed conclusion.
4. Open Sources and allow the official documentation excerpts to load and embed. If needed, click **Load demo reading material**. This does not replace your writing.
5. Check the passage and embedding counts. If passages exist but embeddings are missing, check the retrieval service and click **Retry indexing**, then **Refresh status**. Internet access and a working Gemini key are required for initial loading, embeddings, and live AI calls.
6. Read the starter and a source passage yourself before presenting. Source suggestions may contain only metadata; their labels distinguish them from readable text. A suggested source is not automatically verified evidence.

## A presentation journey

### 1. Start with a question

Choose **How services find each other** for a short demo. Explain: “My question is how applications communicate when individual Pods are replaced.” Show the prefilled topic and purpose, then open the document.

### 2. Make the explanation yours

Point out the **DEMO STARTER** label. Read the paragraph aloud, then revise a sentence in the real editor. Explain: “This is my starting understanding. CogDoc helps me examine it; it does not mark it correct just because it sounds fluent.” The starter does not count as your own writing action in the guide.

The guidance card collapses after a few seconds so you can act. Use **Show guidance** when needed. Actions completed out of order are remembered in this browser; returning to the guide should not require those actions again.

### 3. Inspect actual evidence

Open Sources. Search:

> How do clients reach Pods when their addresses change?

Click **Retrieve passages**. Read a returned Service passage and click **Use this passage**. Show its source chip in Collaborator. Explain: “This is text retrieved from saved documentation, not a generated answer. The score measures similarity, not whether the claim is true.”

Alternative questions:

- Java topic: “What does a Deployment manage, and how does a Service expose the application?”
- Rolling updates topic: “Why can readiness matter during a rolling update?”

The bundled source material is a bounded excerpt, not the entire documentation site. If a question needs material outside that excerpt, open the original source or add more material rather than claiming the retrieved text answers it.

### 4. Collaborate and reason

In Collaborator, ask:

> Using the selected passage, challenge my explanation that a Service guarantees my application is always available. What distinction am I missing?

Read the real response and answer in your own words. You can also select writing and use the available intervention controls to inspect claims and reasoning. Live responses vary; do not promise a predetermined question or answer during the presentation.

### 5. Record a finding

Use Findings to record the question, your claim, the evidence, your explanation, and remaining limitations. For example: a Service gives clients an abstraction over changing backend Pods, but that alone is not proof of application availability. Review the source and explicitly accept the finding only when you can explain the connection.

### 6. Share the work

Use Share to select reviewed findings and create an outline or an article draft. Review any generated wording and uncertainty. Alternatively export the working document through its toolbar. Demonstrate the actual export action and inspect the downloaded file. An article draft still needs human review; generating polished prose does not establish publication quality.

## How retrieval and vectors work

Think of a source as a book. CogDoc cuts its text into overlapping index cards so a relevant section can be found without sending the whole book to the model.

- Chunks are bounded at 2,500 characters. Paragraph or word boundaries are preferred, with about 250 characters of overlap to preserve context. Very long paragraphs are split too.
- Gemini `gemini-embedding-001` converts each chunk into a 3,072-number vector: a numerical representation used to compare meaning.
- The original text and chunk identity remain in PostgreSQL's `PdfChunk` table. The `embedding` column uses pgvector's `vector(3072)` type. The associated source belongs to its workspace.
- The FastAPI service embeds the search question and compares it with that workspace's saved vectors using cosine distance. This currently uses exact comparison, not an approximate ANN index.
- Next.js rechecks the returned IDs against the workspace and supplies canonical saved text. **Use this passage** passes that evidence to the collaborator.
- The visible embedding count reflects stored vectors. A provider failure leaves readable text saved and exposes a retry; the configured Gemini service does not silently substitute fake semantic vectors.

Page values on imported Markdown are approximate text offsets, not printed page citations. Use the original source URL and passage text when explaining provenance.

## Verification and boundaries

Verified with the real Gemini embedding service: two official sources produced 12 embedded passages in PostgreSQL, and a Service-address query ranked Service passages first. A newly created topic-specific workspace displayed its labelled starter, loaded its official source, ran retrieval from the browser, and supplied a selected passage to Collaborator.

Focused TypeScript tests, Python retrieval tests, type checking, and a production build passed during this implementation. This is not a claim that every possible topic, provider outage, or end-to-end article outcome has been tested. Rehearse the selected presentation path and export before the actual demo.
