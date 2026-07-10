#!/usr/bin/env bash
#
# Sprint-advance gate for Cogdoc.
#
# Runs the full TS test suite with coverage and enforces:
#   - all tests pass
#   - ≥80% lines/branches/functions/statements on src/lib + src/app/api
#
# Exit code 0 → sprint may advance. Non-zero → blocked.
#
# Python (FastAPI) tests are added to this gate from Sprint 1 onward,
# once the fastapi/ service exists.

set -euo pipefail

cd "$(dirname "$0")/.."

echo "═══════════════════════════════════════════════════════════════"
echo "  Cogdoc sprint gate — vitest (coverage ≥80% enforced)"
echo "═══════════════════════════════════════════════════════════════"

# TS gate (always runs once src tests exist)
if [ -d "$(pwd)/src" ]; then
  bun run test:coverage
  echo "✅ TS gate passed"
else
  echo "⚠️  no src/ — skipping TS gate"
fi

# Python gate (Sprint 1+)
if [ -d "$(pwd)/fastapi" ]; then
  echo "─── pytest (coverage ≥80% enforced) ─────────────────────────"
  # Use the venv if present, else fall back to system pytest
  if [ -f "$(pwd)/fastapi/.venv/bin/pytest" ]; then
    (cd fastapi && .venv/bin/pytest --cov=app --cov-report=term-missing --cov-fail-under=80 -q)
  else
    (cd fastapi && python3 -m pytest --cov=app --cov-report=term-missing --cov-fail-under=80 -q)
  fi
  echo "✅ Python gate passed"
fi

echo "═══════════════════════════════════════════════════════════════"
echo "  🟢 GATE PASSED — sprint may advance"
echo "═══════════════════════════════════════════════════════════════"
