#!/usr/bin/env bash
set -euo pipefail

validate_wsl_candidate_manifest() {
  local repo="$1" manifest_ref="$2" expected="$3"
  [[ "$manifest_ref" != -* ]] || { echo 'candidate manifest ref must not begin with a dash' >&2; return 20; }
  [[ "$expected" =~ ^[0-9a-f]{40}$ ]] || { echo 'full 40-character SHA required' >&2; return 20; }
  git -C "$repo" rev-parse --verify "$manifest_ref^{commit}" >/dev/null || {
    echo 'candidate manifest ref is not a reachable commit' >&2; return 20;
  }
  local payload manifest_path='deploy/wsl/CandidateReleaseManifest.json'
  payload="$(git -C "$repo" show "$manifest_ref:$manifest_path")" || {
    echo 'CandidateReleaseManifest.json missing from manifest ref' >&2; return 20;
  }
  if [[ -n "${ANVIL_CANDIDATE_MANIFEST_SHA256:-}" ]]; then
    local actual_hash
    actual_hash="$(printf '%s' "$payload" | sha256sum | cut -d' ' -f1)"
    [[ "$actual_hash" == "$ANVIL_CANDIDATE_MANIFEST_SHA256" ]] || {
      echo 'candidate manifest checksum mismatch' >&2; return 20;
    }
  fi
  local remote_ref
  local python_bin="${ANVIL_PYTHON:-python3}"
  command -v "$python_bin" >/dev/null || { echo 'Python 3 is required for candidate validation' >&2; return 20; }
  remote_ref="$(ANVIL_MANIFEST_PAYLOAD="$payload" "$python_bin" - "$expected" <<'PY'
import json, os, re, sys
expected = sys.argv[1]
doc = json.loads(os.environ['ANVIL_MANIFEST_PAYLOAD'])
if doc.get('schema_version') != 1 or doc.get('manifest_type') != 'WSL_STAGING_CANDIDATE':
    raise SystemExit('candidate manifest contract mismatch')
if doc.get('status') != 'APPROVED_FOR_STAGING_VALIDATION':
    raise SystemExit('candidate manifest is not approved for WSL staging')
source = doc.get('source', {})
if source.get('commit') != expected or source.get('working_tree') != 'CLEAN':
    raise SystemExit('candidate source binding mismatch')
remote_ref = source.get('remote_ref', '')
if not re.fullmatch(r'refs/remotes/origin/[A-Za-z0-9._/-]+', remote_ref) or '..' in remote_ref:
    raise SystemExit('candidate feature remote ref is invalid')
environment = doc.get('environment', {})
if environment.get('name') != 'WSL_SERVER_TEST_STAGING':
    raise SystemExit('candidate environment mismatch')
if environment.get('postgres_targets') != ['15', '18-rc']:
    raise SystemExit('candidate PostgreSQL targets mismatch')
authority = doc.get('authority', {})
binding = authority.get('approval_binding_sha256', '')
if not authority.get('approval_id') or not re.fullmatch(r'[0-9a-fA-F]{64}', binding):
    raise SystemExit('candidate approval binding is invalid')
if doc.get('exclusions') != ['TELEGRAM_EXECUTION', 'PROVIDER_EXECUTION']:
    raise SystemExit('candidate execution exclusions mismatch')
cleanup = doc.get('cleanup', {})
if cleanup.get('exact_named_volumes') != [
    'anvil-wsl-pg15_anvil-db-data', 'anvil-wsl-pg18rc_anvil-db-data'
]:
    raise SystemExit('candidate cleanup volume allowlist mismatch')
if cleanup.get('required_labels') != {
    'com.anvil.environment': 'WSL_SERVER_TEST_STAGING',
    'com.anvil.cleanup-scope': 'C21_WSL_ISOLATED_TEST',
}:
    raise SystemExit('candidate cleanup labels mismatch')
print(remote_ref)
PY
)" || return 20
  local remote_sha
  remote_sha="$(git -C "$repo" rev-parse --verify "$remote_ref^{commit}")" || {
    echo 'candidate feature remote is not reachable' >&2; return 20;
  }
  [[ "$remote_sha" == "$expected" ]] || {
    echo 'candidate does not equal the approved feature remote' >&2; return 21;
  }
  git -C "$repo" cat-file -e "$expected^{commit}"
}
