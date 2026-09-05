# ─────────────────────────────────────────────────────────────────────────────
# Cogdoc MVP — Multi-arch Docker Image (linux/amd64 + linux/arm64)
# ─────────────────────────────────────────────────────────────────────────────
# Build:
#   docker build -t cogdoc:latest .
#
# Multi-arch build (requires docker buildx + QEMU):
#   docker buildx create --use --name multiarch --driver docker-container  # one-time
#   docker buildx build --platform linux/amd64,linux/arm64 -t cogdoc:latest --push .
#
# Run (interactive first run — wizard will prompt for API keys):
#   docker run -it -p 3000:3000 -v cogdoc_data:/data cogdoc:latest
#
# Run (non-interactive — env vars pre-set):
#   docker run -d -p 3000:3000 -v cogdoc_data:/data \
#     -e GEMINI_API_KEY=... -e SUPABASE_URL=... cogdoc:latest
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: deps ────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat openssl python3 make g++
WORKDIR /app

# Copy lockfile + package.json first for cache
COPY package.json bun.lock* package-lock.json* ./
# Install with npm (works on all arches; bun arm64 support varies)
RUN npm ci --include=dev || npm install --include=dev

# ── Stage 2: builder ─────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat openssl python3 make g++
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# The real-world workspace uses PostgreSQL/Supabase for RLS, version history,
# review jobs and certificate records.
RUN npx prisma generate --schema=prisma/schema.prisma

# Build Next.js (produces .next/standalone/)
RUN npm run build

# ── Stage 3: runtime ─────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime
# `wget` is used by the image health check below.
RUN apk add --no-cache libc6-compat openssl bash dialog wget

# Install both SQLite and Postgres Prisma engine binaries for multi-arch safety
# (Prisma 6 auto-detects, but we set BINARY_TARGETS to be explicit)
ENV PRISMA_ENGINES_MIRROR=https://binaries.prisma.sh

WORKDIR /app

# Set production env
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Copy standalone Next.js output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy Prisma schemas + migrations + seed script
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts

# Full node_modules (standalone output only bundles Next.js server deps;
# the Prisma CLI and its transitive deps like `effect`/`c12` need the rest).
COPY --from=builder /app/node_modules ./node_modules

# Copy entrypoint + wizard
COPY entrypoint.sh setup-wizard.sh ./
RUN chmod +x entrypoint.sh setup-wizard.sh

# Persistent volume: /data holds the SQLite DB, .env file, .z-ai-config
VOLUME ["/data"]

EXPOSE 3000

# Healthcheck: hit the homepage
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/ >/dev/null 2>&1 || exit 1

ENTRYPOINT ["./entrypoint.sh"]
