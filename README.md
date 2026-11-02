# Cogdoc

Cogdoc is a research and writing workspace for developing an answer from
traceable evidence. A researcher can begin with a topic, discover or upload
sources, search indexed passages, record reviewed findings, write with
citations, and export the finished work from one application.

The system was developed as a BSc (Hons) IT Final Year Project at Asia Pacific
University in 2026.

## Main workflow

1. Create a research workspace from a topic, goal, and optional starting notes.
2. Build an editable investigation plan and discover or upload source material.
3. Extract and index source passages, then retrieve evidence relevant to a
   research question.
4. Record findings with evidence, limitations, uncertainty, and conflicting
   information before marking them as reviewed.
5. Develop an article manually or from selected reviewed findings, revise it,
   insert citations, and export the result.

Cogdoc also includes writing interventions for vague language, unsupported
claims, shallow reasoning, and incomplete paragraph structure. The application
keeps the researcher in control: retrieved passages are evidence candidates,
and generated suggestions still require review.

## Technology

- Next.js 16, React 19, TypeScript, Tailwind CSS, and Tiptap
- Prisma with PostgreSQL and pgvector
- Optional FastAPI retrieval and embedding service
- Optional Supabase authentication and private object storage
- Vitest, Testing Library, ESLint, and Pytest

## Quick start (recommended)

You need Docker Desktop (or Docker Engine with Compose). From the extracted
`Cogdoc-System` folder, create the local environment file.

On macOS, Linux, Git Bash, or WSL:

```bash
cp .env.example .env.local
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Then run this command on any platform:

```bash
docker compose --env-file .env.local -f docker-compose.dev.yml --profile full up -d --build
```

Open <http://localhost:3000>. The first build may take several minutes. The
database, application, retrieval service, and background worker are started
together. The default configuration runs without a paid API key; add a key to
`.env.local` only when model-backed features or real Gemini embeddings are
needed.

Check the services:

```bash
docker compose --env-file .env.local -f docker-compose.dev.yml --profile full ps
```

Stop Cogdoc without deleting its database:

```bash
docker compose --env-file .env.local -f docker-compose.dev.yml --profile full down
```

To remove the local Docker data as well, append `--volumes` to the final
command. This permanently removes the local Cogdoc database.

## Local development

Requirements: Node.js 22 or newer, npm, Docker, and optionally Python 3.11 or
newer for the standalone retrieval service.

Start PostgreSQL, install dependencies, prepare the database, and run the web
application:

```bash
docker compose -f docker-compose.dev.yml up -d postgres
cp .env.example .env.local
npm ci
npm run db:generate
npm run db:push
npm run seed
npm run dev
```

Open <http://localhost:3000>. This mode uses the built-in retrieval fallback by
default. To run the Python retrieval service separately:

```bash
npm run rag:setup
npm run rag:dev
```

Then set `FASTAPI_URL="http://localhost:8001"` and
`USE_VECTOR_RETRIEVAL="true"` in `.env.local`, and restart the web application.
`npm run rag:dev` uses Gemini embeddings and therefore requires
`GEMINI_API_KEY` or `AI_API_KEY`.

## Configuration

`.env.example` documents every supported setting needed by the main system.
Copy it to `.env.local`; never place real credentials in `.env.example` or
commit `.env.local`.

The most useful settings are:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection used by Prisma. |
| `COGDOC_RESEARCH_COLLABORATOR` | `investigation` for research findings, or `article` for the complete workflow. |
| `AI_PROVIDER` | `gemini`, `ollama`, `groq`, or `custom`. |
| `AI_BASE_URL` | OpenAI-compatible endpoint for the selected provider. |
| `AI_API_KEY` | Provider credential; may be empty for an offline/local provider. |
| `AI_MODEL` | Model identifier sent to the provider. |
| `FASTAPI_URL` | Address of the optional retrieval service. |
| `USE_VECTOR_RETRIEVAL` | Enables the FastAPI/pgvector path when `true`. |
| `EMBEDDING_PROVIDER` | `hashing` for offline development or `gemini` for real embeddings. |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL for shared deployments. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser-safe Supabase key. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only credential for private storage. |
| `COGDOC_SINGLE_USER_MODE` | Explicit private, one-user production mode. |

Example Gemini configuration:

```env
AI_PROVIDER="gemini"
AI_BASE_URL="https://generativelanguage.googleapis.com/v1beta/openai"
AI_API_KEY="replace-with-your-key"
AI_MODEL="gemini-3.5-flash-lite"
EMBEDDING_PROVIDER="gemini"
GEMINI_API_KEY="replace-with-your-key"
```

Example local Ollama configuration:

```env
AI_PROVIDER="ollama"
AI_BASE_URL="http://127.0.0.1:11434/v1"
AI_API_KEY=""
AI_MODEL="qwen3:8b"
```

## Project structure

```text
src/                       Next.js interface, API routes, and domain logic
prisma/                    PostgreSQL schema and migrations
fastapi/                   Retrieval, embedding, and vector-search service
docker/postgres-init/      PostgreSQL and pgvector initialization
scripts/                   Seed, worker, migration, and verification tools
public/                    Static browser assets
```

## Useful commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server on port 3000. |
| `npm run build` | Create the production build. |
| `npm run lint` | Run the TypeScript/React lint checks. |
| `npm test` | Run the Vitest suite once. |
| `npm run db:generate` | Generate the Prisma client. |
| `npm run db:push` | Apply the current Prisma schema. |
| `npm run seed` | Create the initial local records. |
| `npm run research:worker` | Process queued research jobs. |
| `npm run rag:setup` | Create the Python environment and install RAG dependencies. |
| `npm run rag:dev` | Start the optional local RAG service on port 8001. |

Run the standard checks before submission or deployment:

```bash
npm run lint
npm test
npm run build
```

FastAPI tests can be run after `npm run rag:setup`:

```bash
cd fastapi
../.venv-rag/bin/python -m pytest -q
```

## Submission package

The source submission contains the application code, database schema,
retrieval service, tests, required scripts, lockfile, configuration templates,
and Docker files. It intentionally excludes credentials, installed
dependencies, build output, local databases, caches, logs, Git history, report
documents, generated diagrams, and other working files.

## Licence

Final Year Project — BSc (Hons) IT, Asia Pacific University, 2026.
