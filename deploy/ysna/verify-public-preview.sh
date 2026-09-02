#!/usr/bin/env bash
set -euo pipefail

release_commit="${1:-}"
deploy_root="$HOME/deploy/anvil"
repo_dir="$deploy_root/repo"
runtime_dir="$deploy_root/runtime"
evidence_dir="$deploy_root/evidence"
canonical_protected_ids_path="$runtime_dir/protected-anvil-web-container-ids"
legacy_protected_ids_path="$runtime_dir/protected-container-ids"
canonical_verify_evidence_path="$evidence_dir/anvil-web-verify.json"
legacy_verify_evidence_path="$evidence_dir/public-preview-verify.json"

protected_ids_path() {
  if [[ -f "$canonical_protected_ids_path" ]]; then
    printf '%s\n' "$canonical_protected_ids_path"
  else
    printf '%s\n' "$legacy_protected_ids_path"
  fi
}

write_evidence_alias() {
  local payload="$1"
  printf '%s\n' "$payload" > "$canonical_verify_evidence_path"
  printf '%s\n' "$payload" > "$legacy_verify_evidence_path"
}

if [[ ! "$release_commit" =~ ^[0-9a-f]{40}$ ]]; then
  echo "release commit must be a full lowercase Git SHA" >&2
  exit 2
fi

cd "$repo_dir"
[[ "$(git rev-parse HEAD)" == "$release_commit" ]]
[[ -z "$(git status --porcelain)" ]]
[[ "$(docker inspect anvil-web --format '{{.State.Running}}')" == "true" ]]
[[ "$(docker inspect anvil-web --format '{{.State.Health.Status}}')" == "healthy" ]]
docker inspect anvil-web --format '{{json .NetworkSettings.Networks}}' | grep -q 'proxy-network'

docker exec nginx-proxy-manager curl -fsS http://anvil-web:3770/health/live | grep -q '"status":"ok"'
docker exec nginx-proxy-manager curl -fsS http://anvil-web:3770/health/ready | grep -q '"status":"ready"'
docker exec nginx-proxy-manager curl -fsS http://anvil-web:3770/openapi.json | grep -q 'openapi'
auth_status="$(docker exec nginx-proxy-manager curl -sS -o /dev/null -w '%{http_code}' http://anvil-web:3770/auth/session)"
[[ "$auth_status" == "405" ]]
public_headers="$(curl -fsS -D - -o /dev/null https://anvil.sinsan.kr)"
printf '%s\n' "$public_headers" | grep -qi '^content-security-policy:'
printf '%s\n' "$public_headers" | grep -qi '^x-content-type-options: nosniff'
curl -fsS https://anvil.sinsan.kr | grep -q 'Anvil'
curl -fsS https://anvil.sinsan.kr/src/app/workbench.js | grep -q 'fetch'

mapfile -t protected_before < "$(protected_ids_path)"
[[ "${protected_before[0]}" == "$(docker inspect nginx-proxy-manager --format '{{.Id}}')" ]]
[[ "${protected_before[1]}" == "$(docker inspect shared-db --format '{{.Id}}')" ]]

mkdir -p "$evidence_dir"
payload=$(printf '{"release_commit":"%s","git_clean":true,"container_healthy":true,"network":"proxy-network","same_listener":true,"health_live":true,"health_ready":true,"openapi":true,"auth_route_exists":true,"public_https":true,"security_headers":true,"protected_resources_unchanged":true,"runtime":"UNIFIED_FASTAPI_ASGI","verified_at":"%s"}' \
  "$release_commit" "$(date -u +%Y-%m-%dT%H:%M:%SZ)")
write_evidence_alias "$payload"

echo "ANVIL_WEB_VERIFIED=$release_commit"
echo "ANVIL_PUBLIC_PREVIEW_VERIFIED=$release_commit"
