# Cogdoc

Cogdoc is a research-first writing workspace that helps people explore evidence,
test their reasoning, and draft without handing their understanding over to AI.
It combines a notebook editor, source management, grounded research tools, and
four intervention engines that surface vague claims, missing evidence, weak
reasoning, and structural gaps.

This project was built as a BSc (Hons) IT Final Year Project at Asia Pacific
University in 2026.

## What Cogdoc does

- Starts a research workspace from a topic or an existing document.
- Uses a three-pane Research IDE with a project navigator, tabbed work area,
  and contextual evidence inspector.
- Imports DOCX files, PDFs, pasted text, code archives, and research notes.
- Searches scholarly metadata through OpenAlex, Crossref, and Semantic Scholar.
- Maps questions and claims to indexed source passages.
- Inserts verified citation nodes and derives bibliographies from citations
  actually used in the document.
- Records research decisions and intervention outcomes in an append-only,
  tamper-evident history.
- Exports Markdown, plain text, HTML, DOCX, and printable PDF output.

The four intervention engines are:

| Engine | Purpose |
| --- | --- |
| Interceptor | Challenges vague, absolute, or delegative writing. |
| Socratic Spacer | Prompts deeper thinking after a pause or question. |
| Citation Sentinel | Checks factual claims against indexed evidence. |
| Scaffold | Offers an empty claim/evidence/limitation/implication structure. |

Cogdoc selects one relevant intervention for a phrase, lets the researcher
answer it inline, and keeps accepted reasoning as structured notes. Generated
material remains editable and is never presented as proof of authorship,
correctness, originality, or institutional approval.

## Technology

- Next.js 16, React 19, and TypeScript
- Tailwind CSS 4 and shadcn/ui primitives
- Tiptap/ProseMirror editor
- Prisma with PostgreSQL or Supabase
- Optional FastAPI retrieval service with pgvector
- Supabase authentication and private object storage for shared deployments
- Vitest, Testing Library, and ESLint

## Prerequisites

For local development you need:

- Node.js 22 or newer and npm
- Docker with Docker Compose, or a PostgreSQL 16+ server
- An optional Gemini, Groq, Ollama, or OpenAI-compatible model endpoint for
  model-backed features

## Local setup

The development Compose file provides PostgreSQL with pgvector. The Next.js app
runs locally so it can hot-reload.

```bash
docker compose -f docker-compose.dev.yml up -d postgres
cp .env.example .env.local
npm ci
npm run db:generate
npm run db:push
npm run seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The default `DATABASE_URL` in `.env.example` matches the development Postgres
container. Edit `.env.local` before starting the app if you use another
database or want to enable an AI provider. Never commit `.env.local`.

If an older Docker volume does not contain pgvector, enable it once:

```bash
docker compose -f docker-compose.dev.yml exec -T postgres \
  psql -U cogdoc -d cogdoc -c 'CREATE EXTENSION IF NOT EXISTS vector;'
```

### Optional vector retrieval service

Start the FastAPI service alongside PostgreSQL:

```bash
docker compose -f docker-compose.dev.yml --profile full up -d postgres rag
```

Then set these values in `.env.local` and restart the Next.js server:

```env
FASTAPI_URL="http://localhost:8000"
USE_VECTOR_RETRIEVAL="true"
```

Without FastAPI, Cogdoc keeps working with its PostgreSQL-backed exact and
keyword retrieval path. See `fastapi/requirements.txt` and the development
Compose file for embedding-provider options.

### AI provider examples

Gemini through its OpenAI-compatible endpoint:

```env
AI_PROVIDER="gemini"
AI_BASE_URL="https://generativelanguage.googleapis.com/v1beta/openai"
AI_API_KEY="your-key"
AI_MODEL="gemini-3.5-flash-lite"
```

Local Ollama:

```env
AI_PROVIDER="ollama"
AI_BASE_URL="http://127.0.0.1:11434/v1"
AI_API_KEY=""
AI_MODEL="qwen3:8b"
```

## Docker deployment

Build the production image:

```bash
docker build -t cogdoc:latest .
```

For an interactive first run, supply a reachable PostgreSQL database when the
wizard asks for configuration:

```bash
docker run -it -p 3000:3000 -v cogdoc_data:/data cogdoc:latest
```

Configuration is persisted in the `cogdoc_data` volume. Subsequent runs can be
detached:

```bash
docker run -d -p 3000:3000 -v cogdoc_data:/data cogdoc:latest
```

See [README-DOCKER.md](./README-DOCKER.md) for environment-based deployment,
multi-architecture builds, health checks, and troubleshooting.

## Configuration

Copy `.env.example` and configure only the services you use. Important values
include:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Required PostgreSQL or Supabase connection URL. |
| `AI_PROVIDER` | `gemini`, `ollama`, `groq`, or `custom`. |
| `AI_BASE_URL` | Base URL for the selected model endpoint. |
| `AI_API_KEY` | Provider API key; may be empty for a local endpoint. |
| `AI_MODEL` | Model identifier sent to the provider. |
| `FASTAPI_URL` | Optional retrieval-service URL. |
| `USE_VECTOR_RETRIEVAL` | Enables the FastAPI vector path when `true`. |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL for shared deployments. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser-safe Supabase key. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only private-storage credential. |
| `COGDOC_STORAGE_DIR` | Local private-file fallback directory. |
| `COGDOC_CERTIFICATE_PRIVATE_KEY` | Ed25519 key used for product attestations. |
| `COGDOC_SINGLE_USER_MODE` | Explicit opt-in for a private, one-user production install. |

Shared or public deployments must configure authentication, Row Level Security,
and private storage. Follow [docs/deployment/security.md](./docs/deployment/security.md)
before exposing the application.

## Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server on port 3000. |
| `npm run build` | Create the standalone production build. |
| `npm start` | Run the standalone production server. |
| `npm run lint` | Run ESLint. |
| `npm test` | Run the Vitest suite once. |
| `npm run test:coverage` | Run tests with coverage thresholds. |
| `npm run gate` | Run the repository quality gate. |
| `npm run db:generate` | Generate the Prisma client. |
| `npm run db:push` | Apply the Prisma schema to the configured database. |
| `npm run db:migrate` | Create and apply a development migration. |
| `npm run seed` | Seed the default user and intervention templates. |
| `npm run research:worker` | Process queued research jobs. |
| `npm run demo:research` | Create and verify the persisted demo workspace. |
| `npm run demo:research:embed` | Seed the demo and ingest it into FastAPI. |
| `npm run security:verify` | Verify configured security policies. |

## Architecture

```text
Browser
  └─ Next.js application and API routes
       ├─ Tiptap research editor and intervention UI
       ├─ AI provider abstraction
       ├─ Prisma ── PostgreSQL / Supabase
       ├─ Supabase Auth and private storage (optional locally)
       └─ FastAPI ── embeddings and pgvector retrieval (optional)
```

Next.js is the authenticated backend-for-frontend and owns workspace state,
authorization, audit records, source metadata, and model requests. PostgreSQL is
the canonical database. FastAPI is an optional retrieval boundary; its absence
does not prevent the core editor and keyword retrieval from running.

## Project structure

```text
src/
├─ app/                    Next.js pages and API routes
├─ components/cogdoc/      Product UI and Research IDE
├─ components/ui/          Shared UI primitives
├─ hooks/                  React hooks
├─ lib/                    Domain, editor, AI, auth, retrieval, and export logic
└─ test/                   Shared Vitest setup
prisma/                    Canonical schema and migrations
fastapi/                   Optional retrieval and embedding service
scripts/                   Seed, worker, migration, and verification tools
docs/                      ADRs, implementation notes, deployment guidance
public/                    Static browser assets
```

## Tests and validation

Run the main checks before submitting changes:

```bash
npm run lint
npm test
npm run build
```

The full gate also runs coverage and the FastAPI test suite when its Python
environment is available:

```bash
npm run gate
```

## Demo workspace

Create a repeatable research demonstration containing private sample PDFs,
indexed passages, notebook material, citations, a grounded comparison, a
ranked action queue, and examples from all four intervention engines:

```bash
npm run demo:research
```

The command replaces only the workspace carrying Cogdoc's explicit demo marker.
For a walkthrough and verification details, see
[docs/implementation/research-demo.md](./docs/implementation/research-demo.md).

## Documentation

- [USER_GUIDE.md](./USER_GUIDE.md) — product guide for writers and examiners
- [DEVELOPER.md](./DEVELOPER.md) — implementation and extension guide
- [README-DOCKER.md](./README-DOCKER.md) — Docker deployment guide
- [Production security](./docs/deployment/security.md) — auth, RLS, and storage
- [Release readiness](./docs/deployment/release-readiness.md) — deployment and acceptance gates
- [Production-readiness audit](./docs/implementation/production-readiness-audit.md) — requirement evidence
- [Research demo](./docs/implementation/research-demo.md) — reproducible demo instructions
- [Local full-stack walkthrough](./walkthrough.md) — Docker env, startup, and feature tour

## Uploading this source package

The distributable ZIP intentionally excludes installed dependencies, build and
test output, caches, logs, local databases, Git metadata, and secret environment
files. After extracting it on another machine, restore dependencies with
`npm ci` and create `.env.local` from `.env.example`.

## License

Final Year Project — BSc (Hons) IT, Asia Pacific University, 2026.
