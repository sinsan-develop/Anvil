#!/usr/bin/env bash
set -euo pipefail

ROOT="${ANVIL_DEPLOY_ROOT:?ANVIL_DEPLOY_ROOT is required}"
RELEASE="${ANVIL_RELEASE_COMMIT:?ANVIL_RELEASE_COMMIT is required}"
[[ "$RELEASE" =~ ^[0-9a-f]{40}$ ]] || { echo 'full release SHA required' >&2; exit 2; }
ACTION="${1:-}"
[[ "$ACTION" == apply || "$ACTION" == restore ]] || { echo 'usage: rebind-c21-test-session.sh apply|restore' >&2; exit 2; }
RUNTIME_ENV="$ROOT/runtime/anvil.env"
BACKUP="$ROOT/runtime/anvil.env.c21-before-$RELEASE"
RECEIPT="$ROOT/evidence/c21-test-session-rebind.json"
[[ -f "$RUNTIME_ENV" ]] || { echo 'runtime environment file is missing' >&2; exit 4; }
mkdir -p "$ROOT/evidence"
umask 077

file_hash() { sha256sum "$1" | cut -d' ' -f1; }
assert_mode() {
  local mode
  mode="$(stat -c '%a' "$1")"
  [[ "$mode" == 600 || "$mode" == 400 ]] || { echo 'runtime environment file must be mode 0600 or stricter' >&2; exit 4; }
}

if [[ "$ACTION" == apply ]]; then
  : "${ANVIL_C21_RUN_ID:?ANVIL_C21_RUN_ID is required}"
  [[ "$ANVIL_C21_RUN_ID" =~ ^[A-Za-z0-9._:-]{1,128}$ ]] || { echo 'C-21 run id is invalid' >&2; exit 4; }
  assert_mode "$RUNTIME_ENV"
  if [[ ! -e "$BACKUP" ]]; then
    install -m 600 "$RUNTIME_ENV" "$BACKUP.tmp.$$"
    mv -f "$BACKUP.tmp.$$" "$BACKUP"
  fi
  assert_mode "$BACKUP"
  before_hash="$(file_hash "$BACKUP")"
  awk '!/^ANVIL_TEST_SESSION_RUN_IDS=/ && !/^ANVIL_TEST_SESSION_PERMISSION_SCOPES=/ && !/^ANVIL_TEST_SESSION_PROJECT_ID=/' "$RUNTIME_ENV" > "$RUNTIME_ENV.tmp.$$"
  printf 'ANVIL_TEST_SESSION_RUN_IDS=%s\n' "$ANVIL_C21_RUN_ID" >> "$RUNTIME_ENV.tmp.$$"
  printf 'ANVIL_TEST_SESSION_PERMISSION_SCOPES=tasks:write,tasks:read,run:events:read\n' >> "$RUNTIME_ENV.tmp.$$"
  if [[ -n "${ANVIL_C21_PROJECT_ID:-}" ]]; then
    [[ "$ANVIL_C21_PROJECT_ID" =~ ^[A-Za-z0-9._:-]{1,128}$ ]] || { echo 'C-21 project id is invalid' >&2; exit 4; }
    printf 'ANVIL_TEST_SESSION_PROJECT_ID=%s\n' "$ANVIL_C21_PROJECT_ID" >> "$RUNTIME_ENV.tmp.$$"
  fi
  chmod 600 "$RUNTIME_ENV.tmp.$$"
  mv -f "$RUNTIME_ENV.tmp.$$" "$RUNTIME_ENV"
  [[ "$(grep -Ec '^ANVIL_TEST_SESSION_RUN_IDS=' "$RUNTIME_ENV")" == 1 ]] || exit 6
  [[ "$(grep -Ec '^ANVIL_TEST_SESSION_PERMISSION_SCOPES=' "$RUNTIME_ENV")" == 1 ]] || exit 6
  if [[ -n "${ANVIL_C21_PROJECT_ID:-}" ]]; then
    [[ "$(grep -Ec '^ANVIL_TEST_SESSION_PROJECT_ID=' "$RUNTIME_ENV")" == 1 ]] || exit 6
  fi
  after_hash="$(file_hash "$RUNTIME_ENV")"
  timestamp="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
  printf '{"status":"APPLIED","release_commit":"%s","before_sha256":"%s","after_sha256":"%s","backup_mode":"600","assignment_counts":{"run_ids":1,"permission_scopes":1},"created_at":"%s","secret_values":"omitted"}\n' \
    "$RELEASE" "$before_hash" "$after_hash" "$timestamp" > "$RECEIPT.tmp.$$"
  chmod 600 "$RECEIPT.tmp.$$"
  mv -f "$RECEIPT.tmp.$$" "$RECEIPT"
else
  [[ -f "$BACKUP" ]] || { echo 'C-21 environment backup is missing' >&2; exit 5; }
  assert_mode "$BACKUP"
  install -m 600 "$BACKUP" "$RUNTIME_ENV.tmp.$$"
  mv -f "$RUNTIME_ENV.tmp.$$" "$RUNTIME_ENV"
  restored_hash="$(file_hash "$RUNTIME_ENV")"
  [[ "$restored_hash" == "$(file_hash "$BACKUP")" ]] || { echo 'C-21 environment restore hash mismatch' >&2; exit 6; }
  timestamp="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
  printf '{"status":"RESTORED","release_commit":"%s","restored_sha256":"%s","backup_mode":"600","created_at":"%s","secret_values":"omitted"}\n' \
    "$RELEASE" "$restored_hash" "$timestamp" > "$RECEIPT.tmp.$$"
  chmod 600 "$RECEIPT.tmp.$$"
  mv -f "$RECEIPT.tmp.$$" "$RECEIPT"
fi

printf 'C-21 test-session environment %s; secret values omitted\n' "$ACTION"
