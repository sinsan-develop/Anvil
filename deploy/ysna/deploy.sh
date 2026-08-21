#!/usr/bin/env bash
set -euo pipefail
ANVIL_RELEASE_COMMIT="${1:-${ANVIL_RELEASE_COMMIT:-}}"; : "${ANVIL_RELEASE_COMMIT:?full release SHA required}"
[[ "$ANVIL_RELEASE_COMMIT" =~ ^[0-9a-f]{40}$ ]] || { echo 'full 40-character SHA required' >&2; exit 2; }
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"; RUNTIME="$ROOT/runtime"; EVIDENCE="$ROOT/evidence"; REPO="$ROOT/repo"; mkdir -p "$RUNTIME" "$EVIDENCE"
if [[ ! -d "$REPO/.git" ]]; then git clone https://github.com/cyhuh7950/anvil.git "$REPO"; fi
cd "$REPO"; git fetch --prune origin; [[ -z "$(git status --porcelain)" ]] || { echo 'checkout is dirty' >&2; exit 3; };
source "$REPO/deploy/ysna/manifest-guard.sh"; validate_release_manifest "$REPO/deploy/ysna/ReleaseManifest.json" "$REPO" "$ANVIL_RELEASE_COMMIT"
git rev-parse HEAD > "$RUNTIME/previous.sha"; git checkout --detach "$ANVIL_RELEASE_COMMIT"
if ! docker compose -f deploy/ysna/compose.internal.yml --profile tools run --rm migrate; then
  printf '{"status":"MIGRATION_FAILED","commit":"%s","rollback":"NOT_STARTED","secret_values":"omitted"}\n' "$ANVIL_RELEASE_COMMIT" > "$EVIDENCE/deployment-failure.json"; exit 10
fi
if ! docker compose -f deploy/ysna/compose.internal.yml up -d --build web; then
  printf '{"status":"START_FAILED","commit":"%s","rollback":"NOT_STARTED","secret_values":"omitted"}\n' "$ANVIL_RELEASE_COMMIT" > "$EVIDENCE/deployment-failure.json"; exit 11
fi
printf '{"status":"deployed","commit":"%s","secret_values":"omitted"}\n' "$ANVIL_RELEASE_COMMIT" > "$EVIDENCE/deployment.json"
