#!/usr/bin/env bash
set -euo pipefail

release_commit="${1:-}"
deploy_root="$HOME/deploy/anvil"
repo_dir="$deploy_root/repo"
runtime_dir="$deploy_root/runtime"
deploy_script_path="deploy/ysna/deploy.sh"

[[ "$release_commit" =~ ^[0-9a-f]{40}$ ]] || { echo "release commit must be a full lowercase Git SHA" >&2; exit 2; }
[[ -d "$repo_dir/.git" ]] || { echo "deployment repository is missing: $repo_dir" >&2; exit 3; }

mkdir -p "$runtime_dir"
git -C "$repo_dir" fetch --prune origin
git -C "$repo_dir" cat-file -e "$release_commit^{commit}"
expected_blob="$(git -C "$repo_dir" rev-parse "$release_commit:$deploy_script_path")"
bootstrap_script="$(mktemp "$runtime_dir/deploy.${release_commit}.XXXXXX")"
cleanup() { rm -f -- "$bootstrap_script"; }
trap cleanup EXIT
git -C "$repo_dir" show "$release_commit:$deploy_script_path" > "$bootstrap_script"
[[ "$(git hash-object "$bootstrap_script")" == "$expected_blob" ]] || { echo "target deployment script blob mismatch" >&2; exit 4; }
chmod 700 "$bootstrap_script"
ANVIL_DEPLOY_ROOT="$deploy_root" /usr/bin/bash "$bootstrap_script" "$release_commit"
