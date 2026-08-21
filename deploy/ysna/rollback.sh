#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"; REPO="$ROOT/repo"; PREVIOUS="$ROOT/runtime/previous.sha"; [[ -s "$PREVIOUS" ]] || exit 2
SHA="$(tr -d '\r\n' < "$PREVIOUS")"; [[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || exit 2; git -C "$REPO" cat-file -e "$SHA^{commit}"; [[ -z "$(git -C "$REPO" status --porcelain)" ]] || { echo 'checkout is dirty' >&2; exit 3; };
source "$REPO/deploy/ysna/manifest-guard.sh"; ANVIL_RELEASE_MANIFEST_REF="${ANVIL_RELEASE_MANIFEST_REF:-origin/main}"; validate_release_manifest "$REPO" "$ANVIL_RELEASE_MANIFEST_REF" "$SHA" rollback
docker compose -f "$REPO/deploy/ysna/compose.internal.yml" stop web; git -C "$REPO" checkout --detach "$SHA"; docker compose -f "$REPO/deploy/ysna/compose.internal.yml" up -d --build web; "$REPO/deploy/ysna/verify.sh" "$SHA"; echo "application rollback complete; schema downgrade not performed"
