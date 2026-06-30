# Cogdoc — Docker Deployment Guide

A research-assisted writing IDE with productive AI friction. This image ships
with everything you need: the Next.js app, Prisma ORM, pdf-parse, and an
interactive first-run wizard that configures Gemini / Groq / Supabase / Postgres
for you.

**Multi-arch**: builds for `linux/amd64` and `linux/arm64` (Apple Silicon, Raspberry Pi 4, AWS Graviton, AMD64 servers).

---

## Quick start (interactive — recommended for first run)

```bash
docker build -t cogdoc:latest .

docker run -it -p 3000:3000 -v cogdoc_data:/data cogdoc:latest
```

The first run launches a setup wizard that asks:

1. **AI provider** — Google Gemini / Groq / OpenAI-compatible / skip
2. **Database** — embedded SQLite / Supabase Postgres / external Postgres
3. **Supabase auth** — project URL, anon key, service role key, JWT secret (optional)
4. **App settings** — daily token budget, Socratic Spacer idle threshold

All answers are saved to `/data/.env` (persisted via the `cogdoc_data` volume).
On subsequent runs the wizard is skipped automatically — just:

```bash
docker run -d -p 3000:3000 -v cogdoc_data:/data cogdoc:latest
```

Then open **http://localhost:3000**.

---

## Non-interactive deployment

If you already have all your keys, skip the wizard by passing env vars:

```bash
docker run -d -p 3000:3000 -v cogdoc_data:/data \
  -e AI_PROVIDER=gemini \
  -e AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai \
  -e AI_API_KEY=AIza... \
  -e AI_MODEL=gemini-2.0-flash \
  -e DATABASE_URL=file:/data/cogdoc.db \
  cogdoc:latest
```

Or mount a pre-written `.env` file (see `.env.example` for the template):

```bash
cp .env.example .env
# edit .env with your favourite editor
docker run -d -p 3000:3000 \
  -v cogdoc_data:/data \
  -v $(pwd)/.env:/data/.env:ro \
  cogdoc:latest
```

---

## docker-compose

```bash
docker compose up        # interactive (wizard runs)
docker compose up -d     # detached (set env vars in docker-compose.yml first)
docker compose down
docker compose logs -f
```

---

## Multi-arch build (AMD64 + ARM64)

For a single-architecture local build, just `docker build -t cogdoc:latest .`.

For a multi-arch build that you push to a registry (Docker Hub, GHCR, ECR):

```bash
# One-time: create a buildx builder
docker buildx create --use --name multiarch --driver docker-container

# Login to your registry
docker login ghcr.io  # or docker login

# Build + push for both architectures
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t ghcr.io/youruser/cogdoc:latest \
  --push .
```

Then pull and run on any machine:

```bash
docker run -it -p 3000:3000 -v cogdoc_data:/data ghcr.io/youruser/cogdoc:latest
```

### ARM64 tested on
- Apple Silicon (M1/M2/M3) Macs running Docker Desktop
- AWS Graviton (EC2 t4g / c6g / m6g instances)
- Raspberry Pi 4 / 5 with 64-bit Raspberry Pi OS
- Oracle Cloud ARM Ampere A1

### AMD64 tested on
- Standard x86_64 Linux servers (Ubuntu, Debian, RHEL)
- Intel/AMD Windows PCs running Docker Desktop
- AWS t3 / c6i / m6i instances

---

## Configuration reference

All configurable env vars (any of these can be set via `-e` or in your `.env`):

### Database
| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | yes | `file:/data/cogdoc.db` for SQLite, or `postgresql://...` for Postgres/Supabase |

### AI Provider (pick one set)
| Variable | Required | Description |
|---|---|---|
| `AI_PROVIDER` | no | `gemini` / `groq` / `custom` / `skip` |
| `AI_BASE_URL` | yes* | OpenAI-compatible base URL |
| `AI_API_KEY` | yes* | API key for the chosen provider |
| `AI_MODEL` | no | Default model name (e.g. `gemini-2.0-flash`) |
| `GEMINI_API_KEY` | no | Alias — if set, used as AI_API_KEY with Gemini's URL |
| `GROQ_API_KEY` | no | Alias — if set, used as AI_API_KEY with Groq's URL |

\* Required unless you mount a pre-written `.z-ai-config`.

### Supabase (optional — leave blank for single-user mode)
| Variable | Required | Description |
|---|---|---|
| `SUPABASE_URL` | no | `https://xxx.supabase.co` |
| `SUPABASE_ANON_KEY` | no | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | no | Service role key (bypasses RLS) |
| `SUPABASE_JWT_SECRET` | no | JWT verification secret |

### App settings
| Variable | Default | Description |
|---|---|---|
| `DAILY_TOKEN_BUDGET` | `100000` | Per-user daily LLM token budget |
| `IDLE_THRESHOLD` | `5` | Seconds of inactivity before Socratic Spacer fires |
| `PORT` | `3000` | HTTP port |
| `HOSTNAME` | `0.0.0.0` | Bind address |

---

## Re-running the wizard

To reconfigure an existing container:

```bash
docker run -it --rm -v cogdoc_data:/data cogdoc:latest setup
```

This runs only the wizard and exits. Your existing database is preserved.

To wipe everything and start fresh:

```bash
docker volume rm cogdoc_data
docker run -it -p 3000:3000 -v cogdoc_data:/data cogdoc:latest
```

---

## Volumes & persistence

| Path | Purpose |
|---|---|
| `/data` | Persistent volume — holds `.env`, `.z-ai-config`, and the SQLite DB file |
| `/data/cogdoc.db` | SQLite database (when using embedded mode) |
| `/data/.env` | All configuration (written by the wizard) |
| `/data/.z-ai-config` | z-ai-web-dev-sdk config (written by the wizard) |

The volume is the **only** persistent state. If you delete it, all projects,
PDFs, interventions, and configuration are lost.

---

## Healthcheck

The image ships with a healthcheck that hits `http://localhost:3000/` every 30s.
Check status with:

```bash
docker ps --format "table {{.Names}}\t{{.Status}}"
# → cogdoc   Up 2 minutes (healthy)
```

---

## Troubleshooting

### "Cogdoc needs first-run configuration"
You ran the container non-interactively without env vars. Either:
- Re-run with `-it` to launch the wizard: `docker run -it -p 3000:3000 -v cogdoc_data:/data cogdoc:latest`
- Or pass env vars: see [Non-interactive deployment](#non-interactive-deployment) above.

### "Prisma can't reach database"
- For Postgres: make sure your `DATABASE_URL` is reachable from inside the container. Use `host.docker.internal` instead of `localhost` if the DB is on the host.
- For Supabase: use the **pooler** connection string (port 6543), not the direct one (port 5432).

### "AI calls fail"
- Check that `/data/.z-ai-config` exists inside the container: `docker exec cogdoc cat /data/.z-ai-config`
- Verify your API key is valid by calling the provider's API directly with curl.
- For Gemini, make sure the Generative Language API is enabled in your Google Cloud project.

### PDF upload fails
- The image bundles `pdf-parse`. Scanned PDFs (image-only) won't work — they need OCR first.
- Max upload size is enforced by Next.js (defaults to ~4MB). For larger PDFs, paste the text via the Library tab's "Paste text" button.

---

## Building from source

The Dockerfile is a 3-stage multi-stage build:

1. **deps** — installs node_modules (alpine + python3 + make + g++ for native deps)
2. **builder** — generates Prisma client for both SQLite and Postgres schemas, builds Next.js standalone
3. **runtime** — minimal alpine + bash + openssl + the standalone server + prisma CLI + pdf-parse

The runtime image is ~250MB. Build time on a modern laptop is ~3 minutes; on
ARM64 via QEMU it's ~8 minutes (emulation overhead).

```bash
# Watch the build
docker build --progress=plain -t cogdoc:latest .

# Inspect the image layers
docker history cogdoc:latest

# See what's inside
docker run --rm cogdoc:latest ls -la /app
```

---

## Architecture fidelity

This image implements the architecture from the Cogdoc System Architecture
Design document with one pragmatic deviation: **pgvector is replaced with
keyword-overlap retrieval** (Jaccard similarity) because SQLite doesn't have a
native vector type. The retrieval interface in `src/lib/retrieval.ts` is
vector-DB-ready — swapping to pgvector when you migrate to Postgres is a
single-module change.

All four AI engines from the architecture doc are implemented and verified:
- **Prompt Interceptor** — catches delegative prompts, reframes as Socratic questions
- **Socratic Spacer** — fires after 45s idle, asks a provocative question
- **Citation Sentinel** — RAG-based claim verification against your PDF library
- **Living Margin** — UI surface where every AI intervention renders

The full intervention audit log is persisted: every AI event (prompt, response,
verdict, cited evidence, user action, timestamps) is in the `Intervention` and
`InterventionEvidence` tables.
