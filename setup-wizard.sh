#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Cogdoc — First-run setup wizard
# Prompts the user for API keys and writes them to /data/.env
# Then writes .z-ai-config so z-ai-web-dev-sdk picks up the chosen provider.
#
# This script is sourced by entrypoint.sh when /data/.env does not exist.
# It can also be run directly: docker run -it --rm -v cogdoc_data:/data cogdoc:latest setup
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# Color helpers
if [ -t 1 ]; then
  BOLD='\033[1m'; DIM='\033[2m'; GREEN='\033[32m'; YELLOW='\033[33m'
  BLUE='\033[34m'; MAGENTA='\033[35m'; CYAN='\033[36m'; RED='\033[31m'
  RESET='\033[0m'
else
  BOLD=''; DIM=''; GREEN=''; YELLOW=''; BLUE=''; MAGENTA=''; CYAN=''; RED=''; RESET=''
fi

say()  { printf "%b\n" "$1"; }
ask()  { printf "%b" "$1"; read -r "$2"; }
ask_s(){ printf "%b" "$1"; read -rs "$2"; printf "\n"; }  # silent (for secrets)
hdr()  { printf "\n%b━━━ %b%s%b %b\n" "$CYAN" "$BOLD" "$1" "$RESET" "$CYAN"; }

ENV_FILE="/data/.env"
ZAI_FILE="/data/.z-ai-config"

mkdir -p /data

# ── Welcome ──────────────────────────────────────────────────────────────────
say ""
say "${BOLD}${MAGENTA}╔══════════════════════════════════════════════════════════════════╗${RESET}"
say "${BOLD}${MAGENTA}║                                                                  ║${RESET}"
say "${BOLD}${MAGENTA}║   Cogdoc — First-run Setup Wizard                                ║${RESET}"
say "${BOLD}${MAGENTA}║   A research-assisted writing IDE with productive AI friction   ║${RESET}"
say "${BOLD}${MAGENTA}║                                                                  ║${RESET}"
say "${BOLD}${MAGENTA}╚══════════════════════════════════════════════════════════════════╝${RESET}"
say ""
say "This wizard configures Cogdoc for first use. You'll be asked for:"
say "  ${DIM}1.${RESET}  AI provider choice (Gemini / Groq / OpenAI-compatible)"
say "  ${DIM}2.${RESET}  PostgreSQL database connection"
say "  ${DIM}3.${RESET}  Supabase auth keys (optional — for JWT verification)"
say "  ${DIM}4.${RESET}  App settings (port, token budget)"
say ""
say "All values are saved to ${BOLD}/data/.env${RESET} (persisted via volume)."
say "Re-run this wizard anytime with: ${BOLD}docker run -it --rm -v cogdoc_data:/data cogdoc:latest setup${RESET}"
say ""

# ── 1. AI Provider ───────────────────────────────────────────────────────────
hdr "1/4  AI Provider"

say "Cogdoc needs an LLM provider for the four AI engines (Interceptor, Socratic Spacer,"
say "Citation Sentinel, Scaffold). All providers use an OpenAI-compatible API."
say ""
say "  ${BOLD}1)${RESET} Google Gemini       ${DIM}(https://generativelanguage.googleapis.com/v1beta/openai)${RESET}"
say "  ${BOLD}2)${RESET} Groq                 ${DIM}(https://api.groq.com/openai/v1, fast inference)${RESET}"
say "  ${BOLD}3)${RESET} OpenAI-compatible    ${DIM}(bring your own base URL — OpenAI, Together, Ollama, etc.)${RESET}"
say "  ${BOLD}4)${RESET} Skip                 ${DIM}(use whatever .z-ai-config is already mounted)${RESET}"
say ""

AI_PROVIDER=""
AI_BASE_URL=""
AI_API_KEY=""
AI_MODEL=""
DEFAULT_MODEL=""

while true; do
  ask "${BOLD}Choose provider [1-4]: ${RESET}" choice
  case "${choice:-1}" in
    1)
      AI_PROVIDER="gemini"
      AI_BASE_URL="https://generativelanguage.googleapis.com/v1beta/openai"
      DEFAULT_MODEL="gemini-3.5-flash-lite"
      say "${GREEN}✓${RESET} Google Gemini selected."
      ask_s "${BOLD}Enter your Gemini API key (AIza...): ${RESET}" AI_API_KEY
      if [ -z "$AI_API_KEY" ]; then
        say "${RED}No key entered. You can set GEMINI_API_KEY later.${RESET}"
      fi
      ;;
    2)
      AI_PROVIDER="groq"
      AI_BASE_URL="https://api.groq.com/openai/v1"
      DEFAULT_MODEL="llama-3.3-70b-versatile"
      say "${GREEN}✓${RESET} Groq selected."
      ask_s "${BOLD}Enter your Groq API key (gsk_...): ${RESET}" AI_API_KEY
      if [ -z "$AI_API_KEY" ]; then
        say "${RED}No key entered. You can set GROQ_API_KEY later.${RESET}"
      fi
      ;;
    3)
      AI_PROVIDER="custom"
      ask "${BOLD}Enter base URL (e.g. https://api.openai.com/v1): ${RESET}" AI_BASE_URL
      ask_s "${BOLD}Enter API key: ${RESET}" AI_API_KEY
      DEFAULT_MODEL="gpt-4o-mini"
      say "${GREEN}✓${RESET} Custom OpenAI-compatible endpoint configured."
      ;;
    4)
      AI_PROVIDER="skip"
      say "${YELLOW}Skipping AI provider config. Make sure /data/.z-ai-config is mounted.${RESET}"
      ;;
    *)
      say "${RED}Invalid choice. Please enter 1, 2, 3, or 4.${RESET}"
      continue
      ;;
  esac
  break
done

# Model selection (if provider chosen)
if [ "$AI_PROVIDER" != "skip" ] && [ -n "$DEFAULT_MODEL" ]; then
  ask "${BOLD}Model to use [${DEFAULT_MODEL}]: ${RESET}" AI_MODEL
  AI_MODEL="${AI_MODEL:-$DEFAULT_MODEL}"
fi

# ── 2. Database ──────────────────────────────────────────────────────────────
hdr "2/4  Database"

say "The assignment, review, audit, and certificate models require PostgreSQL. Choose:"
say ""
say "  ${BOLD}1)${RESET} Supabase Postgres ${DIM}(use your Supabase project's connection string)${RESET}"
say "  ${BOLD}2)${RESET} External Postgres ${DIM}(any PostgreSQL URL)${RESET}"
say ""

DB_PROVIDER=""
DATABASE_URL=""

while true; do
  ask "${BOLD}Choose database [1-2, default=1]: ${RESET}" db_choice
  db_choice="${db_choice:-1}"
  case "$db_choice" in
    1)
      DB_PROVIDER="supabase"
      say "Get your connection string from Supabase Dashboard → Project Settings → Database → Connection string (URI)."
      say "${DIM}It looks like: postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres${RESET}"
      ask "${BOLD}Paste Supabase Postgres URL: ${RESET}" DATABASE_URL
      if [ -z "$DATABASE_URL" ]; then
        say "${RED}A PostgreSQL URL is required.${RESET}"
        continue
      fi
      say "${GREEN}✓${RESET} Supabase Postgres configured."
      ;;
    2)
      DB_PROVIDER="postgres"
      ask "${BOLD}Paste Postgres URL (postgresql://user:pass@host:5432/db): ${RESET}" DATABASE_URL
      if [ -z "$DATABASE_URL" ]; then
        say "${RED}A PostgreSQL URL is required.${RESET}"
        continue
      fi
      say "${GREEN}✓${RESET} External Postgres configured."
      ;;
    *)
      say "${RED}Invalid choice. Please enter 1 or 2.${RESET}"
      continue
      ;;
  esac
  break
done

# ── 3. Supabase Auth (optional) ──────────────────────────────────────────────
hdr "3/4  Supabase Auth (optional)"

say "If you want to use Supabase for authentication (JWT verification), provide your project keys."
say "${DIM}Leave blank only for a private one-person installation; the wizard records that explicit choice.${RESET}"
say ""

NEXT_PUBLIC_SUPABASE_URL=""
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=""
SUPABASE_SERVICE_ROLE_KEY=""
SUPABASE_JWT_SECRET=""
COGDOC_SINGLE_USER_MODE="false"

ask "${BOLD}Supabase Project URL (https://xxx.supabase.co) [blank for private single-user mode]: ${RESET}" NEXT_PUBLIC_SUPABASE_URL
if [ -n "$NEXT_PUBLIC_SUPABASE_URL" ]; then
  ask_s "${BOLD}Supabase publishable (or legacy anon) key: ${RESET}" NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ask_s "${BOLD}Supabase service_role key: ${RESET}" SUPABASE_SERVICE_ROLE_KEY
  ask_s "${BOLD}Supabase JWT secret: ${RESET}" SUPABASE_JWT_SECRET
  say "${GREEN}✓${RESET} Supabase auth configured."
else
  COGDOC_SINGLE_USER_MODE="true"
  say "${YELLOW}!${RESET} Explicit private single-user mode selected. Do not expose this deployment to multiple users."
fi

# ── 4. App settings ──────────────────────────────────────────────────────────
hdr "4/4  App Settings"

ask "${BOLD}Daily token budget per user [100000]: ${RESET}" DAILY_TOKEN_BUDGET
DAILY_TOKEN_BUDGET="${DAILY_TOKEN_BUDGET:-100000}"

ask "${BOLD}Socratic Spacer idle threshold (seconds) [2]: ${RESET}" IDLE_THRESHOLD
IDLE_THRESHOLD="${IDLE_THRESHOLD:-2}"

# ── Write /data/.env ─────────────────────────────────────────────────────────
hdr "Writing configuration"

# Build the .env file from collected values
{
  echo "# Cogdoc configuration — generated by setup-wizard.sh"
  echo "# Generated: $(date -u +'%Y-%m-%dT%H:%M:%SZ')"
  echo ""
  echo "# ── Database ──"
  echo "DATABASE_URL=\"${DATABASE_URL}\""
  echo "DB_PROVIDER=\"${DB_PROVIDER}\""
  echo ""
  echo "# ── AI Provider ──"
  if [ -n "$AI_PROVIDER" ]; then
    echo "AI_PROVIDER=\"${AI_PROVIDER}\""
  fi
  if [ -n "$AI_BASE_URL" ]; then
    echo "AI_BASE_URL=\"${AI_BASE_URL}\""
  fi
  if [ -n "$AI_API_KEY" ]; then
    echo "AI_API_KEY=\"${AI_API_KEY}\""
  fi
  if [ -n "$AI_MODEL" ]; then
    echo "AI_MODEL=\"${AI_MODEL}\""
  fi
  # Also expose under provider-specific var names for direct SDK use
  if [ "$AI_PROVIDER" = "gemini" ] && [ -n "$AI_API_KEY" ]; then
    echo "GEMINI_API_KEY=\"${AI_API_KEY}\""
  fi
  if [ "$AI_PROVIDER" = "groq" ] && [ -n "$AI_API_KEY" ]; then
    echo "GROQ_API_KEY=\"${AI_API_KEY}\""
  fi
  echo ""
  echo "# ── Supabase Auth (optional) ──"
  if [ -n "$NEXT_PUBLIC_SUPABASE_URL" ]; then
    echo "NEXT_PUBLIC_SUPABASE_URL=\"${NEXT_PUBLIC_SUPABASE_URL}\""
    echo "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=\"${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}\""
    echo "SUPABASE_SERVICE_ROLE_KEY=\"${SUPABASE_SERVICE_ROLE_KEY}\""
    echo "SUPABASE_JWT_SECRET=\"${SUPABASE_JWT_SECRET}\""
  else
    echo "# Explicit private single-user mode; never use for a public/shared deployment."
  fi
  echo "COGDOC_SINGLE_USER_MODE=\"${COGDOC_SINGLE_USER_MODE}\""
  echo ""
  echo "# ── App Settings ──"
  echo "DAILY_TOKEN_BUDGET=\"${DAILY_TOKEN_BUDGET}\""
  echo "IDLE_THRESHOLD=\"${IDLE_THRESHOLD}\""
  echo ""
  echo "# ── Runtime ──"
  echo "NODE_ENV=\"production\""
  echo "PORT=\"3000\""
  echo "HOSTNAME=\"0.0.0.0\""
} > "$ENV_FILE"

say "${GREEN}✓${RESET} Wrote ${BOLD}${ENV_FILE}${RESET}"

# ── Write /data/.z-ai-config (for z-ai-web-dev-sdk) ──────────────────────────
if [ "$AI_PROVIDER" != "skip" ] && [ -n "$AI_BASE_URL" ] && [ -n "$AI_API_KEY" ]; then
  # .z-ai-config is JSON, read by z-ai-web-dev-sdk
  cat > "$ZAI_FILE" <<EOF
{
  "baseUrl": "${AI_BASE_URL}",
  "apiKey": "${AI_API_KEY}",
  "model": "${AI_MODEL}"
}
EOF
  say "${GREEN}✓${RESET} Wrote ${BOLD}${ZAI_FILE}${RESET} (${AI_PROVIDER} → ${AI_MODEL})"
else
  say "${YELLOW}!${RESET} Skipped .z-ai-config — make sure it's mounted at /data/.z-ai-config"
fi

# ── Summary ──────────────────────────────────────────────────────────────────
hdr "Setup complete"
say ""
say "  ${BOLD}Provider:${RESET}  ${AI_PROVIDER:-skip}  ${DIM}(${AI_MODEL:-no model})${RESET}"
say "  ${BOLD}Database:${RESET}  ${DB_PROVIDER}  ${DIM}(connection saved; credential hidden)${RESET}"
if [ -n "$NEXT_PUBLIC_SUPABASE_URL" ]; then
  say "  ${BOLD}Auth:${RESET}      Supabase (${NEXT_PUBLIC_SUPABASE_URL})"
else
  say "  ${BOLD}Auth:${RESET}      single-user (no auth)"
fi
say "  ${BOLD}Budget:${RESET}    ${DAILY_TOKEN_BUDGET} tokens/user/day"
say ""
say "Cogdoc will now:"
say "  ${DIM}1.${RESET} Apply the Prisma schema to your database (db push)"
say "  ${DIM}2.${RESET} Seed the 4 behaviour-tagged prompt templates"
say "  ${DIM}3.${RESET} Start the Next.js server on port 3000"
say ""
say "${BOLD}Open http://localhost:3000 in your browser once the server is up.${RESET}"
say ""
