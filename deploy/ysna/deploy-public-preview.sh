#!/usr/bin/env bash
set -euo pipefail

release_commit="${1:-}"
release_tag="${2:-}"
deploy_root="$HOME/deploy/anvil"
repo_dir="$deploy_root/repo"
runtime_dir="$deploy_root/runtime"
evidence_dir="$deploy_root/evidence"
backup_dir="$runtime_dir/db-backups"
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
expected_previous_revision="0011_telegram_webhook_state"
target_revision="0012_run_authority"
migration_applied=0
runtime_start_attempted=0
container_backup_path=""
database_backup_name=""
deploy_script_path="deploy/ysna/deploy-public-preview.sh"

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
    cat -- "$canonical_path"
  elif [[ -f "$legacy_path" ]]; then
    cat -- "$legacy_path"
  else
    printf 'none\n'
  fi
}

write_evidence_alias() {
  local payload="$1"
  printf '%s\n' "$payload" > "$canonical_deploy_evidence_path"
  printf '%s\n' "$payload" > "$legacy_deploy_evidence_path"
}

cleanup_container_backup() {
  if [[ -n "$container_backup_path" ]]; then
    docker exec -u postgres shared-db rm -- "$container_backup_path" >/dev/null 2>&1 || true
  fi
}
trap cleanup_container_backup EXIT

incident_hold() {
  local reason="${1:-unified public runtime verification failed}"
  echo "INCIDENT_HOLD: $reason" >&2
  if [[ "$migration_applied" == "1" ]]; then
    echo "INCIDENT_HOLD: automatic database downgrade is forbidden; migration $target_revision remains applied" >&2
  fi
  echo "INCIDENT_HOLD: anvil-internal-web-1 must be preserved for vertical verification fallback" >&2
  if [[ "$runtime_start_attempted" == "1" && "${previous_release:-none}" =~ ^[0-9a-f]{40}$ ]]; then
    bash "$repo_dir/deploy/ysna/rollback-public-preview.sh" || true
  fi
  exit 12
}

run_migration() {
  ANVIL_RUNTIME_ENV_FILE="$target_env" docker compose -p "$compose_project" -f "$compose_file" \
    run --rm --no-deps anvil-web /opt/venv/bin/alembic "$@"
}

read_migration_revision() {
  local output
  output="$(run_migration current)" || return 1
  printf '%s' "$output" | tr -d '\r' | awk 'NF {revision=$1; count++} END {if (count != 1) exit 1; print revision}'
}

backup_database() {
  local timestamp backup_name backup_path checksum_path container_sha host_sha
  timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
  backup_name="anvil-${timestamp}-${release_commit}.dump"
  database_backup_name="$backup_name"
  backup_path="$backup_dir/$backup_name"
  checksum_path="$backup_path.sha256"
  container_backup_path="/tmp/$backup_name"

  mkdir -p "$backup_dir"
  if ! docker exec -u postgres shared-db pg_dump \
      --format=custom --no-owner --no-privileges \
      --file="$container_backup_path" --dbname=anvil; then
    echo "database backup failed before migration" >&2
    return 1
  fi
  if ! docker exec -u postgres shared-db pg_restore -l "$container_backup_path" >/dev/null; then
    echo "database backup catalog verification failed" >&2
    return 1
  fi
  container_sha="$(docker exec -u postgres shared-db sha256sum "$container_backup_path" | awk 'NF {hash=$1; count++} END {if (count != 1 || hash !~ /^[0-9a-f]{64}$/) exit 1; print hash}')" || {
    echo "database backup container checksum failed" >&2
    return 1
  }
  if ! docker cp "shared-db:$container_backup_path" "$backup_path"; then
    echo "database backup copy failed" >&2
    return 1
  fi
  chmod 600 "$backup_path"
  [[ -s "$backup_path" ]] || { echo "database backup is empty" >&2; return 1; }
  host_sha="$(sha256sum "$backup_path" | awk '{print $1}')"
  [[ "$host_sha" == "$container_sha" ]] || {
    echo "database backup checksum mismatch after docker copy" >&2
    return 1
  }
  printf '%s  %s\n' "$host_sha" "$backup_name" > "$checksum_path"
  chmod 600 "$checksum_path"
  docker exec -u postgres shared-db rm -- "$container_backup_path"
  container_backup_path=""
  echo "ANVIL_DATABASE_BACKUP=$backup_path"
  echo "ANVIL_DATABASE_BACKUP_SHA256=$checksum_path"
}

if [[ ! "$release_commit" =~ ^[0-9a-f]{40}$ ]]; then
  echo "release commit must be a full lowercase Git SHA" >&2
  exit 2
fi
if [[ ! "$release_tag" =~ ^anvil-ui-preview-[0-9]{8}\.[0-9]+$ ]]; then
  echo "release tag is invalid" >&2
  exit 2
fi

mkdir -p "$deploy_root" "$runtime_dir" "$evidence_dir" "$backup_dir"

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
expected_script_sha="$(git show "$release_commit:$deploy_script_path" | sha256sum | awk '{print $1}')"
actual_script_sha="$(sha256sum "${BASH_SOURCE[0]}" | awk '{print $1}')"
[[ -n "$expected_script_sha" && "$actual_script_sha" == "$expected_script_sha" ]] || {
  echo "running deployment script does not match target commit blob" >&2
  exit 4
}
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
export ANVIL_RELEASE_COMMIT="$release_commit"
ANVIL_RUNTIME_ENV_FILE="$target_env" docker compose -p "$compose_project" -f "$compose_file" build anvil-web
image_revision="$(docker image inspect "anvil-web:$ANVIL_IMAGE_TAG" --format '{{index .Config.Labels "org.opencontainers.image.revision"}}')"
[[ "$image_revision" == "$release_commit" ]] || {
  echo "built image revision does not match release commit" >&2
  exit 6
}

current_revision="$(read_migration_revision)" || {
  echo "could not read the current database revision" >&2
  exit 7
}
[[ "$current_revision" == "$expected_previous_revision" ]] || {
  echo "database revision must be exactly $expected_previous_revision before deployment; got $current_revision" >&2
  exit 7
}

backup_database || exit 8
if ! run_migration upgrade "$target_revision"; then
  echo "MIGRATION_FAILED: upgrade to $target_revision failed" >&2
  exit 9
fi
migration_applied=1
applied_revision="$(read_migration_revision)" || incident_hold "could not verify the applied database revision"
[[ "$applied_revision" == "$target_revision" ]] || incident_hold "database revision is not exactly $target_revision after upgrade"

runtime_start_attempted=1
if ! ANVIL_RUNTIME_ENV_FILE="$target_env" docker compose -p "$compose_project" -f "$compose_file" up -d --no-deps anvil-web; then
  incident_hold "anvil-web runtime start failed after migration"
fi
deploy_started_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

for _ in $(seq 1 30); do
  health="$(docker inspect anvil-web --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' 2>/dev/null || true)"
  [[ "$health" == "healthy" ]] && break
  sleep 2
done
if [[ "$(docker inspect anvil-web --format '{{.State.Health.Status}}')" != "healthy" ]]; then
  docker logs --tail 80 anvil-web >&2
  incident_hold "anvil-web did not become healthy after migration"
fi

web_ip="$(docker inspect anvil-web --format '{{with index .NetworkSettings.Networks "proxy-network"}}{{.IPAddress}}{{end}}')"
npm_dns_ip="$(docker exec nginx-proxy-manager getent hosts anvil-web | awk 'NR==1 {print $1}')"
[[ -n "$web_ip" && "$web_ip" == "$npm_dns_ip" ]] || incident_hold "NPM cannot resolve the deployed anvil-web address"
docker exec nginx-proxy-manager nginx -t || incident_hold "NPM configuration test failed before public probes"
docker exec nginx-proxy-manager nginx -s reload || incident_hold "NPM graceful reload failed before public probes"
probe_path="/health/live?deploy_probe=${release_commit}"
probe_status="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "https://anvil.sinsan.kr${probe_path}" || true)"
[[ "$probe_status" == "200" ]] || incident_hold "public live probe failed"
ready_status="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "https://anvil.sinsan.kr/health/ready" || true)"
[[ "$ready_status" == "200" ]] || incident_hold "public readiness probe failed"
openapi_status="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "https://anvil.sinsan.kr/openapi.json" || true)"
[[ "$openapi_status" == "200" ]] || incident_hold "public OpenAPI probe failed"
docker logs --since "$deploy_started_at" anvil-web | grep -Fq "/health/live?deploy_probe=${release_commit}" || incident_hold "public live probe did not correlate to the deployed runtime"

if ! bash "$repo_dir/deploy/ysna/remove-npm-telegram-override.sh"; then
  incident_hold "NPM Telegram override removal failed and was restored"
fi

write_alias_pair "$canonical_current_sha_path" "$legacy_current_sha_path" "$release_commit"
write_alias_pair "$canonical_current_tag_path" "$legacy_current_tag_path" "$release_tag"
payload=$(printf '{"release_commit":"%s","release_tag":"%s","container":"anvil-web","network":"proxy-network","port":"3770","runtime":"UNIFIED_FASTAPI_ASGI","api_upstream":null,"migration_revision":"%s","database_backup":"%s","deployed_at":"%s"}' \
  "$release_commit" "$release_tag" "$target_revision" "$database_backup_name" "$(date -u +%Y-%m-%dT%H:%M:%SZ)")
write_evidence_alias "$payload"

echo "ANVIL_WEB_DEPLOYED=$release_commit"
echo "ANVIL_PUBLIC_PREVIEW_DEPLOYED=$release_commit"
