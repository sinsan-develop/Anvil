#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"; REPO="$ROOT/repo"; EXPECTED="${1:-${ANVIL_RELEASE_COMMIT:-}}"; : "${EXPECTED:?release SHA required}"
[[ "$EXPECTED" =~ ^[0-9a-f]{40}$ ]] || exit 2; [[ "$(git -C "$REPO" rev-parse HEAD)" == "$EXPECTED" ]] || { echo 'commit mismatch' >&2; exit 3; }; (cd "$REPO" && [[ -z "$(git status --porcelain)" ]]) || exit 3
docker compose -f "$REPO/deploy/ysna/compose.internal.yml" ps --status running web >/dev/null; curl --fail --silent --show-error http://127.0.0.1:4173/health/live >/dev/null
printf '{"status":"verified","commit":"%s","listener":"127.0.0.1:4173","secret_values":"omitted"}\n' "$EXPECTED" > "$ROOT/evidence/verification.json"
