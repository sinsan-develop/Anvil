#!/usr/bin/env bash
set -euo pipefail

deploy_root="$HOME/deploy/anvil"
repo_dir="$deploy_root/repo"
runtime_dir="$deploy_root/runtime"
compose_file="deploy/ysna/compose.public-preview.yml"
compose_project="anvil-public-preview"
previous_release="$(<"$runtime_dir/previous-public-preview-sha")"

cd "$repo_dir"
if [[ "$previous_release" == "none" ]]; then
  docker compose -p "$compose_project" -f "$compose_file" stop anvil-web
  docker compose -p "$compose_project" -f "$compose_file" rm -f anvil-web
  echo "ANVIL_PUBLIC_PREVIEW_ROLLED_BACK=service-removed"
  exit 0
fi

if [[ ! "$previous_release" =~ ^[0-9a-f]{40}$ ]]; then
  echo "recorded previous release is invalid" >&2
  exit 2
fi

git fetch --prune --tags origin
git cat-file -e "$previous_release^{commit}"
git checkout --detach "$previous_release"
export ANVIL_IMAGE_TAG="${previous_release:0:12}"
docker compose -p "$compose_project" -f "$compose_file" build anvil-web
docker compose -p "$compose_project" -f "$compose_file" up -d --no-deps anvil-web
printf '%s\n' "$previous_release" > "$runtime_dir/current-public-preview-sha"
echo "ANVIL_PUBLIC_PREVIEW_ROLLED_BACK=$previous_release"
