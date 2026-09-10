#!/usr/bin/env bash
set -euo pipefail
EXPECTED="${1:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"
require_exact_sha "$EXPECTED" || exit $?
ROOT="${ANVIL_WSL_DEPLOY_ROOT:-/srv/anvil-wsl}"
require_control_utility_checkout "$SCRIPT_DIR"
REPO="${ANVIL_WSL_APPLICATION_REPO:-$ROOT/repo}"
MANIFEST_REF="${ANVIL_CANDIDATE_MANIFEST_REF:?candidate manifest control ref is required}"
: "${ANVIL_CANDIDATE_MANIFEST_SHA256:?candidate manifest checksum is required}"
source "$SCRIPT_DIR/candidate-manifest-guard.sh"
# Pin once before validation; subsequent policy reads never follow a mutable ref.
CONTROL_COMMIT="$(git -C "$REPO" rev-parse --verify "$MANIFEST_REF^{commit}")" || exit 4
require_exact_sha "$CONTROL_COMMIT" || exit $?
validate_wsl_candidate_manifest "$REPO" "$MANIFEST_REF" "$EXPECTED"
[[ "$(git -C "$REPO" rev-parse --verify "$MANIFEST_REF^{commit}")" == "$CONTROL_COMMIT" ]] || { echo 'control revision changed during rollback validation' >&2; exit 4; }
PYTHON_BIN="${ANVIL_PYTHON:-python3}"
ROLLBACK_POLICY_ROWS="$(git -C "$REPO" show "$CONTROL_COMMIT:deploy/wsl/CandidateReleaseManifest.json" | "$PYTHON_BIN" -c '
import hashlib, json, re, sys
raw = sys.stdin.buffer.read()
expected, checksum = sys.argv[1:]
if not re.fullmatch(r"[0-9a-fA-F]{64}", checksum) or hashlib.sha256(raw).hexdigest().lower() != checksum.lower():
    raise SystemExit("rollback manifest checksum mismatch")
try:
    def unique_object(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError("duplicate manifest key")
            result[key] = value
        return result
    doc = json.loads(raw, object_pairs_hook=unique_object)
    rollback = doc["rollback"]
    approved = rollback["approved_commits"]
    scopes_by_commit = rollback["test_session_permission_scopes_by_commit"]
    source_commit = doc["source"]["commit"]
except (ValueError, KeyError, TypeError):
    raise SystemExit("rollback manifest is malformed")
if (not isinstance(approved, list) or not approved
    or any(not isinstance(value, str) or not re.fullmatch(r"[0-9a-f]{40}", value) for value in approved)
    or len(set(approved)) != len(approved) or expected not in approved or source_commit != expected):
    raise SystemExit("rollback approved commit list is invalid")
if not isinstance(scopes_by_commit, dict) or list(scopes_by_commit) != approved:
    raise SystemExit("rollback scope map keyset or order is invalid")
for commit in approved:
    scopes = scopes_by_commit[commit]
    if (not isinstance(scopes, list) or not scopes
        or any(not isinstance(scope, str) or not scope or scope != scope.strip() or any(ch.isspace() for ch in scope) for scope in scopes)
        or len(scopes) != len(set(scopes))):
        raise SystemExit("rollback scope map value is invalid")
    print(commit + "\t" + ",".join(scopes))
' "$EXPECTED" "$ANVIL_CANDIDATE_MANIFEST_SHA256")" || { echo 'rollback allowlist validation failed' >&2; exit 4; }
load_server_environment "$ROOT/.env"
declare -A scope_by_commit previous_by_target scope_by_target
while IFS=$'\t' read -r commit scopes; do
  scopes="${scopes%$'\r'}"
  [[ -n "$commit" && -n "$scopes" && -z "${scope_by_commit[$commit]+x}" ]] || { echo 'rollback scope policy rows are invalid' >&2; exit 4; }
  scope_by_commit["$commit"]="$scopes"
done <<< "$ROLLBACK_POLICY_ROWS"
candidate_scope="${scope_by_commit[$EXPECTED]:-}"
[[ -n "$candidate_scope" && "$ANVIL_TEST_SESSION_PERMISSION_SCOPES" == "$candidate_scope" ]] || { echo 'candidate test session scope mismatch' >&2; exit 4; }
for target in 15 18-rc; do
  configure_wsl_target "$target"
  [[ "$(cat "$ROOT/runtime/$ANVIL_TARGET_SLUG/current.sha")" == "$EXPECTED" ]] || { echo "current application revision mismatch for $target" >&2; exit 4; }
  previous_file="$ROOT/runtime/$ANVIL_TARGET_SLUG/previous.sha"
  [[ -s "$previous_file" ]] || { echo "previous application revision missing for $target" >&2; exit 4; }
  previous="$(tr -d '\r\n' < "$previous_file")"
  require_exact_sha "$previous" || exit $?
  [[ "$previous" != "$EXPECTED" ]] || { echo 'rollback requires a different previous revision' >&2; exit 4; }
  scope="${scope_by_commit[$previous]:-}"
  [[ -n "$scope" ]] || { echo "previous application revision or scope is not approved for $target" >&2; exit 4; }
  [[ "$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "anvil-wsl-web:$previous")" == "$previous" ]] || { echo 'previous image revision mismatch' >&2; exit 4; }
  previous_by_target["$target"]="$previous"
  scope_by_target["$target"]="$scope"
  ANVIL_RELEASE_COMMIT="$previous" ANVIL_TEST_SESSION_PERMISSION_SCOPES="$scope" wsl_compose config --quiet
done
for target in 15 18-rc; do
  configure_wsl_target "$target"
  previous="${previous_by_target[$target]}"
  scope="${scope_by_target[$target]}"
  ANVIL_RELEASE_COMMIT="$previous"; export ANVIL_RELEASE_COMMIT
  ANVIL_TEST_SESSION_PERMISSION_SCOPES="$scope" wsl_compose up -d --no-build --force-recreate anvil-web
  ANVIL_TEST_SESSION_PERMISSION_SCOPES="$scope" start_wsl_ingress
  printf '%s\n' "$previous" > "$ROOT/runtime/$ANVIL_TARGET_SLUG/current.sha.tmp.$$"
  mv -f "$ROOT/runtime/$ANVIL_TARGET_SLUG/current.sha.tmp.$$" "$ROOT/runtime/$ANVIL_TARGET_SLUG/current.sha"
  printf '{"status":"APPLICATION_ROLLED_BACK","from":"%s","to":"%s","postgres_target":"%s","database_migration":"PRESERVED_NO_AUTOMATIC_DOWNGRADE","secret_values":"omitted"}\n' \
    "$EXPECTED" "$previous" "$target" > "$ROOT/evidence/$ANVIL_TARGET_SLUG-rollback.json.tmp.$$"
  mv -f "$ROOT/evidence/$ANVIL_TARGET_SLUG-rollback.json.tmp.$$" "$ROOT/evidence/$ANVIL_TARGET_SLUG-rollback.json"
done
