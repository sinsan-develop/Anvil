#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"; REPO="$ROOT/repo"; PREVIOUS="$ROOT/runtime/previous.sha"; [[ -s "$PREVIOUS" ]] || exit 2
RUNTIME_ENV="$ROOT/runtime/anvil.env"; [[ -f "$RUNTIME_ENV" ]] || { echo 'runtime secret file is missing; rollback will not recreate it' >&2; exit 4; }; [[ "$(stat -c '%a' "$RUNTIME_ENV")" == "600" || "$(stat -c '%a' "$RUNTIME_ENV")" == "400" ]] || { echo 'runtime secret file must be mode 0600 (or stricter)' >&2; exit 4; }
SHA="$(tr -d '\r\n' < "$PREVIOUS")"; [[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || exit 2; git -C "$REPO" cat-file -e "$SHA^{commit}"; [[ -z "$(git -C "$REPO" status --porcelain)" ]] || { echo 'checkout is dirty' >&2; exit 3; };
source "$REPO/deploy/ysna/manifest-guard.sh"; ANVIL_RELEASE_MANIFEST_REF="${ANVIL_RELEASE_MANIFEST_REF:-origin/main}"; validate_release_manifest "$REPO" "$ANVIL_RELEASE_MANIFEST_REF" "$SHA" rollback
ANVIL_RUNTIME_ENV_FILE="$RUNTIME_ENV" docker compose -f "$REPO/deploy/ysna/compose.internal.yml" stop web; git -C "$REPO" checkout --detach "$SHA"; ANVIL_RUNTIME_ENV_FILE="$RUNTIME_ENV" docker compose -f "$REPO/deploy/ysna/compose.internal.yml" up -d --build web; ANVIL_RUNTIME_ENV_FILE="$RUNTIME_ENV" "$REPO/deploy/ysna/verify.sh" "$SHA"; echo "application rollback complete; schema downgrade not performed; runtime secret retained"
