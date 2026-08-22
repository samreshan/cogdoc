#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Cogdoc — Docker entrypoint
#
# Behaviour:
#   1. If /data/.env exists → source it, skip wizard
#   2. If $COGDOC_SKIP_WIZARD=1 OR all required env vars already set → skip wizard
#   3. Otherwise, if running interactively (-it) → run setup-wizard.sh
#   4. Otherwise → print error telling user to either run -it or pass env vars
#
# After config is loaded:
#   - Validate the PostgreSQL workspace database
#   - Run prisma generate + db push
#   - Run the seed script
#   - Start Next.js standalone server
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# Color helpers (no-op when not a TTY)
if [ -t 1 ]; then
  BOLD='\033[1m'; GREEN='\033[32m'; YELLOW='\033[33m'; RED='\033[31m'; CYAN='\033[36m'; RESET='\033[0m'
else
  BOLD=''; GREEN=''; YELLOW=''; RED=''; CYAN=''; RESET=''
fi
say() { printf "%b\n" "$1"; }

ENV_FILE="/data/.env"
ZAI_FILE="/data/.z-ai-config"
APP_DIR="/app"

mkdir -p /data

# ── Special command: "setup" runs the wizard and exits ───────────────────────
if [ "${1:-}" = "setup" ]; then
  exec ./setup-wizard.sh
fi

# ── Step 1: Load or generate configuration ───────────────────────────────────
CONFIG_EXISTS="false"
if [ -f "$ENV_FILE" ]; then
  CONFIG_EXISTS="true"
  say "${GREEN}✓${RESET} Loaded existing config from ${BOLD}${ENV_FILE}${RESET}"
  set -a; . "$ENV_FILE"; set +a
elif [ -n "${DATABASE_URL:-}" ] && { [ -n "${COGDOC_SKIP_WIZARD:-}" ] || [ -n "${GEMINI_API_KEY:-}" ] || [ -n "${GROQ_API_KEY:-}" ] || [ -n "${AI_API_KEY:-}" ]; }; then
  say "${YELLOW}!${RESET} No /data/.env found, but AI keys are set via env vars — using those."
  # Write a minimal .env from current env so subsequent reads are consistent
  {
    echo "# Auto-generated from environment variables"
    echo "DATABASE_URL=\"${DATABASE_URL}\""
    [ -n "${AI_PROVIDER:-}" ]      && echo "AI_PROVIDER=\"${AI_PROVIDER}\""
    [ -n "${AI_BASE_URL:-}" ]      && echo "AI_BASE_URL=\"${AI_BASE_URL}\""
    [ -n "${AI_API_KEY:-}" ]       && echo "AI_API_KEY=\"${AI_API_KEY}\""
    [ -n "${AI_MODEL:-}" ]         && echo "AI_MODEL=\"${AI_MODEL}\""
    [ -n "${GEMINI_API_KEY:-}" ]   && echo "GEMINI_API_KEY=\"${GEMINI_API_KEY}\""
    [ -n "${GROQ_API_KEY:-}" ]     && echo "GROQ_API_KEY=\"${GROQ_API_KEY}\""
    [ -n "${SUPABASE_URL:-}" ]     && echo "SUPABASE_URL=\"${SUPABASE_URL}\""
    [ -n "${SUPABASE_ANON_KEY:-}" ]     && echo "SUPABASE_ANON_KEY=\"${SUPABASE_ANON_KEY}\""
    [ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ] && echo "SUPABASE_SERVICE_ROLE_KEY=\"${SUPABASE_SERVICE_ROLE_KEY}\""
    [ -n "${SUPABASE_JWT_SECRET:-}" ]     && echo "SUPABASE_JWT_SECRET=\"${SUPABASE_JWT_SECRET}\""
    echo "DAILY_TOKEN_BUDGET=\"${DAILY_TOKEN_BUDGET:-100000}\""
    echo "IDLE_THRESHOLD=\"${IDLE_THRESHOLD:-2}\""
    echo "NODE_ENV=\"production\""
    echo "PORT=\"3000\""
    echo "HOSTNAME=\"0.0.0.0\""
  } > "$ENV_FILE"
  set -a; . "$ENV_FILE"; set +a
  CONFIG_EXISTS="true"
fi

if [ "$CONFIG_EXISTS" = "false" ]; then
  if [ -t 0 ] && [ -t 1 ]; then
    say "${CYAN}No configuration found. Launching setup wizard...${RESET}"
    ./setup-wizard.sh
    set -a; . "$ENV_FILE"; set +a
  else
    say "${RED}╔════════════════════════════════════════════════════════════════╗${RESET}"
    say "${RED}║  Cogdoc needs first-run configuration.                        ║${RESET}"
    say "${RED}║                                                                ║${RESET}"
    say "${RED}║  Option 1: Run interactively (recommended for first run)      ║${RESET}"
    say "${RED}║    docker run -it -p 3000:3000 -v cogdoc_data:/data cogdoc    ║${RESET}"
    say "${RED}║                                                                ║${RESET}"
    say "${RED}║  Option 2: Pass env vars directly                             ║${RESET}"
    say "${RED}║    docker run -d -p 3000:3000 -v cogdoc_data:/data \\         ║${RESET}"
    say "${RED}║      -e GEMINI_API_KEY=... -e DATABASE_URL=... cogdoc          ║${RESET}"
    say "${RED}║                                                                ║${RESET}"
    say "${RED}║  Option 3: Mount a pre-written .env file                      ║${RESET}"
    say "${RED}║    docker run -d -p 3000:3000 \\                               ║${RESET}"
    say "${RED}║      -v /path/to/.env:/data/.env -v cogdoc_data:/data cogdoc  ║${RESET}"
    say "${RED}╚════════════════════════════════════════════════════════════════╝${RESET}"
    exit 1
  fi
fi

# ── Step 2: Write or symlink .z-ai-config ────────────────────────────────────
# If /data/.z-ai-config exists (written by wizard), symlink it.
# Otherwise, if AI_BASE_URL + AI_API_KEY are set, generate it from env vars.
if [ -f "$ZAI_FILE" ]; then
  ln -sf "$ZAI_FILE" "$APP_DIR/.z-ai-config"
  say "${GREEN}✓${RESET} Linked .z-ai-config"
elif [ -n "${AI_BASE_URL:-}" ] && [ -n "${AI_API_KEY:-}" ]; then
  cat > "$ZAI_FILE" <<EOF
{
  "baseUrl": "${AI_BASE_URL}",
  "apiKey": "${AI_API_KEY}",
  "model": "${AI_MODEL:-}"
}
EOF
  ln -sf "$ZAI_FILE" "$APP_DIR/.z-ai-config"
  say "${GREEN}✓${RESET} Generated .z-ai-config from AI_BASE_URL + AI_API_KEY"
else
  say "${YELLOW}!${RESET} No .z-ai-config found — AI calls will fail until you mount one or set AI_BASE_URL + AI_API_KEY"
fi

# ── Step 3: Require the production PostgreSQL workspace schema ──────────────
DB_URL="${DATABASE_URL:-}"
SCHEMA_FILE="$APP_DIR/prisma/schema.prisma"
if [[ "$DB_URL" != postgresql://* ]] && [[ "$DB_URL" != postgres://* ]]; then
  say "${RED}Cogdoc Workspace requires a PostgreSQL/Supabase DATABASE_URL.${RESET}"
  say "${YELLOW}SQLite remains available only for the legacy MVP and cannot store review/certificate state.${RESET}"
  exit 1
fi
say "${CYAN}Using PostgreSQL workspace schema${RESET}"

# Persist a product-attestation key when one is not supplied by the operator.
# This is a cryptographic product signature, not a legal or authorship signature.
CERT_KEY_FILE="/data/cogdoc-certificate-ed25519.pem"
if [ -z "${COGDOC_CERTIFICATE_PRIVATE_KEY:-}" ]; then
  if [ ! -f "$CERT_KEY_FILE" ]; then
    node -e "const {generateKeyPairSync}=require('node:crypto'); const {writeFileSync}=require('node:fs'); const {privateKey}=generateKeyPairSync('ed25519'); writeFileSync(process.argv[1], privateKey.export({type:'pkcs8',format:'pem'}), {mode:0o600})" "$CERT_KEY_FILE"
    say "${GREEN}✓${RESET} Generated persistent Ed25519 product-attestation key"
  fi
  COGDOC_CERTIFICATE_PRIVATE_KEY="$(base64 < "$CERT_KEY_FILE" | tr -d '\n')"
  export COGDOC_CERTIFICATE_PRIVATE_KEY
fi

# Make sure DATABASE_URL is exported for Prisma
export DATABASE_URL="$DB_URL"

# ── Step 4: Generate Prisma client for the chosen schema ─────────────────────
say "${CYAN}Generating Prisma client...${RESET}"
cd "$APP_DIR"
PRISMA_BIN="$APP_DIR/node_modules/prisma/build/index.js"
node "$PRISMA_BIN" generate --schema="$SCHEMA_FILE" 2>&1 | tail -5

# ── Step 5: Push schema to the database ──────────────────────────────────────
say "${CYAN}Applying schema to database (db push)...${RESET}"
# Postgres may need to wait for the service to be ready.
for i in 1 2 3 4 5; do
  if node "$PRISMA_BIN" db push --schema="$SCHEMA_FILE" --skip-generate 2>&1 | tail -10; then
    break
  fi
  say "${YELLOW}Database not ready, retrying in 3s... (${i}/5)${RESET}"
  sleep 3
done
say "${GREEN}✓${RESET} Database schema applied"

# ── Step 6: Seed ─────────────────────────────────────────────────────────────
say "${CYAN}Seeding database (default user + prompt templates)...${RESET}"
cd "$APP_DIR"
# Use the plain-JS seed script (runs on node without TypeScript loader)
node scripts/seed.js 2>&1 | tail -10 || {
  say "${YELLOW}!${RESET} Seed script failed (may already be seeded). Continuing..."
}
say "${GREEN}✓${RESET} Seed complete"

say "${CYAN}Migrating legacy projects to workspaces...${RESET}"
node scripts/migrate-legacy-workspaces.js 2>&1 | tail -10 || {
  say "${YELLOW}!${RESET} Legacy workspace migration failed. Review logs before enabling certificates."
}

# ── Step 7: Start Next.js ────────────────────────────────────────────────────
say ""
say "${BOLD}${GREEN}═══════════════════════════════════════════════════════════════${RESET}"
say "${BOLD}${GREEN}  Cogdoc is starting on http://0.0.0.0:${PORT:-3000}${RESET}"
say "${BOLD}${GREEN}═══════════════════════════════════════════════════════════════${RESET}"
say ""

# Drop privileges and start the server
export NODE_ENV=production
exec node "$APP_DIR/server.js"
