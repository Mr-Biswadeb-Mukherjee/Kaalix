#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

violations=0

check_rule() {
  local title="$1"
  local file_glob="$2"
  local pattern="$3"
  local matches

  matches="$(rg -n --glob "$file_glob" -e "$pattern" backend frontend shared 2>/dev/null || true)"

  if [[ -n "$matches" ]]; then
    echo "[FAIL] $title"
    echo "$matches"
    echo
    violations=$((violations + 1))
  else
    echo "[PASS] $title"
  fi
}

check_rule \
  "Routes must not import Services/Connectors/Database layers" \
  "backend/Routes/**/*.js" \
  "from\\s+['\"]\\.\\./(Services|Connectors|Database)/|import\\s+['\"]\\.\\./(Services|Connectors|Database)/|require\\(\\s*['\"]\\.\\./(Services|Connectors|Database)/"

check_rule \
  "Controllers must not import Connectors/Database layers" \
  "backend/Controller/**/*.js" \
  "from\\s+['\"]\\.\\./(Connectors|Database)/|import\\s+['\"]\\.\\./(Connectors|Database)/|require\\(\\s*['\"]\\.\\./(Connectors|Database)/"

check_rule \
  "Services must not import Routes/Controller layers" \
  "backend/Services/**/*.js" \
  "from\\s+['\"]\\.\\./(Routes|Controller)/|import\\s+['\"]\\.\\./(Routes|Controller)/|require\\(\\s*['\"]\\.\\./(Routes|Controller)/"

check_rule \
  "Connectors must not import Routes/Controller/Services layers" \
  "backend/Connectors/**/*.js" \
  "from\\s+['\"]\\.\\./(Routes|Controller|Services)/|import\\s+['\"]\\.\\./(Routes|Controller|Services)/|require\\(\\s*['\"]\\.\\./(Routes|Controller|Services)/"

check_rule \
  "Database layer must not import upper layers" \
  "backend/Database/**/*.js" \
  "from\\s+['\"]\\.\\./(Routes|Controller|Services|Connectors)/|import\\s+['\"]\\.\\./(Routes|Controller|Services|Connectors)/|require\\(\\s*['\"]\\.\\./(Routes|Controller|Services|Connectors)/"

check_rule \
  "Frontend must not import backend runtime files directly" \
  "frontend/src/**/*.{js,jsx,ts,tsx}" \
  "from\\s+['\"][^'\"]*backend/|import\\s+['\"][^'\"]*backend/|require\\(\\s*['\"][^'\"]*backend/"

check_rule \
  "Shared package must stay dependency-neutral (no backend/frontend imports)" \
  "shared/**/*.js" \
  "from\\s+['\"][^'\"]*(backend|frontend)/|import\\s+['\"][^'\"]*(backend|frontend)/|require\\(\\s*['\"][^'\"]*(backend|frontend)/"

if [[ "$violations" -gt 0 ]]; then
  echo "Architecture policy violations detected: $violations"
  exit 1
fi

echo "Architecture policy checks passed."
