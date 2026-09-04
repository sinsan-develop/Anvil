#!/usr/bin/env bash
set -euo pipefail

validate_wsl_candidate_manifest() {
  local repo="$1" manifest_ref="$2" expected="$3"
  local control_ref='refs/remotes/origin/codex/c21-operational-execution'
  local candidate_ref='refs/remotes/origin/candidates/c21-wsl-exact48'
  [[ "$manifest_ref" == "$control_ref" ]] || { echo 'candidate control ref must be the exact successor remote-tracking ref' >&2; return 20; }
  [[ "$expected" =~ ^[0-9a-f]{40}$ ]] || { echo 'full 40-character SHA required' >&2; return 20; }
  local control_sha
  control_sha="$(git -C "$repo" rev-parse --verify "$control_ref^{commit}")" || {
    echo 'candidate manifest ref is not a reachable commit' >&2; return 20;
  }
  [[ "$control_sha" != "$expected" ]] || { echo 'candidate and control commits must be distinct' >&2; return 20; }
  local payload manifest_path='deploy/wsl/CandidateReleaseManifest.json' actual_hash supplied_hash
  supplied_hash="${ANVIL_CANDIDATE_MANIFEST_SHA256:?candidate manifest checksum is required}"
  [[ "$supplied_hash" =~ ^[0-9a-fA-F]{64}$ ]] || { echo 'candidate manifest checksum format is invalid' >&2; return 20; }
  actual_hash="$(git -C "$repo" show "$control_ref:$manifest_path" | sha256sum | cut -d' ' -f1)" || {
    echo 'CandidateReleaseManifest.json missing from control ref' >&2; return 20;
  }
  [[ "${actual_hash,,}" == "${supplied_hash,,}" ]] || {
    echo 'candidate manifest checksum mismatch' >&2; return 20;
  }
  payload="$(git -C "$repo" show "$control_ref:$manifest_path")" || {
    echo 'CandidateReleaseManifest.json missing from manifest ref' >&2; return 20;
  }
  local remote_ref candidate_parent
  local python_bin="${ANVIL_PYTHON:-python3}"
  command -v "$python_bin" >/dev/null || { echo 'Python 3 is required for candidate validation' >&2; return 20; }
  mapfile -t validated < <(ANVIL_MANIFEST_PAYLOAD="$payload" "$python_bin" - "$expected" <<'PY'
import hashlib, json, os, re, sys
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
if authority.get('approval_id') != 'APPROVAL-20260904-C21-WSL-EXACT34-CLEANUP-001':
    raise SystemExit('candidate original approval id mismatch')
if authority.get('approval_path') != 'docs/approvals/APPROVAL-20260904-C21-WSL-EXACT34-CLEANUP-001.md':
    raise SystemExit('candidate original approval path mismatch')
if authority.get('approval_artifact_sha256') != '92C34A49FA194F52219D764335157791F37069C2A95AFED65374072F6F60831F':
    raise SystemExit('candidate original approval artifact mismatch')
if authority.get('approval_binding_sha256') != '2167308A28325D199D290574E619BCAEA62056E85BC5860719ADE25C39A753D5':
    raise SystemExit('candidate original approval text mismatch')
if authority.get('private_push_policy') != 'MAIN_AUTONOMOUS_WITHIN_APPROVED_DEVELOPMENT_TEST_SCOPE':
    raise SystemExit('candidate private push policy mismatch')
derived = authority.get('derived_binding')
derived_hash = authority.get('derived_binding_sha256')
if not isinstance(derived, dict) or not re.fullmatch(r'[0-9A-F]{64}', str(derived_hash)):
    raise SystemExit('candidate derived binding is invalid')
canonical = json.dumps(derived, sort_keys=True, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
if hashlib.sha256(canonical).hexdigest().upper() != derived_hash:
    raise SystemExit('candidate derived binding checksum mismatch')
expected_candidate_parent = '18fa604531acfd303c10effa528797fbd5b55c8b'
if derived.get('candidate_parent_commit') != expected_candidate_parent:
    raise SystemExit('candidate parent exact derived binding mismatch')
expected_paths = ['deploy/wsl/bootstrap.sh', 'deploy/wsl/common.sh', 'deploy/wsl/compose.wsl.yml', 'deploy/wsl/deploy.sh', 'tests/deploy/test_wsl_staging_harness.py']
expected_path_hash = '63D5B1B57251E3A6680BBE62280A434E28AD9DFCE764A8D0C1BD2B161A1DE14D'
if any((
    derived.get('correction_path_count') != 5,
    derived.get('correction_path_list_sha256') != expected_path_hash,
    derived.get('correction_paths') != expected_paths,
)):
    raise SystemExit('candidate correction path contract mismatch')
if any((
    derived.get('classification') != 'MAIN_BOUND_INTERNAL_IMPLEMENTATION_CORRECTION',
    derived.get('parent_approval_id') != authority.get('approval_id'),
    derived.get('parent_approval_artifact_sha256') != authority.get('approval_artifact_sha256'),
    derived.get('parent_approval_binding_sha256') != authority.get('approval_binding_sha256'),
    derived.get('prior_candidate_commit') != '830ad98546ed82a59524dd5a6cef0a5b7a6a96b0',
    derived.get('candidate_commit') != expected,
    derived.get('review') != {'spec': 'PASS', 'quality': 'APPROVED'},
    derived.get('scope_change') is not False,
    derived.get('requirements_change') is not False,
    derived.get('important_risk_change') is not False,
    derived.get('cleanup_authority') != 'UNCHANGED_PARENT_APPROVAL',
    derived.get('execution_exclusions') != ['TELEGRAM_EXECUTION', 'PROVIDER_EXECUTION'],
)):
    raise SystemExit('candidate derived binding contract mismatch')
expected_derived_hash = 'C9EC11DE9FCA150F07418449C1A7C554B17909BE8F2647B85C7A763C86D3FA0A'
if derived_hash != expected_derived_hash:
    raise SystemExit('candidate exact derived binding hash mismatch')
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
if doc.get('rollback', {}).get('approved_commits') != [expected]:
    raise SystemExit('candidate rollback approval binding mismatch')
print(remote_ref)
print(derived['candidate_parent_commit'])
PY
) || return 20
  [[ "${#validated[@]}" -eq 2 ]] || { echo 'candidate derived binding output mismatch' >&2; return 20; }
  remote_ref="${validated[0]%$'\r'}"
  candidate_parent="${validated[1]%$'\r'}"
  [[ "$remote_ref" == "$candidate_ref" ]] || { echo 'candidate feature remote ref must be the exact candidate remote-tracking ref' >&2; return 20; }
  local parent_line
  parent_line="$(git -C "$repo" show -s --format=%P "$expected")" || {
    echo 'candidate commit is not reachable' >&2; return 20;
  }
  [[ "$parent_line" == "$candidate_parent" ]] || {
    echo 'candidate parent binding mismatch' >&2; return 21;
  }
  local correction_paths correction_hash
  correction_paths="$(git -C "$repo" diff --name-only "$candidate_parent" "$expected")" || {
    echo 'candidate correction paths are not readable' >&2; return 20;
  }
  [[ "$correction_paths" == $'deploy/wsl/bootstrap.sh\ndeploy/wsl/common.sh\ndeploy/wsl/compose.wsl.yml\ndeploy/wsl/deploy.sh\ntests/deploy/test_wsl_staging_harness.py' ]] || {
    echo 'candidate correction path set mismatch' >&2; return 21;
  }
  correction_hash="$(ANVIL_CORRECTION_PATHS="$correction_paths" "$python_bin" - <<'PY'
import hashlib, json, os
paths = os.environ['ANVIL_CORRECTION_PATHS'].splitlines()
payload = json.dumps(sorted(paths), ensure_ascii=False, separators=(',', ':')).encode('utf-8')
print(hashlib.sha256(payload).hexdigest().upper())
PY
)" || return 20
  [[ "$correction_hash" == '63D5B1B57251E3A6680BBE62280A434E28AD9DFCE764A8D0C1BD2B161A1DE14D' ]] || {
    echo 'candidate correction path hash mismatch' >&2; return 21;
  }
  local remote_sha
  remote_sha="$(git -C "$repo" rev-parse --verify "$candidate_ref^{commit}")" || {
    echo 'candidate feature remote is not reachable' >&2; return 20;
  }
  [[ "$remote_sha" == "$expected" ]] || {
    echo 'candidate does not equal the approved feature remote' >&2; return 21;
  }
  local control_parents
  control_parents="$(git -C "$repo" show -s --format=%P "$control_sha")" || {
    echo 'successor control commit parents are not readable' >&2; return 20;
  }
  [[ "$control_parents" == "$expected" ]] || {
    echo 'successor control commit must be the candidate single-parent direct child' >&2; return 21;
  }
}
