#!/usr/bin/env bash
set -euo pipefail
ANVIL_RELEASE_COMMIT="${1:-${ANVIL_RELEASE_COMMIT:-}}"; : "${ANVIL_RELEASE_COMMIT:?full release SHA required}"
[[ "$ANVIL_RELEASE_COMMIT" =~ ^[0-9a-f]{40}$ ]] || { echo 'full 40-character SHA required' >&2; exit 2; }
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"; RUNTIME="$ROOT/runtime"; EVIDENCE="$ROOT/evidence"; REPO="$ROOT/repo"; mkdir -p "$RUNTIME" "$EVIDENCE"
SOURCE_ENV="$ROOT/.env"; TARGET_ENV="$RUNTIME/anvil.env"

prepare_runtime_env() {
  [[ -f "$SOURCE_ENV" ]] || { echo "server-only secret file missing: $SOURCE_ENV" >&2; exit 4; }
  local mode
  mode="$(stat -c '%a' "$SOURCE_ENV")"
  [[ "$mode" == "600" || "$mode" == "400" ]] || {
    echo "server-only secret file must be mode 0600 (or stricter): $SOURCE_ENV" >&2
    exit 4
  }
  local name
  for name in ANVIL_DATABASE_URL TELEGRAM_BOT_TOKEN TELEGRAM_WEBHOOK_SECRET TELEGRAM_INTERNAL_SIGNING_SECRET TELEGRAM_ALLOWED_IDENTITIES ANVIL_CONSOLE_BASE_URL; do
    grep -Eq "^${name}=[^[:space:]]" "$SOURCE_ENV" || {
      echo "required secret reference missing: $name" >&2
      exit 4
    }
  done
  local tmp="$TARGET_ENV.tmp.$$"
  umask 077
  install -m 600 "$SOURCE_ENV" "$tmp"
  mv -f "$tmp" "$TARGET_ENV"
  chmod 600 "$TARGET_ENV"
}

compose() {
  ANVIL_RUNTIME_ENV_FILE="$TARGET_ENV" docker compose -f "$REPO/deploy/ysna/compose.internal.yml" "$@"
}

prepare_runtime_env
if [[ ! -d "$REPO/.git" ]]; then git clone https://github.com/cyhuh7950/anvil.git "$REPO"; fi
cd "$REPO"; git fetch --prune origin; [[ -z "$(git status --porcelain)" ]] || { echo 'checkout is dirty' >&2; exit 3; };
source "$REPO/deploy/ysna/manifest-guard.sh"; ANVIL_RELEASE_MANIFEST_REF="${ANVIL_RELEASE_MANIFEST_REF:-origin/main}"; validate_release_manifest "$REPO" "$ANVIL_RELEASE_MANIFEST_REF" "$ANVIL_RELEASE_COMMIT"
git rev-parse HEAD > "$RUNTIME/previous.sha"; git checkout --detach "$ANVIL_RELEASE_COMMIT"
if ! compose --profile tools run --rm migrate; then
  printf '{"status":"MIGRATION_FAILED","commit":"%s","rollback":"NOT_STARTED","secret_values":"omitted"}\n' "$ANVIL_RELEASE_COMMIT" > "$EVIDENCE/deployment-failure.json"; exit 10
fi
if ! compose up -d --build web; then
  printf '{"status":"START_FAILED","commit":"%s","rollback":"NOT_STARTED","secret_values":"omitted"}\n' "$ANVIL_RELEASE_COMMIT" > "$EVIDENCE/deployment-failure.json"; exit 11
fi
printf '{"status":"deployed","commit":"%s","secret_values":"omitted"}\n' "$ANVIL_RELEASE_COMMIT" > "$EVIDENCE/deployment.json"
