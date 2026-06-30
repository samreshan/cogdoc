#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Cogdoc — Docker build helper
#
# Usage:
#   ./docker-build.sh                  # local build for current arch
#   ./docker-build.sh --multi-arch     # buildx multi-arch (amd64 + arm64), push
#   ./docker-build.sh --load           # buildx single-arch, load into docker
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

IMAGE_NAME="${IMAGE_NAME:-cogdoc}"
IMAGE_TAG="${IMAGE_TAG:-latest}"

# Allow overriding the registry for multi-arch pushes
REGISTRY="${REGISTRY:-}"

# Colors
if [ -t 1 ]; then
  BOLD='\033[1m'; GREEN='\033[32m'; YELLOW='\033[33m'; CYAN='\033[36m'; RED='\033[31m'; RESET='\033[0m'
else
  BOLD=''; GREEN=''; YELLOW=''; CYAN=''; RED=''; RESET=''
fi

say() { printf "%b\n" "$1"; }

MODE="${1:-local}"

show_help() {
  cat <<EOF
${BOLD}Cogdoc Docker build helper${RESET}

${BOLD}Usage:${RESET}
  ./docker-build.sh                  Build for current architecture (local docker build)
  ./docker-build.sh --load           Buildx single-arch, load into local docker
  ./docker-build.sh --multi-arch     Buildx multi-arch (amd64 + arm64), requires --push
  ./docker-build.sh --multi-arch --push REGISTRY=ghcr.io/youruser

${BOLD}Environment:${RESET}
  IMAGE_NAME  Image name (default: cogdoc)
  IMAGE_TAG   Image tag (default: latest)
  REGISTRY    Registry to push to (for --multi-arch --push)

${BOLD}Examples:${RESET}
  # Quick local build
  ./docker-build.sh

  # Multi-arch build + push to Docker Hub
  docker login
  REGISTRY=yourdockerhubuser ./docker-build.sh --multi-arch --push

  # Multi-arch build + push to GitHub Container Registry
  echo \$GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin
  REGISTRY=ghcr.io/youruser ./docker-build.sh --multi-arch --push

EOF
}

# Parse args
DO_PUSH=false
DO_MULTIARCH=false
DO_LOAD=false
for arg in "$@"; do
  case "$arg" in
    --help|-h) show_help; exit 0 ;;
    --multi-arch) DO_MULTIARCH=true ;;
    --push) DO_PUSH=true ;;
    --load) DO_LOAD=true ;;
    --*) say "${RED}Unknown flag: $arg${RESET}"; show_help; exit 1 ;;
  esac
done

# Resolve final image tag
if [ -n "$REGISTRY" ]; then
  FULL_TAG="${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"
else
  FULL_TAG="${IMAGE_NAME}:${IMAGE_TAG}"
fi

say "${CYAN}━━━ Cogdoc Docker Build ━━━${RESET}"
say "  Image: ${BOLD}${FULL_TAG}${RESET}"
say "  Mode:  ${BOLD}${MODE}${RESET}"
say ""

# ── Multi-arch build ────────────────────────────────────────────────────────
if [ "$DO_MULTIARCH" = "true" ]; then
  # Ensure buildx is available
  if ! docker buildx version >/dev/null 2>&1; then
    say "${RED}docker buildx is not installed. Install Docker Buildx first:${RESET}"
    say "  https://github.com/docker/buildx#install"
    exit 1
  fi

  # Create a multi-arch builder if it doesn't exist
  if ! docker buildx ls | grep -q "cogdoc-builder"; then
    say "${CYAN}Creating buildx builder 'cogdoc-builder'...${RESET}"
    docker buildx create --use --name cogdoc-builder --driver docker-container
  else
    docker buildx use cogdoc-builder
  fi

  # Ensure QEMU is registered for cross-platform builds
  if ! docker buildx inspect --bootstrap | grep -q "linux/arm64"; then
    say "${CYAN}Installing QEMU for cross-platform builds...${RESET}"
    docker run --rm --privileged tonistiigi/binfmt --install all
  fi

  PLATFORMS="linux/amd64,linux/arm64"

  if [ "$DO_PUSH" = "true" ]; then
    say "${CYAN}Building multi-arch and pushing: ${PLATFORMS}${RESET}"
    docker buildx build \
      --platform "$PLATFORMS" \
      -t "$FULL_TAG" \
      --push \
      .
    say "${GREEN}✓${RESET} Pushed ${BOLD}${FULL_TAG}${RESET} for ${PLATFORMS}"
  else
    say "${YELLOW}Note: multi-arch builds cannot be loaded locally with --load.${RESET}"
    say "${YELLOW}      Add ${BOLD}--push${RESET} to push to a registry, or use ${BOLD}--load${RESET} for single-arch.${RESET}"
    say "${CYAN}Building multi-arch (no push): ${PLATFORMS}${RESET}"
    docker buildx build \
      --platform "$PLATFORMS" \
      -t "$FULL_TAG" \
      .
    say "${GREEN}✓${RESET} Built ${BOLD}${FULL_TAG}${RESET} for ${PLATFORMS} (use --push to publish)"
  fi
  exit 0
fi

# ── Single-arch buildx with --load ──────────────────────────────────────────
if [ "$DO_LOAD" = "true" ]; then
  say "${CYAN}Building (buildx, single-arch, --load)...${RESET}"
  docker buildx build \
    --load \
    -t "$FULL_TAG" \
    .
  say "${GREEN}✓${RESET} Built ${BOLD}${FULL_TAG}${RESET}"
  exit 0
fi

# ── Plain local build (default) ─────────────────────────────────────────────
say "${CYAN}Building (local docker build)...${RESET}"
docker build -t "$FULL_TAG" .
say "${GREEN}✓${RESET} Built ${BOLD}${FULL_TAG}${RESET}"
say ""
say "Run it:"
say "  docker run -it -p 3000:3000 -v cogdoc_data:/data ${FULL_TAG}"
