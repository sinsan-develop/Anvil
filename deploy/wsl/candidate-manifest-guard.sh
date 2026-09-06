#!/usr/bin/env bash
set -euo pipefail

readonly C21_CANDIDATE_CONTROL_REF='refs/remotes/origin/codex/c21-operational-execution'
readonly C21_CANDIDATE_REF='refs/remotes/origin/candidates/c21-wsl-exact107'
readonly C21_CANDIDATE_SOURCE='a6dca0da5a37e64491e91813895268e78ecb78b2'
readonly C21_CANDIDATE_PARENT='e4cccf3ce99e29005103cea3bd76fa0eede36f28'
readonly C21_CANDIDATE_BRANCH='codex/c21-operational-execution'
readonly C21_CANDIDATE_UPSTREAM='origin/codex/c21-operational-execution'
readonly C21_SOURCE_PATH_HASH='87A153B8CF5F7B1C8A4B4CDD1589369164D7B7B7849971DC3E4D10EFFA7707D2'
readonly C21_CONTROL_PATH_HASH='6DE878D2FD387431D2869BD5A0F070862B48727391F7F44D6D1FEEF983702765'

_c21_path_hash() {
  local paths="$1" python_bin="${ANVIL_PYTHON:-python3}"
  command -v "$python_bin" >/dev/null || return 20
  ANVIL_C21_PATHS="$paths" "$python_bin" - <<'PY'
import hashlib, os
print(hashlib.sha256((''.join(f'{p}\n' for p in sorted(filter(None, os.environ['ANVIL_C21_PATHS'].splitlines())))).encode()).hexdigest().upper())
PY
}

validate_wsl_candidate_binding() {
  local repo="$1" manifest_ref="$2" expected="$3" pinned_control_sha="${4:-}"
  [[ "$manifest_ref" == "$C21_CANDIDATE_CONTROL_REF" ]] || { echo 'candidate control ref must be exact' >&2; return 20; }
  [[ "$expected" == "$C21_CANDIDATE_SOURCE" ]] || { echo 'candidate source must be the exact107 commit' >&2; return 20; }
  local control_sha supplied_hash actual_hash payload
  control_sha="$(git -C "$repo" rev-parse --verify "$manifest_ref^{commit}")" || { echo 'candidate control ref is unreachable' >&2; return 20; }
  [[ -z "$pinned_control_sha" || "$control_sha" == "$pinned_control_sha" ]] || { echo 'pinned control revision mismatch' >&2; return 20; }
  supplied_hash="${ANVIL_CANDIDATE_MANIFEST_SHA256:?candidate manifest checksum is required}"
  [[ "$supplied_hash" =~ ^[0-9a-fA-F]{64}$ ]] || { echo 'candidate manifest checksum format is invalid' >&2; return 20; }
  actual_hash="$(git -C "$repo" show "$control_sha:deploy/wsl/CandidateReleaseManifest.json" | sha256sum | cut -d' ' -f1)" || { echo 'candidate manifest missing from immutable control' >&2; return 20; }
  [[ "${actual_hash,,}" == "${supplied_hash,,}" ]] || { echo 'candidate manifest checksum mismatch' >&2; return 20; }
  payload="$(git -C "$repo" show "$control_sha:deploy/wsl/CandidateReleaseManifest.json")" || return 20
  local python_bin="${ANVIL_PYTHON:-python3}"
  command -v "$python_bin" >/dev/null || { echo 'Python 3 is required for candidate validation' >&2; return 20; }
  ANVIL_C21_MANIFEST="$payload" "$python_bin" - <<'PY' || { echo 'candidate manifest contract mismatch' >&2; return 20; }
import json, os
doc=json.loads(os.environ['ANVIL_C21_MANIFEST'])
expected={
 'schema_version':1,'manifest_type':'C21_PROVIDER_WSL_GIT_ONLY_CANDIDATE',
 'status':'GIT_ONLY_CANDIDATE_BOUND_PENDING_PUSH',
 'runtime_safety_gate':'BLOCKED_EXTERNAL_EXECUTION_NOT_IN_SCOPE',
 'source':{'commit':'a6dca0da5a37e64491e91813895268e78ecb78b2','remote_ref':'refs/remotes/origin/candidates/c21-wsl-exact107','working_tree':'CLEAN','branch':'codex/c21-operational-execution','upstream':'origin/codex/c21-operational-execution'},
 'lineage':{'source_parent_commit':'e4cccf3ce99e29005103cea3bd76fa0eede36f28','source_direct_child_path_count':10,'source_direct_child_path_list_sha256':'87A153B8CF5F7B1C8A4B4CDD1589369164D7B7B7849971DC3E4D10EFFA7707D2','control_direct_child_path_count':12,'control_direct_child_path_list_sha256':'6DE878D2FD387431D2869BD5A0F070862B48727391F7F44D6D1FEEF983702765','source_cumulative_exact_path_count':107,'source_cumulative_exact_path_list_sha256':'E9AA3CF3DCC4B5E651691E53A3201FE29A76B1D269B409FA99468FF0D1A28E70','post_developer_cumulative_exact_path_count':109,'post_developer_cumulative_exact_path_list_sha256':'16B35029243DAEF7A18A73DDBAA45C5E3150C7AF5B1863287CD823EAAA6DCB2E'},
 'authority':{'work_instruction_id':'WI-C-21-PROVIDER-WSL-GIT-ONLY-CANDIDATE-20260906-001','work_instruction_path':'docs/work_orders/C-21_PROVIDER_WSL_GIT_ONLY_CANDIDATE_WORK_INSTRUCTION.md','predecessor_remote_control':'772afbd5eb55791ca7b5002d58378437ea496750','execution_fencing_token':'c21-provider-wsl-git-only-candidate-execution-fence-epoch-1-e4cccf3','write_fencing_token':'c21-provider-wsl-git-only-candidate-write-fence-epoch-1-e4cccf3'},
 'exclusions':['PUSH_EXECUTION','WSL_EXECUTION','DOCKER_EXECUTION','DATABASE_EXECUTION','PROVIDER_EXECUTION','TELEGRAM_EXECUTION','YSNA_EXECUTION','MAIN_MERGE'],
 'rollback':{'approved_commits':['a6dca0da5a37e64491e91813895268e78ecb78b2','e4cccf3ce99e29005103cea3bd76fa0eede36f28']},
}
expected['cleanup'] = {
 'exact_named_volumes': ['anvil-wsl-pg15_anvil-db-data', 'anvil-wsl-pg18rc_anvil-db-data'],
 'required_labels': {'com.anvil.environment': 'WSL_SERVER_TEST_STAGING', 'com.anvil.cleanup-scope': 'C21_WSL_ISOLATED_TEST'},
}
if doc != expected: raise SystemExit(1)
PY
  [[ "$(git -C "$repo" show -s --format=%P "$expected")" == "$C21_CANDIDATE_PARENT" ]] || { echo 'candidate source parent mismatch' >&2; return 21; }
  local source_paths control_paths
  source_paths="$(git -C "$repo" diff --name-only "$C21_CANDIDATE_PARENT" "$expected")" || return 20
  [[ "$(printf '%s\n' "$source_paths" | sed '/^$/d' | wc -l | tr -d ' ')" == 10 && "$(_c21_path_hash "$source_paths")" == "$C21_SOURCE_PATH_HASH" ]] || { echo 'candidate source direct-child path contract mismatch' >&2; return 21; }
  [[ "$(git -C "$repo" rev-parse --verify "$C21_CANDIDATE_REF^{commit}")" == "$expected" ]] || { echo 'candidate remote ref mismatch' >&2; return 21; }
  [[ "$(git -C "$repo" show -s --format=%P "$control_sha")" == "$expected" ]] || { echo 'candidate control must be a single direct child' >&2; return 21; }
  control_paths="$(git -C "$repo" diff --name-only "$expected" "$control_sha")" || return 20
  [[ "$(printf '%s\n' "$control_paths" | sed '/^$/d' | wc -l | tr -d ' ')" == 12 && "$(_c21_path_hash "$control_paths")" == "$C21_CONTROL_PATH_HASH" ]] || { echo 'candidate control exact12 path contract mismatch' >&2; return 21; }
  local base='eef349682ff5598e3488c9e75163c5e0a99a0bdb' cumulative_source cumulative_control
  git -C "$repo" merge-base --is-ancestor "$base" "$expected" || { echo 'validated base is not a source ancestor' >&2; return 21; }
  cumulative_source="$(git -C "$repo" diff --name-only "$base" "$expected")" || return 20
  cumulative_control="$(git -C "$repo" diff --name-only "$base" "$control_sha")" || return 20
  [[ "$(_c21_path_hash "$cumulative_source")" == 'E9AA3CF3DCC4B5E651691E53A3201FE29A76B1D269B409FA99468FF0D1A28E70' ]] || { echo 'source cumulative exact107 mismatch' >&2; return 21; }
  [[ "$(_c21_path_hash "$cumulative_control")" == '16B35029243DAEF7A18A73DDBAA45C5E3150C7AF5B1863287CD823EAAA6DCB2E' ]] || { echo 'control cumulative exact109 mismatch' >&2; return 21; }
  [[ "$(git -C "$repo" branch --show-current)" == "$C21_CANDIDATE_BRANCH" ]] || { echo 'candidate branch mismatch' >&2; return 21; }
  [[ "$(git -C "$repo" rev-parse --abbrev-ref --symbolic-full-name '@{u}')" == "$C21_CANDIDATE_UPSTREAM" ]] || { echo 'candidate upstream mismatch' >&2; return 21; }
  local status_raw local_head upstream_head
  status_raw="$(git -C "$repo" status --porcelain=v1 --untracked-files=all)" || { echo 'candidate Git status collection failed' >&2; return 20; }
  [[ -z "$status_raw" ]] || { echo 'candidate working tree is not clean' >&2; return 21; }
  local_head="$(git -C "$repo" rev-parse --verify HEAD)" || return 20
  [[ "$local_head" == "$expected" || "$local_head" == "$control_sha" ]] || { echo 'candidate local HEAD mismatch' >&2; return 21; }
  upstream_head="$(git -C "$repo" rev-parse --verify '@{u}^{commit}')" || return 20
  [[ "$upstream_head" == "$control_sha" ]] || { echo 'candidate upstream HEAD mismatch' >&2; return 21; }
}

validate_wsl_execution_resume() {
  echo 'runtime execution blocked: BLOCKED_EXTERNAL_EXECUTION_NOT_IN_SCOPE' >&2
  return 22
}

validate_wsl_candidate_manifest() {
  local repo="$1" manifest_ref="$2" expected="$3" control_sha
  control_sha="$(git -C "$repo" rev-parse --verify "$manifest_ref^{commit}")" || return 20
  validate_wsl_candidate_binding "$repo" "$manifest_ref" "$expected" "$control_sha" || return $?
  [[ "$(git -C "$repo" rev-parse --verify "$manifest_ref^{commit}")" == "$control_sha" ]] || { echo 'control revision changed during runtime validation' >&2; return 20; }
  validate_wsl_execution_resume
}
