#!/usr/bin/env bash
set -euo pipefail

release_commit="${1:-}"
deploy_root="$HOME/deploy/anvil"
repo_dir="$deploy_root/repo"
runtime_dir="$deploy_root/runtime"
evidence_dir="$deploy_root/evidence"

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

internal_health="$(docker exec nginx-proxy-manager curl -fsS http://anvil-web:3770/healthz)"
printf '%s' "$internal_health" | grep -q '"service":"anvil-web"'
public_headers="$(curl -fsS -D - -o /dev/null https://anvil.sinsan.kr)"
printf '%s\n' "$public_headers" | grep -qi '^content-security-policy:'
printf '%s\n' "$public_headers" | grep -qi '^x-content-type-options: nosniff'
curl -fsS https://anvil.sinsan.kr | grep -q 'data-preview-shell'
curl -fsS https://anvil.sinsan.kr/src/features/ui-preview/ui-preview-model.js | grep -q 'agents-automation'

mapfile -t protected_before < "$runtime_dir/protected-container-ids"
[[ "${protected_before[0]}" == "$(docker inspect nginx-proxy-manager --format '{{.Id}}')" ]]
[[ "${protected_before[1]}" == "$(docker inspect shared-db --format '{{.Id}}')" ]]

mkdir -p "$evidence_dir"
printf '{"release_commit":"%s","git_clean":true,"container_healthy":true,"network":"proxy-network","internal_health":true,"public_https":true,"security_headers":true,"protected_resources_unchanged":true,"verified_at":"%s"}\n' \
  "$release_commit" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$evidence_dir/public-preview-verify.json"

echo "ANVIL_PUBLIC_PREVIEW_VERIFIED=$release_commit"
