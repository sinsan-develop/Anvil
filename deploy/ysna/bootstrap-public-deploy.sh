#!/usr/bin/env bash
set -euo pipefail

release_commit="${1:-}"
release_tag="${2:-}"
deploy_root="$HOME/deploy/anvil"
repo_dir="$deploy_root/repo"
runtime_dir="$deploy_root/runtime"
deploy_script_path="deploy/ysna/deploy-public-preview.sh"

if [[ ! "$release_commit" =~ ^[0-9a-f]{40}$ ]]; then
  echo "release commit must be a full lowercase Git SHA" >&2
  exit 2
fi
if [[ ! "$release_tag" =~ ^anvil-ui-preview-[0-9]{8}\.[0-9]+$ ]]; then
  echo "release tag is invalid" >&2
  exit 2
fi
[[ -d "$repo_dir/.git" ]] || { echo "deployment repository is missing: $repo_dir" >&2; exit 3; }

mkdir -p "$runtime_dir"
cd "$repo_dir"
git fetch --prune --tags origin
git cat-file -e "$release_commit^{commit}"

expected_blob="$(git rev-parse "$release_commit:$deploy_script_path")"
bootstrap_script="$(mktemp "$runtime_dir/deploy-public-preview.${release_commit}.XXXXXX")"
cleanup() { rm -f -- "$bootstrap_script"; }
trap cleanup EXIT
git show "$release_commit:$deploy_script_path" > "$bootstrap_script"
actual_blob="$(git hash-object "$bootstrap_script")"
[[ "$actual_blob" == "$expected_blob" ]] || {
  echo "target deployment script blob mismatch" >&2
  exit 4
}
chmod 700 "$bootstrap_script"
execution_script="$bootstrap_script"
if command -v cygpath >/dev/null 2>&1; then
  execution_script="$(cygpath -u "$bootstrap_script")"
fi
/usr/bin/bash "$execution_script" "$release_commit" "$release_tag"
