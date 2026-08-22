# Cogdoc

**A student-first assignment and research workspace that verifies citations, evidence, reasoning, and the exact reviewed snapshot.**

Cogdoc accepts a DOCX or a blank draft, builds a calm action queue, and records how critical academic issues were handled. It can issue a cryptographically signed **Cogdoc Process Verified** record for an immutable snapshot. That record never claims AI-free or human authorship, correctness, originality, or institutional approval. Cogdoc asks questions and suggests evidence; it never inserts submission-ready prose.

Built as a Final Year Project for BSc (Hons) IT at Asia Pacific University, 2026.

---

## Why Cogdoc?

Generative AI tools (ChatGPT, Gemini, Grammarly) make writing faster — but they also enable **cognitive offloading**: students copy-paste AI-generated text, trust unverified citations, and stop engaging in the higher-order thinking that academic writing is supposed to cultivate. The IR survey of 33 respondents confirmed:

- **69.6%** copy-paste AI text into drafts without modification
- **72.2%** spend less time thinking about structure when using AI
- Only **26.3%** strongly verify AI-generated citations against original sources

Cogdoc's answer is **productive friction**: AI that refuses to write for you, but instead interrupts, questions, challenges, and verifies — preserving your cognitive responsibility.

---

## The four AI engines

| Engine | Color | When it fires | What it does |
|---|---|---|---|
| **Interceptor** | 🟡 Amber | Vague language ("basically", "stuff") or absolute claims ("always", "never") | Reframes the sentence as a Socratic question that forces specificity |
| **Socratic Spacer** | 🌹 Rose | Idle pause (2s) or question sentences | Provokes deeper thinking with a challenging question |
| **Citation Sentinel** | 🟢 Emerald | Factual claims ("research shows", "%", "study") | Verifies the claim against your uploaded PDF library using RAG retrieval |
| **Scaffold** | 🔵 Sky | Long sentences (25+ words) or paragraph completion | Offers a Claim/Evidence/Limitation/Implication outline — empty, you fill it in |

Each engine offers **actionable next-steps** (not generic Engage/Dismiss):
- **Interceptor**: Rewrite this · Find evidence · Answer this
- **Socratic**: Answer this · Show scaffold · Find sources
- **Citation Sentinel**: Find sources · Rewrite claim · View evidence
- **Scaffold**: Apply scaffold · Answer this

---

## Quick start (Docker — recommended)

```bash
docker build -t cogdoc:latest .
docker run -it -p 3000:3000 -v cogdoc_data:/data cogdoc:latest
```

The first run launches an interactive wizard that configures:
1. **AI provider** — Google Gemini / Groq / OpenAI-compatible / skip
2. **Database** — Supabase Postgres / external Postgres
3. **Supabase auth** — optional (single-user mode by default)
4. **App settings** — token budget, idle threshold

Subsequent runs skip the wizard (config persisted in the `cogdoc_data` volume):
```bash
docker run -d -p 3000:3000 -v cogdoc_data:/data cogdoc:latest
```

Open **http://localhost:3000**.

### Multi-arch build (AMD64 + ARM64)

```bash
docker buildx create --use --name multiarch --driver docker-container
docker buildx build --platform linux/amd64,linux/arm64 -t yourregistry/cogdoc:latest --push .
```

Runs on Apple Silicon, AWS Graviton, Raspberry Pi 4/5, and standard x86_64 servers.

---

## Quick start (local dev)

```bash
docker compose -f docker-compose.dev.yml up -d postgres
cp .env.example .env.local
bun install
bun run db:push        # create the PostgreSQL workspace schema
bun run seed           # seed default user + 4 prompt templates
bun run dev            # start dev server on :3000
```

Open http://localhost:3000.

---

## Features

### Writing
- **Notebook-style editor** with Newsreader serif font, 18px body, 1.8 line-height
- **Auto-save** (debounced 1.5s) with live save-state indicator
- **Keyboard shortcuts**: Cmd/Ctrl+B (bold), Cmd/Ctrl+I (italic), Cmd/Ctrl+U (underline), Esc (clear selection)
- **Focus mode** — dims all paragraphs except the one you're editing
- **Word count** in the toolbar

### AI engines (all fire automatically)
- **Sentence-completion trigger** — typing `.`, `?`, `!` analyzes the sentence and fires all matching engines (staggered 500ms to avoid rate-limiting)
- **Idle trigger** — 2-second pause fires Socratic Spacer
- **Paragraph-completion trigger** — Enter on a new paragraph fires Scaffold
- **Multi-engine per sentence** — one sentence can trigger Interceptor + Citation + Socratic simultaneously
- **Multi-colored underlines** — each engine adds its own colored wavy underline, stacked via CSS `text-decoration`

### Interventions
- **Underlined sentences** — wavy underline colored by engine, appears 2.5s after the engine fires
- **Hover popover** — shows all interventions for the sentence, stacked, each with engine-specific actionable insights
- **Fuzzy matching** — underlines survive minor edits to the sentence
- **Full audit log** — every intervention is persisted with prompt, response, verdict, cited evidence, user action, timestamps

### Research library
- **PDF upload** (drag-and-drop) — parsed via `pdf-parse`, chunked into ~500-token passages
- **Paste text** — for web articles, e-book excerpts, or notes
- **Keyword-overlap retrieval** — Jaccard similarity simulates pgvector RAG (the retrieval interface is vector-DB-ready for a future swap)
- **Citation provenance** — every Citation Sentinel verdict links to the cited chunks with similarity score and page number

### Export
- **Markdown** (.md) — for importing into Notion, Obsidian, GitHub
- **Plain text** (.txt) — for email or simple editors
- **HTML** (.html) — styled standalone page
- **Print / PDF** — via browser print dialog

### Analytics
- Total interventions, engagement rate, breakdowns by engine / action / verdict
- Visible in the Stats modal (top bar)

### History
- Full intervention history with filters
- Visible in the History modal (top bar)

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Browser                                         │
│  ├─ Notebook Editor (contenteditable)            │
│  ├─ Underlined Sentences (hover to see popover)  │
│  └─ Pixelated Pets (animate when engines fire)   │
└───────────────────────┬─────────────────────────┘
                        │ sentence completed
┌───────────────────────▼─────────────────────────┐
│  Next.js App (single deployable)                 │
│  ├─ Content Analyzer → routes to engines         │
│  ├─ 4 AI Engines:                                │
│  │   Diogenes  Socrates  Galileo  Aristotle      │
│  ├─ Find Sources (web search + add to library)   │
│  └─ AI Service (provider abstraction)            │
└──────┬────────────────┬──────────────────────────┘
       │                │
       ▼                ▼
┌──────────┐    ┌──────────────┐
│ Database │    │ LLM API      │
│ SQLite/  │    │ Gemini/Groq/ │
│ Postgres │    │ OpenAI       │
└──────────┘    └──────────────┘
```

**See also**: `download/cogdoc/diagram_pngs/02_architecture_simple.png` for the rendered Mermaid diagram, and `08_writing_loop.png` for the user-facing writing loop.

**Stack**: Next.js 16 · TypeScript 5 · Tailwind CSS 4 · shadcn/ui · Prisma ORM · Zustand · Framer Motion · z-ai-web-dev-sdk · pdf-parse

**Data model**: Workspace-compatible Project records plus immutable document versions, references, citations, claims, evidence links, review runs/items/responses, append-only audit events, code snapshots, verification reports, certificates, and revocable shares — see `prisma/schema.prisma`.

**AI provider abstraction**: All engines call `AIService` (interface) → `ZAIAdapter` (concrete). Swapping to OpenAI or a local LLM is one new adapter class. Prompt templates are versioned in DB — edits don't require redeploy.

---

## Configuration

All env vars (set via Docker wizard or directly):

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | — | Required PostgreSQL/Supabase URL |
| `COGDOC_CERTIFICATE_PRIVATE_KEY` | generated by Docker | Ed25519 PKCS#8 PEM or base64 PEM |
| `COGDOC_STORAGE_DIR` | `.data/assets` | Private local-development asset store |
| `AI_PROVIDER` | `gemini` | `gemini` / `groq` / `custom` |
| `AI_BASE_URL` | — | OpenAI-compatible base URL |
| `AI_API_KEY` | — | API key |
| `AI_MODEL` | `gemini-2.0-flash` | Model name |
| `IDLE_THRESHOLD` | `2` | Seconds of idle before Socratic fires |
| `DAILY_TOKEN_BUDGET` | `100000` | Per-user daily LLM token budget |
| `SUPABASE_URL` | — | Optional Supabase auth |
| `SUPABASE_JWT_SECRET` | — | Optional JWT verification |

See `.env.example` for the full template.

---

## Documentation

- **[Assignment/research workspace implementation](./docs/implementation/assignment-research-workspace.md)** — shipped flow, certificate invariants, deployment, and operational boundaries
- **[USER_GUIDE.md](./USER_GUIDE.md)** — for writers and examiners (non-technical)
- **[DEVELOPER.md](./DEVELOPER.md)** — for developers (setup, schema, how to add an engine, how to swap the LLM)
- **[README-DOCKER.md](./README-DOCKER.md)** — Docker deployment guide
- **[download/cogdoc/Cogdoc_System_Architecture_Design.pdf](./download/cogdoc/)** — full architecture design document (36 pages, 7 diagrams, 7 ADRs, 3NF schema walkthrough)

---

## Project structure

```
src/
├── app/
│   ├── api/                    # API routes (projects, engines, pdfs, etc.)
│   ├── globals.css
│   ├── layout.tsx              # Root layout (Newsreader + Geist fonts)
│   └── page.tsx                # Dashboard / Editor view switch
├── components/
│   ├── cogdoc/
│   │   ├── dashboard.tsx       # Project list + create
│   │   ├── editor-shell.tsx    # Top bar + modals (Library/Stats/History/Export)
│   │   ├── editor.tsx          # contenteditable + engine firing + highlighting
│   │   ├── sentence-popover.tsx # Hover popover with actionable insights
│   │   ├── research-library.tsx # PDF upload + paste-text
│   │   └── analytics-panel.tsx # Stats charts
│   └── ui/                     # shadcn/ui components
├── lib/
│   ├── ai-service.ts           # AIService interface + ZAIAdapter
│   ├── content-analyzer.ts     # Sentence classification → engine routing
│   ├── retrieval.ts            # Keyword-overlap RAG retrieval
│   ├── sentence-highlight.ts   # <mark> wrapping with multi-color underlines
│   ├── store.ts                # Zustand global state
│   ├── types.ts                # Shared TypeScript types
│   └── db.ts                   # Prisma client
└── prisma/
    ├── schema.prisma           # SQLite schema
    └── schema.postgres.prisma  # Postgres schema (Supabase-ready)
```

---

## License

Final Year Project — BSc (Hons) IT, Asia Pacific University, 2026.
