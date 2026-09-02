#!/usr/bin/env bash
set -euo pipefail

release_commit="${1:-}"
release_tag="${2:-}"
deploy_root="$HOME/deploy/anvil"
repo_dir="$deploy_root/repo"
runtime_dir="$deploy_root/runtime"
evidence_dir="$deploy_root/evidence"
origin_url="git@github.com:cyhuh7950/anvil.git"
compose_file="deploy/ysna/compose.public-preview.yml"
compose_project="anvil"
canonical_current_sha_path="$runtime_dir/current-anvil-web-sha"
legacy_current_sha_path="$runtime_dir/current-public-preview-sha"
canonical_previous_sha_path="$runtime_dir/previous-anvil-web-sha"
legacy_previous_sha_path="$runtime_dir/previous-public-preview-sha"
canonical_current_tag_path="$runtime_dir/current-anvil-web-tag"
legacy_current_tag_path="$runtime_dir/current-public-preview-tag"
canonical_protected_ids_path="$runtime_dir/protected-anvil-web-container-ids"
legacy_protected_ids_path="$runtime_dir/protected-container-ids"
canonical_deploy_evidence_path="$evidence_dir/anvil-web-deploy.json"
legacy_deploy_evidence_path="$evidence_dir/public-preview-deploy.json"

write_alias_pair() {
  local canonical_path="$1"
  local legacy_path="$2"
  local value="$3"
  printf '%s\n' "$value" > "$canonical_path"
  printf '%s\n' "$value" > "$legacy_path"
}

read_alias_value() {
  local canonical_path="$1"
  local legacy_path="$2"
  if [[ -f "$canonical_path" ]]; then
    <"$canonical_path"
  elif [[ -f "$legacy_path" ]]; then
    <"$legacy_path"
  else
    printf 'none\n'
  fi
}

write_evidence_alias() {
  local payload="$1"
  printf '%s\n' "$payload" > "$canonical_deploy_evidence_path"
  printf '%s\n' "$payload" > "$legacy_deploy_evidence_path"
}

if [[ ! "$release_commit" =~ ^[0-9a-f]{40}$ ]]; then
  echo "release commit must be a full lowercase Git SHA" >&2
  exit 2
fi
if [[ ! "$release_tag" =~ ^anvil-ui-preview-[0-9]{8}\.[0-9]+$ ]]; then
  echo "release tag is invalid" >&2
  exit 2
fi

mkdir -p "$deploy_root" "$runtime_dir" "$evidence_dir"

source_env="$deploy_root/.env"
target_env="$runtime_dir/anvil.env"
prepare_runtime_env() {
  [[ -f "$source_env" ]] || { echo "server-only secret file missing: $source_env" >&2; exit 4; }
  local mode
  mode="$(stat -c '%a' "$source_env")"
  [[ "$mode" == "600" || "$mode" == "400" ]] || { echo "server-only secret file must be mode 0600 (or stricter): $source_env" >&2; exit 4; }
  local name
  for name in ANVIL_DATABASE_URL TELEGRAM_BOT_TOKEN TELEGRAM_WEBHOOK_SECRET TELEGRAM_INTERNAL_SIGNING_SECRET TELEGRAM_ALLOWED_IDENTITIES ANVIL_CONSOLE_BASE_URL; do
    grep -Eq "^${name}=[^[:space:]]" "$source_env" || { echo "required secret reference missing: $name" >&2; exit 4; }
  done
  local tmp="$target_env.tmp.$$"
  umask 077
  install -m 600 "$source_env" "$tmp"
  mv -f "$tmp" "$target_env"
  chmod 600 "$target_env"
}

prepare_runtime_env
if [[ ! -d "$repo_dir/.git" ]]; then
  git clone "$origin_url" "$repo_dir"
fi

cd "$repo_dir"
if [[ -n "$(git status --porcelain)" ]]; then
  echo "deployment checkout is dirty" >&2
  exit 3
fi

git fetch --prune --tags origin
git cat-file -e "$release_commit^{commit}"
tag_commit="$(git rev-parse "$release_tag^{commit}")"
if [[ "$tag_commit" != "$release_commit" ]]; then
  echo "release tag does not bind the requested commit" >&2
  exit 4
fi

previous_release="$(read_alias_value "$canonical_current_sha_path" "$legacy_current_sha_path")"
write_alias_pair "$canonical_previous_sha_path" "$legacy_previous_sha_path" "$previous_release"

npm_id="$(docker inspect nginx-proxy-manager --format '{{.Id}}')"
db_id="$(docker inspect shared-db --format '{{.Id}}')"
printf '%s\n%s\n' "$npm_id" "$db_id" > "$canonical_protected_ids_path"
printf '%s\n%s\n' "$npm_id" "$db_id" > "$legacy_protected_ids_path"

git checkout --detach "$release_commit"
if [[ -n "$(git status --porcelain)" ]]; then
  echo "deployment checkout became dirty" >&2
  exit 5
fi

export ANVIL_IMAGE_TAG="${release_commit:0:12}"
ANVIL_RUNTIME_ENV_FILE="$target_env" docker compose -p "$compose_project" -f "$compose_file" build anvil-web
ANVIL_RUNTIME_ENV_FILE="$target_env" docker compose -p "$compose_project" -f "$compose_file" up -d --no-deps anvil-web

for _ in $(seq 1 30); do
  health="$(docker inspect anvil-web --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' 2>/dev/null || true)"
  [[ "$health" == "healthy" ]] && break
  sleep 2
done
if [[ "$(docker inspect anvil-web --format '{{.State.Health.Status}}')" != "healthy" ]]; then
  docker logs --tail 80 anvil-web >&2
  exit 6
fi

write_alias_pair "$canonical_current_sha_path" "$legacy_current_sha_path" "$release_commit"
write_alias_pair "$canonical_current_tag_path" "$legacy_current_tag_path" "$release_tag"
payload=$(printf '{"release_commit":"%s","release_tag":"%s","container":"anvil-web","network":"proxy-network","port":"3770","runtime":"UNIFIED_FASTAPI_ASGI","api_upstream":null,"deployed_at":"%s"}' \
  "$release_commit" "$release_tag" "$(date -u +%Y-%m-%dT%H:%M:%SZ)")
write_evidence_alias "$payload"

echo "ANVIL_WEB_DEPLOYED=$release_commit"
echo "ANVIL_PUBLIC_PREVIEW_DEPLOYED=$release_commit"
