#!/usr/bin/env bash
set -euo pipefail
ANVIL_RELEASE_COMMIT="${1:-${ANVIL_RELEASE_COMMIT:-}}"; : "${ANVIL_RELEASE_COMMIT:?full release SHA required}"
[[ "$ANVIL_RELEASE_COMMIT" =~ ^[0-9a-f]{40}$ ]] || { echo 'full 40-character SHA required' >&2; exit 2; }
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="${ANVIL_DEPLOY_ROOT:-$(cd "$SCRIPT_DIR/../../.." && pwd)}"; RUNTIME="$ROOT/runtime"; EVIDENCE="$ROOT/evidence"; REPO="$ROOT/repo"; mkdir -p "$RUNTIME" "$EVIDENCE"
# The server-owned .env lives beside repo/ at the deployment root. Never read secrets from the Git checkout.
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
  for name in ANVIL_DATABASE_URL TELEGRAM_BOT_TOKEN TELEGRAM_WEBHOOK_SECRET TELEGRAM_INTERNAL_SIGNING_SECRET TELEGRAM_ALLOWED_IDENTITIES ANVIL_CONSOLE_BASE_URL ANVIL_TEST_SESSION_BOOTSTRAP_TOKEN ANVIL_TEST_SESSION_ACTOR_ID ANVIL_TEST_SESSION_PROJECT_ID ANVIL_TEST_SESSION_ENVIRONMENT_ID ANVIL_TEST_SESSION_RUN_IDS ANVIL_TEST_SESSION_PERMISSION_SCOPES; do
    grep -Eq "^${name}=[^[:space:]]" "$SOURCE_ENV" || {
      echo "required secret reference missing: $name" >&2
      exit 4
    }
  done
  local scope_assignment_count permission_scopes
  scope_assignment_count="$(grep -Ec '^ANVIL_TEST_SESSION_PERMISSION_SCOPES=' "$SOURCE_ENV" || true)"
  [[ "$scope_assignment_count" == 1 ]] || {
    echo 'ANVIL_TEST_SESSION_PERMISSION_SCOPES must be assigned exactly once' >&2
    exit 4
  }
  permission_scopes="$(sed -n 's/^ANVIL_TEST_SESSION_PERMISSION_SCOPES=//p' "$SOURCE_ENV")"
  [[ "$permission_scopes" == 'tasks:write,tasks:read,run:events:read' ]] || {
    echo 'ANVIL_TEST_SESSION_PERMISSION_SCOPES must equal tasks:write,tasks:read,run:events:read' >&2
    exit 4
  }
  local tmp="$TARGET_ENV.tmp.$$"
  umask 077
  install -m 600 "$SOURCE_ENV" "$tmp"
  mv -f "$tmp" "$TARGET_ENV"
  chmod 600 "$TARGET_ENV"
}

compose() {
  ANVIL_RUNTIME_ENV_FILE="$TARGET_ENV" ANVIL_RELEASE_COMMIT="$ANVIL_RELEASE_COMMIT" docker compose -f "$REPO/deploy/ysna/compose.production.yml" "$@"
}

prepare_runtime_env
if [[ ! -d "$REPO/.git" ]]; then git clone https://github.com/cyhuh7950/anvil.git "$REPO"; fi
cd "$REPO"; git fetch --prune origin; [[ -z "$(git status --porcelain)" ]] || { echo 'checkout is dirty' >&2; exit 3; };
source "$REPO/deploy/ysna/manifest-guard.sh"; ANVIL_RELEASE_MANIFEST_REF="${ANVIL_RELEASE_MANIFEST_REF:-origin/main}"; validate_release_manifest "$REPO" "$ANVIL_RELEASE_MANIFEST_REF" "$ANVIL_RELEASE_COMMIT"
current_sha="$(git rev-parse HEAD)"
if [[ "$current_sha" != "$ANVIL_RELEASE_COMMIT" ]]; then
  previous_image_id="$(docker inspect --format '{{.Image}}' anvil-web)"
  previous_revision="$(docker image inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$previous_image_id")"
  [[ "$previous_revision" == "$current_sha" ]] || { echo 'running image revision does not match rollback commit' >&2; exit 8; }
  docker image tag "$previous_image_id" "anvil-web:$current_sha"
  printf '%s\n' "$current_sha" > "$RUNTIME/previous.sha"
  rollback_dir="$RUNTIME/rollback-assets/$ANVIL_RELEASE_COMMIT"; mkdir -p "$rollback_dir"
  preserve_target_asset() {
    local path="$1" target="$2" blob tmp
    blob="$(git rev-parse "$ANVIL_RELEASE_COMMIT:$path")"
    tmp="$target.tmp.$$"
    git show "$ANVIL_RELEASE_COMMIT:$path" > "$tmp"
    [[ "$(git hash-object "$tmp")" == "$blob" ]] || { rm -f "$tmp"; echo "rollback asset blob mismatch: $path" >&2; exit 8; }
    mv -f "$tmp" "$target"
  }
  preserve_target_asset deploy/ysna/compose.production.yml "$rollback_dir/compose.production.yml"
  preserve_target_asset deploy/ysna/verify.sh "$rollback_dir/verify.sh"
  chmod 600 "$rollback_dir/compose.production.yml"
  chmod 700 "$rollback_dir/verify.sh"
  rollback_pointer_tmp="$RUNTIME/rollback-assets.current.tmp.$$"
  printf '%s\n' "$rollback_dir" > "$rollback_pointer_tmp"
  mv -f "$rollback_pointer_tmp" "$RUNTIME/rollback-assets.current"
fi
git checkout --detach "$ANVIL_RELEASE_COMMIT"
compose build anvil-web
current_head="$(compose run --rm anvil-web alembic current 2>&1)"
if [[ "$current_head" == *"0012_run_authority"* ]]; then
  if ! compose run --rm anvil-web alembic upgrade 0013_task_bootstrap_authority; then
    printf '{"status":"MIGRATION_FAILED","commit":"%s","rollback":"NOT_STARTED","secret_values":"omitted"}\n' "$ANVIL_RELEASE_COMMIT" > "$EVIDENCE/deployment-failure.json"; exit 10
  fi
elif [[ "$current_head" == *"0013_task_bootstrap_authority"* ]]; then
  :
else
  echo "migration head must be 0012_run_authority or 0013_task_bootstrap_authority" >&2; exit 9
fi
if ! compose up -d anvil-web; then
  printf '{"status":"START_FAILED","commit":"%s","rollback":"NOT_STARTED","secret_values":"omitted"}\n' "$ANVIL_RELEASE_COMMIT" > "$EVIDENCE/deployment-failure.json"; exit 11
fi
printf '{"status":"deployed","commit":"%s","secret_values":"omitted"}\n' "$ANVIL_RELEASE_COMMIT" > "$EVIDENCE/deployment.json"
