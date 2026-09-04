#!/usr/bin/env bash
set -euo pipefail
ACTION="${1:-}"; EXPECTED="${2:-}"
case "$ACTION" in deploy|verify|rollback|cleanup) ;; *) echo 'control action must be deploy, verify, rollback, or cleanup' >&2; exit 2 ;; esac
[[ "$EXPECTED" =~ ^[0-9a-f]{40}$ ]] || { echo 'full 40-character SHA required' >&2; exit 2; }
ROOT="${ANVIL_WSL_DEPLOY_ROOT:-/srv/anvil-wsl}"
APPLICATION_REPO="${ANVIL_WSL_APPLICATION_REPO:-$ROOT/repo}"
CONTROL_BASE="${ANVIL_WSL_CONTROL_REPO:-$ROOT/control}"
CONTROL_REF="${ANVIL_CANDIDATE_MANIFEST_REF:?candidate manifest control ref is required}"
REMOTE_URL="${ANVIL_GIT_REMOTE_URL:-https://github.com/cyhuh7950/anvil.git}"
TRUSTED_CONTROL_SHA="${ANVIL_WSL_CONTROL_COMMIT:?trusted control commit is required}"
TRUSTED_MANIFEST_SHA="${ANVIL_CANDIDATE_MANIFEST_SHA256:?candidate manifest checksum is required}"
LOCK_TIMEOUT_SECONDS="${ANVIL_WSL_CONTROL_LOCK_TIMEOUT_SECONDS:-30}"
ACTION_NAME="${ACTION^^}"; ACTION_NAME="${ACTION_NAME//-/_}"
SCRIPT_HASH_VAR="ANVIL_WSL_CONTROL_${ACTION_NAME}_SHA256"
TRUSTED_SCRIPT_SHA="${!SCRIPT_HASH_VAR:?trusted control script checksum is required}"
[[ "$TRUSTED_CONTROL_SHA" =~ ^[0-9a-f]{40}$ && "$TRUSTED_MANIFEST_SHA" =~ ^[0-9a-fA-F]{64}$ && "$TRUSTED_SCRIPT_SHA" =~ ^[0-9a-fA-F]{64}$ ]] || { echo 'trusted control identity format is invalid' >&2; exit 3; }
[[ "$LOCK_TIMEOUT_SECONDS" =~ ^[1-9][0-9]*$ && "$LOCK_TIMEOUT_SECONDS" -le 600 ]] || { echo 'control lock timeout must be 1..600 seconds' >&2; exit 3; }
mkdir -p "$APPLICATION_REPO" "$CONTROL_BASE"
application_path="$(cd "$APPLICATION_REPO" && pwd -P)"; base_path="$(cd "$CONTROL_BASE" && pwd -P)"
[[ "$base_path" != "$application_path" ]] || { echo 'control utility checkout must be separate from candidate application checkout' >&2; exit 3; }

lock_dir="$CONTROL_BASE/.publish.lock"
lock_deadline=$((SECONDS + LOCK_TIMEOUT_SECONDS))
while ! mkdir "$lock_dir" 2>/dev/null; do
  if (( SECONDS >= lock_deadline )); then
    echo 'control publication lock timeout' >&2
    exit 4
  fi
  sleep 0.1
done
stage=""
cleanup_non_active_stages() {
  local active_name="" active_target="" retired retired_path
  if [[ -f "$CONTROL_BASE/active" ]]; then
    active_name="$(tr -d '\r\n' < "$CONTROL_BASE/active")"
    if [[ "$active_name" == stage.* && -d "$CONTROL_BASE/$active_name" ]]; then
      active_target="$(cd "$CONTROL_BASE/$active_name" && pwd -P)"
    fi
  fi
  for retired in "$CONTROL_BASE"/stage.*; do
    [[ -d "$retired" ]] || continue
    retired_path="$(cd "$retired" && pwd -P)"
    [[ -n "$active_target" && "$retired_path" == "$active_target" ]] || rm -rf -- "$retired"
  done
  rm -f -- "$CONTROL_BASE"/active.next.*
}
cleanup_control_runtime() {
  local status=$?
  trap - EXIT
  set +e
  cleanup_non_active_stages
  rmdir "$lock_dir" 2>/dev/null || true
  exit "$status"
}
trap cleanup_control_runtime EXIT
cleanup_non_active_stages
stage="$CONTROL_BASE/stage.$$.${RANDOM}"
git clone --no-checkout "$REMOTE_URL" "$stage"
git -C "$stage" fetch --prune origin
git -C "$stage" checkout --detach "$CONTROL_REF"
CONTROL_SHA="$(git -C "$stage" rev-parse HEAD)"
[[ "$CONTROL_SHA" == "$TRUSTED_CONTROL_SHA" ]] || { echo 'trusted control commit mismatch' >&2; exit 3; }
[[ "$CONTROL_SHA" != "$EXPECTED" ]] || { echo 'control utility checkout must not equal candidate commit' >&2; exit 3; }
git -C "$stage" merge-base --is-ancestor "$EXPECTED" "$CONTROL_SHA" || { echo 'candidate must be an ancestor of the control utility checkout' >&2; exit 3; }
actual_manifest="$(git -C "$stage" show "$CONTROL_SHA:deploy/wsl/CandidateReleaseManifest.json" | sha256sum | cut -d' ' -f1)"
[[ "${actual_manifest,,}" == "${TRUSTED_MANIFEST_SHA,,}" ]] || { echo 'candidate manifest checksum mismatch' >&2; exit 3; }
actual_script="$(git -C "$stage" show "$CONTROL_SHA:deploy/wsl/$ACTION.sh" | sha256sum | cut -d' ' -f1)"
[[ "${actual_script,,}" == "${TRUSTED_SCRIPT_SHA,,}" ]] || { echo 'control script checksum mismatch' >&2; exit 3; }
[[ -z "$(git -C "$stage" status --porcelain)" ]] || { echo 'staged control utility checkout is dirty' >&2; exit 3; }
next="$CONTROL_BASE/active.next.$$"
printf '%s\n' "$(basename "$stage")" > "$next"
mv -f "$next" "$CONTROL_BASE/active"
CONTROL_REPO="$(cd "$stage" && pwd -P)"
export ANVIL_WSL_APPLICATION_REPO="$APPLICATION_REPO" ANVIL_WSL_CONTROL_REPO="$CONTROL_REPO"
# Keep the publication lock for this invocation.  The physical stage path is
# already resolved, so a later active-pointer update cannot redirect execution.
if bash "$CONTROL_REPO/deploy/wsl/$ACTION.sh" "$EXPECTED"; then status=0; else status=$?; fi
exit "$status"
