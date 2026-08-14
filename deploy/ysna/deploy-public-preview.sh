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
compose_project="anvil-public-preview"

if [[ ! "$release_commit" =~ ^[0-9a-f]{40}$ ]]; then
  echo "release commit must be a full lowercase Git SHA" >&2
  exit 2
fi
if [[ ! "$release_tag" =~ ^anvil-ui-preview-[0-9]{8}\.[0-9]+$ ]]; then
  echo "release tag is invalid" >&2
  exit 2
fi

mkdir -p "$deploy_root" "$runtime_dir" "$evidence_dir"
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

previous_release="none"
if [[ -f "$runtime_dir/current-public-preview-sha" ]]; then
  previous_release="$(<"$runtime_dir/current-public-preview-sha")"
fi
printf '%s\n' "$previous_release" > "$runtime_dir/previous-public-preview-sha"

npm_id="$(docker inspect nginx-proxy-manager --format '{{.Id}}')"
db_id="$(docker inspect shared-db --format '{{.Id}}')"
printf '%s\n%s\n' "$npm_id" "$db_id" > "$runtime_dir/protected-container-ids"

git checkout --detach "$release_commit"
if [[ -n "$(git status --porcelain)" ]]; then
  echo "deployment checkout became dirty" >&2
  exit 5
fi

export ANVIL_IMAGE_TAG="${release_commit:0:12}"
docker compose -p "$compose_project" -f "$compose_file" build anvil-web
docker compose -p "$compose_project" -f "$compose_file" up -d --no-deps anvil-web

for _ in $(seq 1 30); do
  health="$(docker inspect anvil-web --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' 2>/dev/null || true)"
  [[ "$health" == "healthy" ]] && break
  sleep 2
done
if [[ "$(docker inspect anvil-web --format '{{.State.Health.Status}}')" != "healthy" ]]; then
  docker logs --tail 80 anvil-web >&2
  exit 6
fi

printf '%s\n' "$release_commit" > "$runtime_dir/current-public-preview-sha"
printf '%s\n' "$release_tag" > "$runtime_dir/current-public-preview-tag"
printf '{"release_commit":"%s","release_tag":"%s","container":"anvil-web","network":"proxy-network","port":"3770","deployed_at":"%s"}\n' \
  "$release_commit" "$release_tag" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$evidence_dir/public-preview-deploy.json"

echo "ANVIL_PUBLIC_PREVIEW_DEPLOYED=$release_commit"
