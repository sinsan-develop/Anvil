#!/usr/bin/env bash
set -euo pipefail

deploy_root="$HOME/deploy/anvil"
repo_dir="$deploy_root/repo"
runtime_dir="$deploy_root/runtime"
compose_file="deploy/ysna/compose.public-preview.yml"
compose_project="anvil-public-preview"
canonical_runtime_prefix="anvil-web"
legacy_runtime_prefix="public-preview"

runtime_path() {
  local kind="$1"
  printf '%s/%s-%s' "$runtime_dir" "$kind" "$canonical_runtime_prefix"
}

legacy_runtime_path() {
  local kind="$1"
  printf '%s/%s-%s' "$runtime_dir" "$kind" "$legacy_runtime_prefix"
}

write_runtime_alias() {
  local kind="$1"
  local value="$2"
  printf '%s\n' "$value" > "$(runtime_path "$kind")"
  printf '%s\n' "$value" > "$(legacy_runtime_path "$kind")"
}

read_runtime_alias() {
  local kind="$1"
  if [[ -f "$(runtime_path "$kind")" ]]; then
    <"$(runtime_path "$kind")"
  elif [[ -f "$(legacy_runtime_path "$kind")" ]]; then
    <"$(legacy_runtime_path "$kind")"
  else
    printf 'none\n'
  fi
}

previous_release="$(read_runtime_alias previous-sha)"

cd "$repo_dir"
if [[ "$previous_release" == "none" ]]; then
  docker compose -p "$compose_project" -f "$compose_file" stop anvil-web
  docker compose -p "$compose_project" -f "$compose_file" rm -f anvil-web
  echo "ANVIL_WEB_ROLLED_BACK=service-removed"
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
write_runtime_alias current-sha "$previous_release"
echo "ANVIL_WEB_ROLLED_BACK=$previous_release"
echo "ANVIL_PUBLIC_PREVIEW_ROLLED_BACK=$previous_release"
