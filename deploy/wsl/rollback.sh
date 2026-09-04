#!/usr/bin/env bash
set -euo pipefail
EXPECTED="${1:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"
require_exact_sha "$EXPECTED" || exit $?
ROOT="${ANVIL_WSL_DEPLOY_ROOT:-/srv/anvil-wsl}"
require_control_utility_checkout "$SCRIPT_DIR"
REPO="${ANVIL_WSL_APPLICATION_REPO:-$ROOT/repo}"
MANIFEST_REF="${ANVIL_CANDIDATE_MANIFEST_REF:?candidate manifest control ref is required}"
: "${ANVIL_CANDIDATE_MANIFEST_SHA256:?candidate manifest checksum is required}"
source "$SCRIPT_DIR/candidate-manifest-guard.sh"
validate_wsl_candidate_manifest "$REPO" "$MANIFEST_REF" "$EXPECTED"
load_server_environment "$ROOT/.env"
declare -A previous_by_target
for target in 15 18-rc; do
  configure_wsl_target "$target"
  [[ "$(cat "$ROOT/runtime/$ANVIL_TARGET_SLUG/current.sha")" == "$EXPECTED" ]] || { echo "current application revision mismatch for $target" >&2; exit 4; }
  previous_file="$ROOT/runtime/$ANVIL_TARGET_SLUG/previous.sha"
  [[ -s "$previous_file" ]] || { echo "previous application revision missing for $target" >&2; exit 4; }
  previous="$(tr -d '\r\n' < "$previous_file")"
  require_exact_sha "$previous" || exit $?
  [[ "$previous" != "$EXPECTED" ]] || { echo 'rollback requires a different previous revision' >&2; exit 4; }
  [[ "$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "anvil-wsl-web:$previous")" == "$previous" ]] || { echo 'previous image revision mismatch' >&2; exit 4; }
  previous_by_target["$target"]="$previous"
done
for target in 15 18-rc; do
  configure_wsl_target "$target"
  previous="${previous_by_target[$target]}"
  ANVIL_RELEASE_COMMIT="$previous"; export ANVIL_RELEASE_COMMIT
  wsl_compose up -d --no-build --force-recreate anvil-web
  start_wsl_ingress
  printf '%s\n' "$previous" > "$ROOT/runtime/$ANVIL_TARGET_SLUG/current.sha.tmp.$$"
  mv -f "$ROOT/runtime/$ANVIL_TARGET_SLUG/current.sha.tmp.$$" "$ROOT/runtime/$ANVIL_TARGET_SLUG/current.sha"
  printf '{"status":"APPLICATION_ROLLED_BACK","from":"%s","to":"%s","postgres_target":"%s","database_migration":"PRESERVED_NO_AUTOMATIC_DOWNGRADE","secret_values":"omitted"}\n' \
    "$EXPECTED" "$previous" "$target" > "$ROOT/evidence/$ANVIL_TARGET_SLUG-rollback.json.tmp.$$"
  mv -f "$ROOT/evidence/$ANVIL_TARGET_SLUG-rollback.json.tmp.$$" "$ROOT/evidence/$ANVIL_TARGET_SLUG-rollback.json"
done
