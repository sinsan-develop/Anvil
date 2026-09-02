#!/usr/bin/env bash
set -euo pipefail

deploy_root="$HOME/deploy/anvil"
repo_dir="$deploy_root/repo"
runtime_dir="$deploy_root/runtime"
compose_file="deploy/ysna/compose.public-preview.yml"
compose_project="anvil"
canonical_runtime_prefix="anvil-web"
legacy_runtime_prefix="public-preview"
dockerfile_path="deploy/ysna/Dockerfile.web"
rollback_dockerfile=""

cleanup() {
  if [[ -n "$rollback_dockerfile" ]]; then
    rm -f -- "$rollback_dockerfile"
  fi
}
trap cleanup EXIT

runtime_path() {
  local kind="$1"
  local position="${kind%%-*}"
  local suffix="${kind#*-}"
  printf '%s/%s-%s-%s' "$runtime_dir" "$position" "$canonical_runtime_prefix" "$suffix"
}

legacy_runtime_path() {
  local kind="$1"
  local position="${kind%%-*}"
  local suffix="${kind#*-}"
  printf '%s/%s-%s-%s' "$runtime_dir" "$position" "$legacy_runtime_prefix" "$suffix"
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
    cat -- "$(runtime_path "$kind")"
  elif [[ -f "$(legacy_runtime_path "$kind")" ]]; then
    cat -- "$(legacy_runtime_path "$kind")"
  else
    printf 'none\n'
  fi
}

previous_release="$(read_runtime_alias previous-sha)"
runtime_env="$deploy_root/runtime/anvil.env"

cd "$repo_dir"
target_release="$(git rev-parse HEAD)"
if [[ "$previous_release" == "none" ]]; then
  echo "no previous unified runtime release is recorded; refusing destructive removal" >&2
  exit 2
fi

if [[ ! "$previous_release" =~ ^[0-9a-f]{40}$ ]]; then
  echo "recorded previous release is invalid" >&2
  exit 2
fi
if [[ ! "$target_release" =~ ^[0-9a-f]{40}$ ]]; then
  echo "current target release is not an exact Git commit" >&2
  exit 2
fi
[[ -f "$runtime_env" ]] || { echo "runtime env missing: $runtime_env" >&2; exit 4; }

git fetch --prune --tags origin
git cat-file -e "$previous_release^{commit}"
git cat-file -e "$target_release^{commit}"
expected_dockerfile_sha="$(git show "$target_release:$dockerfile_path" | sha256sum | awk '{print $1}')"
rollback_dockerfile="$(mktemp "$runtime_dir/rollback-Dockerfile.${target_release}.XXXXXX")"
git show "$target_release:$dockerfile_path" > "$rollback_dockerfile"
actual_dockerfile_sha="$(sha256sum "$rollback_dockerfile" | awk '{print $1}')"
[[ -n "$expected_dockerfile_sha" && "$actual_dockerfile_sha" == "$expected_dockerfile_sha" ]] || {
  echo "rollback Dockerfile does not match the current target release" >&2
  exit 5
}
chmod 600 "$rollback_dockerfile"
git checkout --detach "$previous_release"
export ANVIL_IMAGE_TAG="${previous_release:0:12}"
export ANVIL_RELEASE_COMMIT="$previous_release"
docker build \
  --file "$rollback_dockerfile" \
  --build-arg "ANVIL_RELEASE_COMMIT=$previous_release" \
  --tag "anvil-web:$ANVIL_IMAGE_TAG" \
  .
image_revision="$(docker image inspect "anvil-web:$ANVIL_IMAGE_TAG" --format '{{index .Config.Labels "org.opencontainers.image.revision"}}')"
[[ "$image_revision" == "$previous_release" ]] || {
  echo "rollback image revision does not match previous release" >&2
  exit 6
}
if ! ANVIL_RUNTIME_ENV_FILE="$runtime_env" docker compose -p "$compose_project" -f "$compose_file" up -d --no-deps --no-build anvil-web; then
  echo "rollback runtime start failed" >&2
  exit 7
fi
for _ in $(seq 1 30); do
  health="$(docker inspect anvil-web --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' 2>/dev/null || true)"
  [[ "$health" == "healthy" ]] && break
  sleep 2
done
if [[ "$(docker inspect anvil-web --format '{{.State.Health.Status}}' 2>/dev/null || true)" != "healthy" ]]; then
  docker logs --tail 80 anvil-web >&2 || true
  echo "rollback runtime did not become healthy" >&2
  exit 8
fi
write_runtime_alias current-sha "$previous_release"
echo "ANVIL_WEB_ROLLED_BACK=$previous_release"
echo "ANVIL_PUBLIC_PREVIEW_ROLLED_BACK=$previous_release"
