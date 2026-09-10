#!/usr/bin/env bash
set -euo pipefail
EXPECTED="${1:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"
require_exact_sha "$EXPECTED" || exit $?
ROOT="${ANVIL_WSL_DEPLOY_ROOT:-/srv/anvil-wsl}"
require_control_utility_checkout "$SCRIPT_DIR"
REPO="${ANVIL_WSL_APPLICATION_REPO:-$ROOT/repo}"
mkdir -p "$ROOT/runtime" "$ROOT/evidence" "$ROOT/backups"
load_server_environment "$ROOT/.env"
fresh_clone=0
if [[ ! -d "$REPO/.git" ]]; then
  git clone --no-checkout "${ANVIL_GIT_REMOTE_URL:-https://github.com/cyhuh7950/anvil.git}" "$REPO"
  fresh_clone=1
fi
git -C "$REPO" fetch --prune origin
if (( fresh_clone )); then
  git -C "$REPO" checkout --detach "$EXPECTED"
fi
[[ -z "$(git -C "$REPO" status --porcelain)" ]] || { echo 'checkout is dirty' >&2; exit 3; }
MANIFEST_REF="${ANVIL_CANDIDATE_MANIFEST_REF:?candidate manifest control ref is required}"
source "$SCRIPT_DIR/candidate-manifest-guard.sh"
validate_wsl_candidate_manifest "$REPO" "$MANIFEST_REF" "$EXPECTED"
git -C "$REPO" checkout --detach "$EXPECTED"
[[ "$(git -C "$REPO" rev-parse HEAD)" == "$EXPECTED" ]] || { echo 'detached checkout mismatch' >&2; exit 3; }
[[ -z "$(git -C "$REPO" status --porcelain)" ]] || { echo 'detached checkout is dirty' >&2; exit 3; }

for target in 15 18-rc; do
  configure_wsl_target "$target"
  target_root="$ROOT/runtime/$ANVIL_TARGET_SLUG"
  mkdir -p "$target_root"
  ANVIL_RELEASE_COMMIT="$EXPECTED"
  export ANVIL_RELEASE_COMMIT
  previous="$(wsl_compose images -q anvil-web 2>/dev/null | head -n1 || true)"
  if [[ -n "$previous" ]]; then
    previous_revision="$(docker image inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$previous")"
    if [[ "$previous_revision" =~ ^[0-9a-f]{40}$ && "$previous_revision" != "$EXPECTED" ]]; then
      docker image tag "$previous" "anvil-wsl-web:$previous_revision"
      printf '%s\n' "$previous_revision" > "$target_root/previous.sha.tmp.$$"
      mv -f "$target_root/previous.sha.tmp.$$" "$target_root/previous.sha"
    fi
  fi
  wsl_compose pull anvil-db
  wsl_compose up -d --wait --wait-timeout 120 anvil-db
  pre_dump="$ROOT/backups/$ANVIL_TARGET_SLUG/$EXPECTED/pre-migration.dump"
  mkdir -p "$(dirname "$pre_dump")"
  umask 077
  wsl_compose exec -T anvil-db pg_dump -U anvil_app -d anvil -Fc > "$pre_dump.tmp.$$"
  wsl_compose exec -T anvil-db pg_restore --list < "$pre_dump.tmp.$$" >/dev/null
  mv -f "$pre_dump.tmp.$$" "$pre_dump"
  chmod 600 "$pre_dump"
  receipt="$ROOT/evidence/$ANVIL_TARGET_SLUG-pre-migration-backup.json"
  printf '{"status":"BACKUP_VERIFIED","release_commit":"%s","postgres_target":"%s","sha256":"%s","secret_values":"omitted"}\n' \
    "$EXPECTED" "$target" "$(sha256sum "$pre_dump" | cut -d' ' -f1)" > "$receipt.tmp.$$"
  mv -f "$receipt.tmp.$$" "$receipt"
  verify_backup_receipt "$receipt" "$pre_dump" "$EXPECTED" "$target"
  wsl_compose build anvil-web
  wsl_compose run --rm anvil-web /opt/venv/bin/alembic upgrade head
  wsl_compose up -d --force-recreate anvil-web
  wsl_compose pull anvil-ingress
  start_wsl_ingress
  printf '%s\n' "$EXPECTED" > "$target_root/current.sha.tmp.$$"
  mv -f "$target_root/current.sha.tmp.$$" "$target_root/current.sha"
  docker image inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }} {{index .RepoDigests 0}}' "$ANVIL_POSTGRES_IMAGE" \
    > "$ROOT/evidence/$ANVIL_TARGET_SLUG-images.txt" 2>/dev/null || docker image inspect --format '{{.Id}}' "$ANVIL_POSTGRES_IMAGE" > "$ROOT/evidence/$ANVIL_TARGET_SLUG-images.txt"
done
