# Cogdoc — Developer Guide

*For developers who want to extend, customize, or deploy Cogdoc.*

---

## Prerequisites

- **Node.js 20+** (or **Bun** — faster)
- **SQLite** (bundled, no setup needed) OR **Postgres** (Supabase or external)
- An **LLM API key** — Google Gemini, Groq, or any OpenAI-compatible provider

---

## Local development setup

```bash
# Clone and install
git clone <repo-url> cogdoc
cd cogdoc
bun install   # or: npm ci

# Set up the database
echo 'DATABASE_URL="file:./db/cogdoc.db"' > .env
bun run db:push

# Seed default user + 4 prompt templates
bun run seed

# Set up AI provider (create .z-ai-config in project root)
cat > .z-ai-config << 'EOF'
{
  "baseUrl": "https://generativelanguage.googleapis.com/v1beta/openai",
  "apiKey": "AIza-your-gemini-key",
  "model": "gemini-2.0-flash"
}
EOF

# Start dev server
bun run dev
```

Open http://localhost:3000.

---

## Architecture overview

```
Browser ──fetch──▶ Next.js API Routes ──▶ Prisma ──▶ SQLite/Postgres
                          │
                          └──▶ AIService (interface)
                                   │
                                   └──▶ ZAIAdapter ──▶ z-ai-web-dev-sdk ──▶ LLM
```

**Key design decisions** (see `download/cogdoc/Cogdoc_System_Architecture_Design.pdf` for the full ADRs):
- **Modular monolith** — single Next.js app, no microservices (ADR-01)
- **Provider abstraction** — engines never touch the LLM SDK directly (ADR-03)
- **Full intervention audit log** — every AI event is persisted (ADR-05)
- **Keyword-overlap retrieval** simulates pgvector RAG — the interface is vector-DB-ready (ADR-07 pragmatic deviation)

---

## Database schema

8 tables at 3NF (see `prisma/schema.prisma`):

| Table | Purpose |
|---|---|
| `User` | Auth + per-user token budget |
| `Project` | A writing piece (one draft, many PDFs, many interventions) |
| `Document` | The user's draft (HTML from contenteditable) |
| `Pdf` | Uploaded research paper |
| `PdfChunk` | ~500-token passage parsed from a PDF |
| `Intervention` | An AI event (engine type, prompt, response, verdict, status) |
| `InterventionEvidence` | Junction: which chunks a Citation Sentinel verdict cited |
| `PromptTemplate` | Versioned prompt with behaviour tag (swappable without redeploy) |

To switch from SQLite to Postgres, set `DATABASE_URL` to a `postgresql://` URL — the Docker entrypoint auto-selects `prisma/schema.postgres.prisma`.

---

## How the four engines work

Each engine is a Next.js API route + an `AIService` method:

| Engine | API route | AIService method | Prompt template tag |
|---|---|---|---|
| Interceptor | `POST /api/interceptor` | `classifyPrompt()` → `generateSocratic()` | `[The Spark Gap]` |
| Socratic Spacer | `POST /api/socratic-spacer` | `generateSocratic()` | `[Provocation]` |
| Citation Sentinel | `POST /api/citation-sentinel` | `verifyClaim()` (with RAG retrieval) | `[Lens]` |
| Scaffold | `POST /api/scaffold` | `generateScaffold()` | `[Structural Scaffold]` |

### When engines fire

The content analyzer (`src/lib/content-analyzer.ts`) classifies each completed sentence (on `.`, `?`, `!`) and returns **all** matching engines. The editor fires them all, staggered by 500ms to avoid LLM rate-limiting.

```typescript
const analysis = analyzeSentence(sentence)
analysis.engines.forEach((engine, idx) => {
  setTimeout(() => fireEngine(engine, sentence, context, analysis.reasons[engine]), idx * 500)
})
```

Per-engine cooldowns prevent spam: Socratic 2s, Interceptor 4s, Citation 6s, Scaffold 8s.

---

## How to add a new engine

1. **Add the engine type** to `src/lib/types.ts`:
   ```typescript
   export type EngineType = 'interceptor' | 'socratic' | 'citation' | 'scaffold' | 'your-engine'
   ```

2. **Add a prompt template** in `scripts/seed.js` with a new behaviour tag:
   ```javascript
   {
     behaviorTag: 'Your Tag',
     name: 'Your Engine — Tag',
     template: `You are... {prompt} {context} ...`,
   }
   ```

3. **Add the AIService method** in `src/lib/ai-service.ts`:
   ```typescript
   export interface AIService {
     // ...existing methods
     yourMethod(input: string): Promise<YourResult>
   }

   export class ZAIAdapter implements AIService {
     async yourMethod(input: string): Promise<YourResult> {
       const template = await getTemplate('Your Tag')
       const filled = fillTemplate(template, { input })
       const raw = await callLLM(filled)
       return parseResult(raw)
     }
   }
   ```

4. **Create the API route** at `src/app/api/your-engine/route.ts` — follow the pattern in `src/app/api/interceptor/route.ts`.

5. **Add the engine to the content analyzer** in `src/lib/content-analyzer.ts` — add a regex pattern and push to `engines[]` in `analyzeSentence()`.

6. **Add UI styling** — add the engine color to `ENGINE_COLORS` in `src/lib/sentence-highlight.ts` and `ENGINE_META` + `ENGINE_ACTIONS` in `src/components/cogdoc/sentence-popover.tsx`.

7. **Re-seed** the database: `bun run seed`

---

## How to swap the LLM provider

The `AIService` interface decouples engines from the LLM. To swap from z-ai-web-dev-sdk to OpenAI:

1. **Create a new adapter** in `src/lib/ai-service.ts`:
   ```typescript
   import OpenAI from 'openai'

   export class OpenAIAdapter implements AIService {
     private client: OpenAI

     constructor(apiKey: string) {
       this.client = new OpenAI({ apiKey })
     }

     async classifyPrompt(prompt: string, context: string): Promise<ClassifyResult> {
       // ...implement using this.client.chat.completions.create()
     }
     // ...implement the rest
   }
   ```

2. **Update the singleton** in `src/lib/ai-service.ts`:
   ```typescript
   export function getAIService(): AIService {
     if (!_instance) {
       _instance = process.env.OPENAI_API_KEY
         ? new OpenAIAdapter(process.env.OPENAI_API_KEY)
         : new ZAIAdapter()
     }
     return _instance
   }
   ```

No engine code needs to change — they all call `AIService`.

---

## How to swap keyword-overlap retrieval for pgvector

The retrieval interface in `src/lib/retrieval.ts` is vector-DB-ready. To use pgvector:

1. **Switch to the Postgres schema** (already bundled at `prisma/schema.postgres.prisma`).
2. **Add an `embedding` column** to `PdfChunk` (uncomment the line in the Postgres schema).
3. **Install pgvector** in your Postgres instance.
4. **Replace the retrieval function**:
   ```typescript
   export async function retrieveTopK(projectId: string, query: string, k = 5) {
     const queryEmbedding = await getAIService().generateEmbedding(query)
     const chunks = await db.$queryRaw`
       SELECT id, content, page_approx,
              embedding <=> ${queryEmbedding} as distance
       FROM "PdfChunk"
       WHERE pdf_id IN (SELECT id FROM "Pdf" WHERE project_id = ${projectId})
       ORDER BY embedding <=> ${queryEmbedding}
       LIMIT ${k}
     `
     return chunks.map(c => ({
       chunkId: c.id,
       content: c.content,
       similarityScore: 1 - c.distance,
       pageApprox: c.page_approx,
       pdfFilename: '...'
     }))
   }
   ```

5. **Update the embedder** to store vectors in `PdfChunk.embedding` instead of (or in addition to) the keyword-overlap index.

---

## Docker deployment

```bash
# Build
docker build -t cogdoc:latest .

# First run (interactive wizard)
docker run -it -p 3000:3000 -v cogdoc_data:/data cogdoc:latest

# Subsequent runs
docker run -d -p 3000:3000 -v cogdoc_data:/data cogdoc:latest
```

The Dockerfile is a 3-stage multi-stage build:
1. **deps** — installs node_modules
2. **builder** — generates Prisma clients (SQLite + Postgres), builds Next.js standalone
3. **runtime** — minimal alpine + the standalone server

See `README-DOCKER.md` for the full deployment guide including multi-arch builds, Supabase setup, and troubleshooting.

---

## Testing

Smoke test the golden path via agent-browser or manually:

1. Create a project
2. Type a sentence ending in `.`
3. Verify engines fire (check the toolbar "analyzing..." indicator)
4. Wait 2.5s for underlines to appear
5. Hover over an underlined sentence — popover should appear
6. Click an actionable insight — intervention should resolve
7. Open Stats modal — all 4 engines should have fired
8. Upload a PDF in the Library modal
9. Write a factual claim → Citation Sentinel should return a verdict
10. Export to Markdown

---

## File structure

```
src/
├── app/
│   ├── api/                    # API routes
│   │   ├── projects/[id]/      # CRUD + export + pdfs + document
│   │   ├── interceptor/        # POST → classify + reframe
│   │   ├── socratic-spacer/    # POST → generate ghost question
│   │   ├── citation-sentinel/  # POST → RAG verify
│   │   ├── scaffold/           # POST → structural outline
│   │   ├── interventions/      # GET list + PATCH update
│   │   ├── analytics/          # GET aggregate stats
│   │   ├── settings/           # GET runtime config
│   │   └── user/               # GET default user
│   ├── layout.tsx              # Root layout (Newsreader font)
│   └── page.tsx                # Dashboard / Editor switch
├── components/
│   ├── cogdoc/                 # App-specific components
│   └── ui/                     # shadcn/ui kit
├── lib/
│   ├── ai-service.ts           # AIService interface + ZAIAdapter
│   ├── content-analyzer.ts     # Sentence → engine routing
│   ├── retrieval.ts            # Keyword-overlap RAG
│   ├── sentence-highlight.ts   # <mark> wrapping + fuzzy matching
│   ├── store.ts                # Zustand
│   ├── types.ts                # Shared types
│   ├── db.ts                   # Prisma client
│   ├── auth.ts                 # Default user helper
│   └── api-client.ts           # Typed fetch wrapper
└── prisma/
    ├── schema.prisma           # SQLite (default)
    └── schema.postgres.prisma  # Postgres (Supabase-ready)
```

---

## Contributing

This is a Final Year Project. If you're extending it for future work:
- Follow the existing code style (TypeScript throughout, shadcn/ui for components)
- Add new engines via the pattern in "How to add a new engine" above
- Update the seed script when adding prompt templates
- Run `bun run lint` before committing

---

*Cogdoc — Final Year Project, BSc (Hons) IT, Asia Pacific University, 2026.*
