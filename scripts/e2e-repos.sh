#!/usr/bin/env bash
# ============================================================================
# badge-sync E2E Test Script
# ============================================================================
# Tests badge-sync against real-world open-source repositories.
# Clones each repo (shallow), runs `badge-sync apply --dry-run`, and reports
# what badges would be generated.
#
# Usage:
#   ./scripts/e2e-repos.sh              # Run all repos
#   ./scripts/e2e-repos.sh python       # Run only Python repos
#   ./scripts/e2e-repos.sh --quick      # Run a small subset (5 repos)
#   ./scripts/e2e-repos.sh --verbose    # Show full dry-run output
#
# Exit codes:
#   0 — All repos processed (warnings are OK)
#   1 — Script error or badge-sync crashed on a repo
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WORK_DIR="${E2E_WORK_DIR:-/tmp/badge-sync-e2e}"
BADGE_SYNC="node $PROJECT_ROOT/dist/index.js"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Counters
TOTAL=0
PASSED=0
WARNED=0
FAILED=0

# Options
FILTER=""
QUICK=false
VERBOSE=false

# ============================================================================
# Repository Registry
# ============================================================================
# Format: "owner/repo|ecosystem|description"
# ============================================================================

PYTHON_REPOS=(
  "pallets/flask|python|Lightweight WSGI web framework"
  "tiangolo/fastapi|python|Modern Python web framework"
  "psf/requests|python|HTTP library for Python"
  "django/django|python|High-level Python web framework"
  "encode/httpx|python|Async HTTP client for Python"
  "psf/black|python|Python code formatter"
)

JAVASCRIPT_REPOS=(
  "expressjs/express|javascript|Minimal Node.js web framework"
  "vercel/next.js|javascript|React framework for production"
  "axios/axios|javascript|Promise-based HTTP client"
  "lodash/lodash|javascript|Utility library"
  "socketio/socket.io|javascript|Real-time event-based communication"
  "webpack/webpack|javascript|Module bundler"
)

TYPESCRIPT_REPOS=(
  "angular/angular|typescript|Web application framework"
  "nestjs/nest|typescript|Progressive Node.js framework"
  "prisma/prisma|typescript|Next-gen ORM for Node.js"
  "colinhacks/zod|typescript|TypeScript-first schema validation"
  "trpc/trpc|typescript|End-to-end typesafe APIs"
)

RUST_REPOS=(
  "nickel-org/nickel.rs|rust|Web framework for Rust"
  "BurntSushi/ripgrep|rust|Line-oriented search tool"
  "serde-rs/serde|rust|Serialization framework"
  "tokio-rs/tokio|rust|Async runtime for Rust"
  "alacritty/alacritty|rust|GPU-accelerated terminal"
  "sharkdp/bat|rust|cat clone with syntax highlighting"
  "eza-community/eza|rust|Modern ls replacement"
)

QUICK_REPOS=(
  "pallets/flask|python|Lightweight WSGI web framework"
  "expressjs/express|javascript|Minimal Node.js web framework"
  "angular/angular|typescript|Web application framework"
  "BurntSushi/ripgrep|rust|Line-oriented search tool"
  "serde-rs/serde|rust|Serialization framework"
)

# ============================================================================
# Functions
# ============================================================================

usage() {
  echo "Usage: $0 [filter] [options]"
  echo ""
  echo "Filters:"
  echo "  python       Run only Python repos"
  echo "  javascript   Run only JavaScript repos"
  echo "  typescript   Run only TypeScript repos"
  echo "  rust         Run only Rust repos"
  echo ""
  echo "Options:"
  echo "  --quick      Run a small subset (5 repos)"
  echo "  --verbose    Show full dry-run output"
  echo "  --help       Show this help"
  echo ""
  echo "Environment:"
  echo "  E2E_WORK_DIR   Working directory for cloned repos (default: /tmp/badge-sync-e2e)"
}

log_header() {
  echo -e "\n${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BOLD}${BLUE}  badge-sync E2E Test Suite${NC}"
  echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

log_repo_start() {
  local repo="$1"
  local ecosystem="$2"
  local desc="$3"
  echo -e "${BOLD}┌─ ${CYAN}${repo}${NC} ${YELLOW}[${ecosystem}]${NC} — ${desc}"
}

log_repo_result() {
  local status="$1"
  local badge_count="$2"
  local details="$3"

  case "$status" in
    pass)
      echo -e "${BOLD}└─ ${GREEN}✓ PASS${NC} — ${badge_count} badges ${details}"
      ;;
    warn)
      echo -e "${BOLD}└─ ${YELLOW}⚠ WARN${NC} — ${badge_count} badges ${details}"
      ;;
    fail)
      echo -e "${BOLD}└─ ${RED}✗ FAIL${NC} — ${details}"
      ;;
  esac
  echo ""
}

clone_repo() {
  local repo="$1"
  local dest="$2"

  if [[ -d "$dest/.git" ]]; then
    return 0
  fi

  git clone --depth 1 --single-branch "https://github.com/${repo}.git" "$dest" 2>/dev/null
}

test_repo() {
  local entry="$1"
  local repo ecosystem desc
  IFS='|' read -r repo ecosystem desc <<< "$entry"

  local repo_dir="$WORK_DIR/$(echo "$repo" | tr '/' '_')"

  TOTAL=$((TOTAL + 1))
  log_repo_start "$repo" "$ecosystem" "$desc"

  # Clone
  if ! clone_repo "$repo" "$repo_dir"; then
    FAILED=$((FAILED + 1))
    log_repo_result "fail" "0" "Clone failed"
    return
  fi

  # Run badge-sync apply --dry-run
  local output
  local exit_code=0
  output=$(cd "$repo_dir" && $BADGE_SYNC apply --dry-run 2>&1) || exit_code=$?

  if [[ $exit_code -ne 0 ]]; then
    # Some failures are expected (no ecosystem, no README markers, etc.)
    local is_expected=false

    if echo "$output" | grep -q "No recognizable ecosystem"; then
      is_expected=true
      WARNED=$((WARNED + 1))
      log_repo_result "warn" "0" "No ecosystem detected"
    elif echo "$output" | grep -q "README file not found"; then
      is_expected=true
      WARNED=$((WARNED + 1))
      log_repo_result "warn" "0" "No README found"
    elif echo "$output" | grep -q "Badge block markers not found"; then
      # This is fine — init would add them. Run detect instead.
      is_expected=true

      # Still try to get metadata
      local meta_output
      meta_output=$(cd "$repo_dir" && node -e "
        import { detectMetadata } from '$PROJECT_ROOT/dist/detector.js';
        const m = await detectMetadata('.');
        const wf = m.workflows.length;
        const eco = m.ecosystem.join(', ');
        const pkg = m.packageName ?? '(none)';
        const priv = m.packageNames.javascript === undefined && m.ecosystem.includes('javascript') ? ' [private]' : '';
        console.log(JSON.stringify({ eco, pkg, wf, priv, mono: m.isMonorepo, pkgCount: m.packages.length }));
      " 2>&1) || true

      if [[ -n "$meta_output" ]] && echo "$meta_output" | grep -q '"eco"'; then
        local eco pkg wf priv mono pkgCount
        eco=$(echo "$meta_output" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8'));process.stdout.write(d.eco)")
        pkg=$(echo "$meta_output" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8'));process.stdout.write(d.pkg)")
        wf=$(echo "$meta_output" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8'));process.stdout.write(String(d.wf))")
        priv=$(echo "$meta_output" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8'));process.stdout.write(d.priv)")
        mono=$(echo "$meta_output" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8'));process.stdout.write(String(d.mono))")
        pkgCount=$(echo "$meta_output" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8'));process.stdout.write(String(d.pkgCount))")

        local details="ecosystem=${eco}, pkg=${pkg}${priv}, workflows=${wf}"
        if [[ "$mono" == "true" ]]; then
          details="${details}, monorepo=${pkgCount} packages"
        fi

        PASSED=$((PASSED + 1))
        log_repo_result "pass" "—" "(no markers) ${details}"
      else
        WARNED=$((WARNED + 1))
        log_repo_result "warn" "0" "No badge markers (run init first)"
      fi
    else
      FAILED=$((FAILED + 1))
      local error_line
      error_line=$(echo "$output" | head -3)
      log_repo_result "fail" "0" "Error: ${error_line}"
    fi

    if [[ "$VERBOSE" == "true" ]]; then
      echo -e "  ${YELLOW}Output:${NC}"
      echo "$output" | sed 's/^/  │ /'
      echo ""
    fi
    return
  fi

  # Parse badge count from dry-run output
  local badge_count
  badge_count=$(echo "$output" | grep -oP 'Would apply \K\d+' || echo "0")

  local new_count updated_count unchanged_count
  new_count=$(echo "$output" | grep -oP '\(\K\d+(?= new)' || echo "0")
  updated_count=$(echo "$output" | grep -oP ', \K\d+(?= updated)' || echo "0")
  unchanged_count=$(echo "$output" | grep -oP ', \K\d+(?= unchanged)' || echo "0")

  local details="(${new_count} new, ${updated_count} updated, ${unchanged_count} unchanged)"

  # Determine pass/warn based on badge count
  if [[ "$badge_count" -gt 15 ]]; then
    WARNED=$((WARNED + 1))
    log_repo_result "warn" "$badge_count" "${details} — high badge count, check filtering"
  else
    PASSED=$((PASSED + 1))
    log_repo_result "pass" "$badge_count" "$details"
  fi

  if [[ "$VERBOSE" == "true" ]]; then
    echo -e "  ${CYAN}Output:${NC}"
    echo "$output" | sed 's/^/  │ /'
    echo ""
  fi
}

log_summary() {
  echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BOLD}  Summary${NC}"
  echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  echo -e "  Total:   ${BOLD}${TOTAL}${NC}"
  echo -e "  Passed:  ${GREEN}${PASSED}${NC}"
  echo -e "  Warned:  ${YELLOW}${WARNED}${NC}"
  echo -e "  Failed:  ${RED}${FAILED}${NC}"
  echo ""

  if [[ $FAILED -gt 0 ]]; then
    echo -e "  ${RED}${BOLD}Some repos failed. Check output above.${NC}"
  elif [[ $WARNED -gt 0 ]]; then
    echo -e "  ${YELLOW}${BOLD}All repos processed. Some warnings to review.${NC}"
  else
    echo -e "  ${GREEN}${BOLD}All repos passed!${NC}"
  fi
  echo ""
}

# ============================================================================
# Main
# ============================================================================

# Parse arguments
for arg in "$@"; do
  case "$arg" in
    --quick)   QUICK=true ;;
    --verbose) VERBOSE=true ;;
    --help)    usage; exit 0 ;;
    python|javascript|typescript|rust)
      FILTER="$arg" ;;
    *)
      echo "Unknown argument: $arg"
      usage
      exit 1
      ;;
  esac
done

# Build first
echo -e "${CYAN}Building badge-sync...${NC}"
(cd "$PROJECT_ROOT" && npm run build 2>&1) || {
  echo -e "${RED}Build failed!${NC}"
  exit 1
}
echo -e "${GREEN}Build OK${NC}"

# Create work directory
mkdir -p "$WORK_DIR"

log_header

# Select repos
if [[ "$QUICK" == "true" ]]; then
  REPOS=("${QUICK_REPOS[@]}")
  echo -e "  Mode: ${YELLOW}Quick${NC} (5 repos)\n"
else
  REPOS=()
  case "$FILTER" in
    python)     REPOS=("${PYTHON_REPOS[@]}") ;;
    javascript) REPOS=("${JAVASCRIPT_REPOS[@]}") ;;
    typescript) REPOS=("${TYPESCRIPT_REPOS[@]}") ;;
    rust)       REPOS=("${RUST_REPOS[@]}") ;;
    *)
      REPOS=("${PYTHON_REPOS[@]}" "${JAVASCRIPT_REPOS[@]}" "${TYPESCRIPT_REPOS[@]}" "${RUST_REPOS[@]}")
      ;;
  esac

  local_filter="${FILTER:-all}"
  echo -e "  Mode: ${CYAN}Full${NC} (${#REPOS[@]} repos, filter=${local_filter})\n"
fi

# Run tests
for entry in "${REPOS[@]}"; do
  test_repo "$entry"
done

log_summary

# Exit with failure if any repo crashed
if [[ $FAILED -gt 0 ]]; then
  exit 1
fi

exit 0
