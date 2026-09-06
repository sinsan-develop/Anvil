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

# seq536 execution-resume successor.  The historical definitions above remain
# byte-visible for audit; these final definitions are the public runtime API.
readonly C21_RESUME_CANDIDATE='a6dca0da5a37e64491e91813895268e78ecb78b2'
readonly C21_RESUME_CANDIDATE_PARENT='e4cccf3ce99e29005103cea3bd76fa0eede36f28'
readonly C21_RESUME_GIT_ONLY_CONTROL='e6c562cf07bc2c35e24addb60efa9d90fae08046'
readonly C21_RESUME_START_CONTROL='d442d4584516e1a673fd2edde55a2fe1330e9394'
readonly C21_RESUME_BASE='eef349682ff5598e3488c9e75163c5e0a99a0bdb'
readonly C21_RESUME_WI='docs/work_orders/C-21_PROVIDER_WSL_EXECUTION_RESUME_WORK_INSTRUCTION.md'
readonly C21_RESUME_WI_SHA='49232DEB6348A0FE6C011B57B76EC9B8A9733FFAAF5D6E9C988DB2560AC67AA3'

_c21_resume_exact_paths() {
  case "$1" in
    candidate) git -C "$2" diff --name-only "$C21_RESUME_CANDIDATE_PARENT" "$C21_RESUME_CANDIDATE" ;;
    git-only) git -C "$2" diff --name-only "$C21_RESUME_CANDIDATE" "$C21_RESUME_GIT_ONLY_CONTROL" ;;
    start) git -C "$2" diff --name-only "$C21_RESUME_GIT_ONLY_CONTROL" "$C21_RESUME_START_CONTROL" ;;
    bound) git -C "$2" diff --name-only "$C21_RESUME_START_CONTROL" "$3" ;;
    cumulative-candidate) git -C "$2" diff --name-only "$C21_RESUME_BASE" "$C21_RESUME_CANDIDATE" ;;
    cumulative-git-only) git -C "$2" diff --name-only "$C21_RESUME_BASE" "$C21_RESUME_GIT_ONLY_CONTROL" ;;
    cumulative-start) git -C "$2" diff --name-only "$C21_RESUME_BASE" "$C21_RESUME_START_CONTROL" ;;
    cumulative-bound) git -C "$2" diff --name-only "$C21_RESUME_BASE" "$3" ;;
    *) return 20 ;;
  esac
}

_c21_resume_assert_paths() {
  local label="$1" repo="$2" control="$3" count="$4" expected_hash="$5" paths actual_count actual_hash
  paths="$(_c21_resume_exact_paths "$label" "$repo" "$control")" || { echo "$label path collection failed" >&2; return 20; }
  actual_count="$(printf '%s\n' "$paths" | sed '/^$/d' | wc -l | tr -d ' ')"
  actual_hash="$(_c21_path_hash "$paths")" || { echo "$label path hash failed" >&2; return 20; }
  [[ "$actual_count" == "$count" && "$actual_hash" == "$expected_hash" ]] || {
    echo "$label path contract mismatch" >&2; return 21;
  }
}

_c21_resume_manifest_contract() {
  local payload="$1" python_bin="${ANVIL_PYTHON:-python3}"
  command -v "$python_bin" >/dev/null || { echo 'Python 3 is required for candidate validation' >&2; return 20; }
  ANVIL_C21_MANIFEST="$payload" "$python_bin" - <<'PY'
import hashlib, json, os, re
def unique(pairs):
    out={}
    for key,value in pairs:
        if key in out: raise ValueError('duplicate manifest key')
        out[key]=value
    return out
def nonfinite(value): raise ValueError('nonfinite manifest value')
doc=json.loads(os.environ['ANVIL_C21_MANIFEST'], object_pairs_hook=unique, parse_constant=nonfinite)
if not isinstance(doc,dict) or set(doc) != {'schema_version','manifest_type','status','runtime_safety_gate','source','environment','authority','exclusions','cleanup','rollback'}:
    raise SystemExit(1)
if (doc['schema_version'],doc['manifest_type'],doc['status'],doc['runtime_safety_gate']) != (1,'WSL_STAGING_CANDIDATE','APPROVED_FOR_STAGING_VALIDATION','READY_FOR_APPROVED_WSL_QA'):
    raise SystemExit(1)
if doc['source'] != {'commit':'a6dca0da5a37e64491e91813895268e78ecb78b2','remote_ref':'refs/remotes/origin/candidates/c21-wsl-exact107','working_tree':'CLEAN','branch':'codex/c21-operational-execution','upstream':'origin/codex/c21-operational-execution'}:
    raise SystemExit(1)
if doc['environment'] != {'name':'WSL_SERVER_TEST_STAGING','postgres_targets':['15','18-rc']}:
    raise SystemExit(1)
authority=doc['authority']; derived=authority.get('derived_binding')
if not isinstance(derived,dict) or not re.fullmatch(r'[A-F0-9]{64}',str(authority.get('derived_binding_sha256'))): raise SystemExit(1)
canonical=json.dumps(derived,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()
if hashlib.sha256(canonical).hexdigest().upper()!=authority['derived_binding_sha256']: raise SystemExit(1)
fixed_authority={
 'approval_id':'APPROVAL-20260904-C21-WSL-EXACT34-CLEANUP-001',
 'approval_path':'docs/approvals/APPROVAL-20260904-C21-WSL-EXACT34-CLEANUP-001.md',
 'approval_artifact_sha256':'92C34A49FA194F52219D764335157791F37069C2A95AFED65374072F6F60831F',
 'approval_binding_sha256':'2167308A28325D199D290574E619BCAEA62056E85BC5860719ADE25C39A753D5',
 'private_push_policy':'MAIN_AUTONOMOUS_WITHIN_APPROVED_DEVELOPMENT_TEST_SCOPE'}
if any(authority.get(k)!=v for k,v in fixed_authority.items()) or set(authority)!=(set(fixed_authority)|{'derived_binding','derived_binding_sha256'}): raise SystemExit(1)
expected_resume={'work_instruction_path':'docs/work_orders/C-21_PROVIDER_WSL_EXECUTION_RESUME_WORK_INSTRUCTION.md','work_instruction_sha256':'49232DEB6348A0FE6C011B57B76EC9B8A9733FFAAF5D6E9C988DB2560AC67AA3','predecessor_control_commit':'d442d4584516e1a673fd2edde55a2fe1330e9394','environment':'WSL_SERVER_TEST_STAGING','postgres_targets':['15','18-rc'],'actions':['deploy','verify','rollback','cleanup'],'exclusions':['TELEGRAM_EXECUTION','PROVIDER_EXECUTION','YSNA_EXECUTION','MAIN_MERGE']}
expected_chain={'candidate_direct_path_count':10,'candidate_direct_path_list_sha256':'87A153B8CF5F7B1C8A4B4CDD1589369164D7B7B7849971DC3E4D10EFFA7707D2','git_only_direct_path_count':12,'git_only_direct_path_list_sha256':'6DE878D2FD387431D2869BD5A0F070862B48727391F7F44D6D1FEEF983702765','resume_start_direct_path_count':10,'resume_start_direct_path_list_sha256':'0FCFCE1A57E7A806B9E94B495DBE7CF3AEFD720FB6B8ACFF029DA0CEBB7EA070','resume_bound_direct_path_count':14,'resume_bound_direct_path_list_sha256':'3A67A5443BBCD92B125E5168442B5EB46A1FBA4EA0A9AE061411FB655921C09B','candidate_cumulative_path_count':107,'candidate_cumulative_path_list_sha256':'E9AA3CF3DCC4B5E651691E53A3201FE29A76B1D269B409FA99468FF0D1A28E70','git_only_cumulative_path_count':109,'git_only_cumulative_path_list_sha256':'16B35029243DAEF7A18A73DDBAA45C5E3150C7AF5B1863287CD823EAAA6DCB2E','resume_start_cumulative_path_count':113,'resume_start_cumulative_path_list_sha256':'3823FE6C7839D6E306A16C0CD765AF1105422ECAAEBEEA340DA7C18652A8CA5D','resume_bound_cumulative_path_count':117,'resume_bound_cumulative_path_list_sha256':'6E50421CAB8A0E2A99B1ED1A074A4CAB487B8A0C4EA5D77F526343C3402DABA1'}
expected_derived={'classification':'MAIN_RESUMED_APPROVED_WSL_QA','parent_approval_id':fixed_authority['approval_id'],'parent_approval_artifact_sha256':fixed_authority['approval_artifact_sha256'],'parent_approval_binding_sha256':fixed_authority['approval_binding_sha256'],'candidate_parent_commit':'e4cccf3ce99e29005103cea3bd76fa0eede36f28','candidate_commit':'a6dca0da5a37e64491e91813895268e78ecb78b2','git_only_control_commit':'e6c562cf07bc2c35e24addb60efa9d90fae08046','execution_resume_start_commit':'d442d4584516e1a673fd2edde55a2fe1330e9394','control_chain':expected_chain,'execution_resume':expected_resume,'review':{'spec':'DEVELOPER_VALIDATED','quality':'PENDING_INDEPENDENT_REVIEW'},'scope_change':False,'requirements_change':False,'important_risk_change':False}
if derived!=expected_derived: raise SystemExit(1)
exclusions=['TELEGRAM_EXECUTION','PROVIDER_EXECUTION','YSNA_EXECUTION','MAIN_MERGE']
if doc['exclusions']!=exclusions: raise SystemExit(1)
if doc['cleanup']!={'exact_named_volumes':['anvil-wsl-pg15_anvil-db-data','anvil-wsl-pg18rc_anvil-db-data'],'required_labels':{'com.anvil.environment':'WSL_SERVER_TEST_STAGING','com.anvil.cleanup-scope':'C21_WSL_ISOLATED_TEST'}}: raise SystemExit(1)
if doc['rollback']!={'approved_commits':['a6dca0da5a37e64491e91813895268e78ecb78b2','e4cccf3ce99e29005103cea3bd76fa0eede36f28'],'runtime_observation_required':True}: raise SystemExit(1)
PY
}

validate_wsl_candidate_binding() {
  local repo="$1" manifest_ref="$2" expected="$3" pinned_control_sha="${4:-}" control_sha payload supplied_hash actual_hash
  [[ "$manifest_ref" == 'refs/remotes/origin/codex/c21-operational-execution' ]] || { echo 'candidate control ref must be exact' >&2; return 20; }
  [[ "$expected" == "$C21_RESUME_CANDIDATE" ]] || { echo 'candidate source must be the exact107 commit' >&2; return 20; }
  control_sha="$(git -C "$repo" rev-parse --verify "$manifest_ref^{commit}")" || { echo 'candidate control ref is unreachable' >&2; return 20; }
  [[ -z "$pinned_control_sha" || "$control_sha" == "$pinned_control_sha" ]] || { echo 'pinned control revision mismatch' >&2; return 20; }
  supplied_hash="${ANVIL_CANDIDATE_MANIFEST_SHA256:?candidate manifest checksum is required}"
  [[ "$supplied_hash" =~ ^[0-9a-fA-F]{64}$ ]] || { echo 'candidate manifest checksum format is invalid' >&2; return 20; }
  payload="$(git -C "$repo" show "$control_sha:deploy/wsl/CandidateReleaseManifest.json")" || { echo 'candidate manifest missing from immutable control' >&2; return 20; }
  actual_hash="$(printf '%s\n' "$payload" | sha256sum | cut -d' ' -f1)" || return 20
  [[ "${actual_hash,,}" == "${supplied_hash,,}" ]] || { echo 'candidate manifest checksum mismatch' >&2; return 20; }
  _c21_resume_manifest_contract "$payload" || { echo 'candidate manifest contract mismatch' >&2; return 20; }
  [[ "$(git -C "$repo" show -s --format=%P "$C21_RESUME_CANDIDATE")" == "$C21_RESUME_CANDIDATE_PARENT" ]] || { echo 'candidate parent mismatch' >&2; return 21; }
  [[ "$(git -C "$repo" show -s --format=%P "$C21_RESUME_GIT_ONLY_CONTROL")" == "$C21_RESUME_CANDIDATE" ]] || { echo 'git-only control parent mismatch' >&2; return 21; }
  [[ "$(git -C "$repo" show -s --format=%P "$C21_RESUME_START_CONTROL")" == "$C21_RESUME_GIT_ONLY_CONTROL" ]] || { echo 'resume start parent mismatch' >&2; return 21; }
  [[ "$(git -C "$repo" show -s --format=%P "$control_sha")" == "$C21_RESUME_START_CONTROL" ]] || { echo 'resume control must be a single direct child' >&2; return 21; }
  [[ "$(git -C "$repo" rev-parse --verify 'refs/remotes/origin/candidates/c21-wsl-exact107^{commit}')" == "$expected" ]] || { echo 'candidate remote ref mismatch' >&2; return 21; }
  _c21_resume_assert_paths candidate "$repo" "$control_sha" 10 87A153B8CF5F7B1C8A4B4CDD1589369164D7B7B7849971DC3E4D10EFFA7707D2 || return $?
  _c21_resume_assert_paths git-only "$repo" "$control_sha" 12 6DE878D2FD387431D2869BD5A0F070862B48727391F7F44D6D1FEEF983702765 || return $?
  _c21_resume_assert_paths start "$repo" "$control_sha" 10 0FCFCE1A57E7A806B9E94B495DBE7CF3AEFD720FB6B8ACFF029DA0CEBB7EA070 || return $?
  _c21_resume_assert_paths bound "$repo" "$control_sha" 14 3A67A5443BBCD92B125E5168442B5EB46A1FBA4EA0A9AE061411FB655921C09B || return $?
  _c21_resume_assert_paths cumulative-candidate "$repo" "$control_sha" 107 E9AA3CF3DCC4B5E651691E53A3201FE29A76B1D269B409FA99468FF0D1A28E70 || return $?
  _c21_resume_assert_paths cumulative-git-only "$repo" "$control_sha" 109 16B35029243DAEF7A18A73DDBAA45C5E3150C7AF5B1863287CD823EAAA6DCB2E || return $?
  _c21_resume_assert_paths cumulative-start "$repo" "$control_sha" 113 3823FE6C7839D6E306A16C0CD765AF1105422ECAAEBEEA340DA7C18652A8CA5D || return $?
  _c21_resume_assert_paths cumulative-bound "$repo" "$control_sha" 117 6E50421CAB8A0E2A99B1ED1A074A4CAB487B8A0C4EA5D77F526343C3402DABA1 || return $?
  git -C "$repo" merge-base --is-ancestor "$C21_RESUME_BASE" "$control_sha" || { echo 'validated base is not a control ancestor' >&2; return 21; }
  [[ "$(git -C "$repo" branch --show-current)" == 'codex/c21-operational-execution' ]] || { echo 'candidate branch mismatch' >&2; return 21; }
  [[ "$(git -C "$repo" rev-parse --abbrev-ref --symbolic-full-name '@{u}')" == 'origin/codex/c21-operational-execution' ]] || { echo 'candidate upstream mismatch' >&2; return 21; }
  [[ "$(git -C "$repo" rev-parse --verify '@{u}^{commit}')" == "$control_sha" ]] || { echo 'candidate upstream HEAD mismatch' >&2; return 21; }
  [[ "$(git -C "$repo" rev-parse --verify HEAD)" == "$control_sha" ]] || { echo 'candidate local HEAD mismatch' >&2; return 21; }
  local status_raw
  status_raw="$(git -C "$repo" status --porcelain=v1 --untracked-files=all)" || { echo 'candidate Git status collection failed' >&2; return 20; }
  [[ -z "$status_raw" ]] || { echo 'candidate working tree is not clean' >&2; return 21; }
}

validate_wsl_execution_resume() {
  local repo="$1" control_sha="$2" expected="$3" checksum="${ANVIL_CANDIDATE_MANIFEST_SHA256:-}" raw payload wi_raw
  [[ "$control_sha" =~ ^[0-9a-f]{40}$ && "$expected" == "$C21_RESUME_CANDIDATE" ]] || { echo 'runtime execution blocked: exact binding missing' >&2; return 22; }
  raw="$(git -C "$repo" show "$control_sha:deploy/wsl/CandidateReleaseManifest.json")" || { echo 'runtime execution blocked: manifest missing' >&2; return 22; }
  [[ "$checksum" =~ ^[0-9a-fA-F]{64}$ && "$(printf '%s\n' "$raw" | sha256sum | cut -d' ' -f1)" == "${checksum,,}" ]] || { echo 'runtime execution blocked: manifest checksum mismatch' >&2; return 22; }
  _c21_resume_manifest_contract "$raw" || { echo 'runtime execution blocked: manifest state invalid' >&2; return 22; }
  wi_raw="$(git -C "$repo" show "$control_sha:$C21_RESUME_WI")" || { echo 'runtime execution blocked: work instruction missing' >&2; return 22; }
  [[ "$(printf '%s\n' "$wi_raw" | sha256sum | cut -d' ' -f1 | tr '[:lower:]' '[:upper:]')" == "$C21_RESUME_WI_SHA" ]] || { echo 'runtime execution blocked: work instruction checksum mismatch' >&2; return 22; }
}

validate_wsl_candidate_manifest() {
  local repo="$1" manifest_ref="$2" expected="$3" control_sha current_control
  control_sha="$(git -C "$repo" rev-parse --verify "$manifest_ref^{commit}")" || return 20
  validate_wsl_candidate_binding "$repo" "$manifest_ref" "$expected" "$control_sha" || return $?
  current_control="$(git -C "$repo" rev-parse --verify "$manifest_ref^{commit}")" || return 20
  [[ "$current_control" == "$control_sha" ]] || { echo 'control revision changed during runtime validation' >&2; return 20; }
  validate_wsl_execution_resume "$repo" "$control_sha" "$expected"
}

# seq542 exact private-authority/runtime binding. Historical definitions above
# remain visible for audit; these final definitions are the active contract.
readonly C21_EXACT_START_CONTROL='71d6747c0b713bedf1a1bc6724a5771d6ae33c60'
readonly C21_EXACT_RESUME_BOUND='3501c37b25274c2c3b406a15bc8a57aa03a162e7'
readonly C21_EXACT_OBSERVED_RUNTIME='a342d62391a44b349733d1468ac3b180761155ab'
readonly C21_EXACT_OBSERVED_PREVIOUS='324eb169fedbce958d2e8cc29362deb7af433677'
readonly C21_EXACT_RUNTIME_CONTROL_REF='refs/remotes/origin/codex/c21-operational-execution'
readonly C21_EXACT_RUNTIME_CANDIDATE_REF='refs/remotes/origin/candidates/c21-wsl-exact107'
readonly C21_EXACT_PRIVATE_URL='git@github-sinsan-develop:sinsan-develop/Anvil.git'

_c21_exact_manifest_contract() {
  local payload="$1" python_bin="${ANVIL_PYTHON:-python3}"
  command -v "$python_bin" >/dev/null || { echo 'Python 3 is required for exact candidate validation' >&2; return 20; }
  ANVIL_C21_MANIFEST="$payload" "$python_bin" - <<'PY' || return 20
import hashlib, json, os, re
def unique(pairs):
    out={}
    for key,value in pairs:
        if key in out: raise ValueError('duplicate manifest key')
        out[key]=value
    return out
def nonfinite(value): raise ValueError('nonfinite manifest value')
doc=json.loads(os.environ['ANVIL_C21_MANIFEST'], object_pairs_hook=unique, parse_constant=nonfinite)
candidate='a6dca0da5a37e64491e91813895268e78ecb78b2'
observed='a342d62391a44b349733d1468ac3b180761155ab'
previous='324eb169fedbce958d2e8cc29362deb7af433677'
private='git@github-sinsan-develop:sinsan-develop/Anvil.git'
if not isinstance(doc,dict) or doc.get('schema_version')!=1 or doc.get('manifest_type')!='WSL_STAGING_CANDIDATE': raise SystemExit(1)
if (doc.get('status'),doc.get('runtime_safety_gate'))!=('APPROVED_FOR_STAGING_VALIDATION','READY_FOR_APPROVED_WSL_QA'): raise SystemExit(1)
if doc.get('source')!={'commit':candidate,'remote_ref':'refs/remotes/origin/candidates/c21-wsl-exact107','working_tree':'CLEAN','branch':'codex/c21-operational-execution','upstream':'origin/codex/c21-operational-execution'}: raise SystemExit(1)
authority=doc.get('authority')
if not isinstance(authority,dict): raise SystemExit(1)
derived=authority.get('derived_binding'); derived_sha=authority.get('derived_binding_sha256')
if not isinstance(derived,dict) or not re.fullmatch(r'[A-F0-9]{64}',str(derived_sha)): raise SystemExit(1)
if hashlib.sha256(json.dumps(derived,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()).hexdigest().upper()!=derived_sha: raise SystemExit(1)
binding={'push_remote':'development','push_url':private,
 'control_ref':'refs/remotes/development/codex/c21-operational-execution',
 'candidate_ref':'refs/remotes/development/candidates/c21-wsl-exact107',
 'observed_control':'772afbd5eb55791ca7b5002d58378437ea496750','observed_candidate':'ABSENT',
 'control_compare_and_swap':True,'candidate_compare_and_swap':True,
 'runtime_fetch_remote':'origin','runtime_fetch_url':private,
 'runtime_control_ref':'refs/remotes/origin/codex/c21-operational-execution',
 'runtime_candidate_ref':'refs/remotes/origin/candidates/c21-wsl-exact107',
 'public_origin_is_push_authority':False}
if authority.get('exact_private_git_binding')!=binding: raise SystemExit(1)
tuples=[{'application_head':observed,'current':observed,'previous':previous},
 {'application_head':candidate,'current':candidate,'previous':previous},
 {'application_head':candidate,'current':previous,'previous':previous}]
runtime={'host':'SINSAN','application_repo':'/srv/anvil-wsl/repo','application_repo_state':'CLEAN_DETACHED',
 'application_origin':private,'observed_application_head':observed,'observed_pg15_current':observed,
 'observed_pg18rc_current':observed,'observed_previous':previous,
 'rollback_allowlist':[candidate,observed,previous],'allowed_lifecycle_tuples':tuples,
 'fail_closed_before_mutation':True}
if doc.get('runtime_binding')!=runtime: raise SystemExit(1)
if doc.get('rollback')!={'approved_commits':[candidate,observed,previous],'runtime_observation_required':True}: raise SystemExit(1)
if doc.get('environment')!={'name':'WSL_SERVER_TEST_STAGING','postgres_targets':['15','18-rc']}: raise SystemExit(1)
if doc.get('exclusions')!=['TELEGRAM_EXECUTION','PROVIDER_EXECUTION','YSNA_EXECUTION','MAIN_MERGE']: raise SystemExit(1)
PY
}

validate_c21_exact_runtime_state() {
  local root="$1" application_head="$2" target slug current previous tuple
  [[ "$application_head" =~ ^[0-9a-f]{40}$ ]] || { echo 'runtime state drift: application HEAD is malformed' >&2; return 23; }
  for target in 15 18-rc; do
    [[ "$target" == 15 ]] && slug=pg15 || slug=pg18rc
    [[ -s "$root/runtime/$slug/current.sha" && -s "$root/runtime/$slug/previous.sha" ]] || {
      echo "runtime state drift: state file missing for $target" >&2; return 23;
    }
    current="$(tr -d '\r\n' < "$root/runtime/$slug/current.sha")"
    previous="$(tr -d '\r\n' < "$root/runtime/$slug/previous.sha")"
    tuple="$application_head:$current:$previous"
    case "$tuple" in
      "$C21_EXACT_OBSERVED_RUNTIME:$C21_EXACT_OBSERVED_RUNTIME:$C21_EXACT_OBSERVED_PREVIOUS"|\
      "$C21_RESUME_CANDIDATE:$C21_RESUME_CANDIDATE:$C21_EXACT_OBSERVED_PREVIOUS"|\
      "$C21_RESUME_CANDIDATE:$C21_EXACT_OBSERVED_PREVIOUS:$C21_EXACT_OBSERVED_PREVIOUS") ;;
      *) echo "runtime state drift: unapproved lifecycle tuple for $target" >&2; return 23 ;;
    esac
  done
}

_c21_exact_image_revision_exists() {
  local revision="$1" image actual
  while IFS= read -r image; do
    [[ -n "$image" ]] || continue
    actual="$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$image" 2>/dev/null || true)"
    [[ "$actual" == "$revision" ]] && return 0
  done < <(docker image ls -q 2>/dev/null | sort -u)
  return 1
}

validate_c21_exact_runtime_images() {
  local root="$1" slug current previous revision
  declare -A required=()
  for slug in pg15 pg18rc; do
    current="$(tr -d '\r\n' < "$root/runtime/$slug/current.sha")" || return 23
    previous="$(tr -d '\r\n' < "$root/runtime/$slug/previous.sha")" || return 23
    required["$current"]=1; required["$previous"]=1
  done
  for revision in "${!required[@]}"; do
    _c21_exact_image_revision_exists "$revision" || {
      echo "runtime image drift: approved revision image missing" >&2; return 23;
    }
  done
}

validate_wsl_candidate_binding() {
  local repo="$1" manifest_ref="$2" expected="$3" pinned_control_sha="${4:-}"
  local control_sha current_control payload supplied_hash actual_hash head status_raw origin
  [[ "$manifest_ref" == "$C21_EXACT_RUNTIME_CONTROL_REF" ]] || { echo 'candidate control ref must be the exact runtime private ref' >&2; return 20; }
  [[ "$expected" == "$C21_RESUME_CANDIDATE" ]] || { echo 'candidate source must be the exact107 commit' >&2; return 20; }
  control_sha="$(git -C "$repo" rev-parse --verify "$manifest_ref^{commit}")" || return 20
  [[ -z "$pinned_control_sha" || "$control_sha" == "$pinned_control_sha" ]] || { echo 'pinned control revision mismatch' >&2; return 20; }
  [[ "$(git -C "$repo" rev-parse --verify "$C21_EXACT_RUNTIME_CANDIDATE_REF^{commit}")" == "$expected" ]] || { echo 'candidate remote ref mismatch' >&2; return 21; }
  supplied_hash="${ANVIL_CANDIDATE_MANIFEST_SHA256:?candidate manifest checksum is required}"
  [[ "$supplied_hash" =~ ^[0-9a-fA-F]{64}$ ]] || return 20
  payload="$(git -C "$repo" show "$control_sha:deploy/wsl/CandidateReleaseManifest.json")" || return 20
  actual_hash="$(printf '%s\n' "$payload" | sha256sum | cut -d' ' -f1)" || return 20
  [[ "${actual_hash,,}" == "${supplied_hash,,}" ]] || { echo 'candidate manifest checksum mismatch' >&2; return 20; }
  _c21_exact_manifest_contract "$payload" || { echo 'candidate manifest contract mismatch' >&2; return 20; }
  [[ "$(git -C "$repo" show -s --format=%P "$C21_RESUME_CANDIDATE")" == "$C21_RESUME_CANDIDATE_PARENT" ]] || return 21
  [[ "$(git -C "$repo" show -s --format=%P "$C21_RESUME_GIT_ONLY_CONTROL")" == "$C21_RESUME_CANDIDATE" ]] || return 21
  [[ "$(git -C "$repo" show -s --format=%P "$C21_RESUME_START_CONTROL")" == "$C21_RESUME_GIT_ONLY_CONTROL" ]] || return 21
  [[ "$(git -C "$repo" show -s --format=%P "$C21_EXACT_RESUME_BOUND")" == "$C21_RESUME_START_CONTROL" ]] || return 21
  [[ "$(git -C "$repo" show -s --format=%P "$C21_EXACT_START_CONTROL")" == "$C21_EXACT_RESUME_BOUND" ]] || return 21
  [[ "$(git -C "$repo" show -s --format=%P "$control_sha")" == "$C21_EXACT_START_CONTROL" ]] || { echo 'exact control must be a single direct child' >&2; return 21; }
  _c21_resume_assert_paths candidate "$repo" "$control_sha" 10 87A153B8CF5F7B1C8A4B4CDD1589369164D7B7B7849971DC3E4D10EFFA7707D2 || return $?
  _c21_resume_assert_paths git-only "$repo" "$control_sha" 12 6DE878D2FD387431D2869BD5A0F070862B48727391F7F44D6D1FEEF983702765 || return $?
  _c21_resume_assert_paths start "$repo" "$control_sha" 10 0FCFCE1A57E7A806B9E94B495DBE7CF3AEFD720FB6B8ACFF029DA0CEBB7EA070 || return $?
  _c21_resume_assert_paths bound "$repo" "$C21_EXACT_RESUME_BOUND" 14 3A67A5443BBCD92B125E5168442B5EB46A1FBA4EA0A9AE061411FB655921C09B || return $?
  local paths
  paths="$(git -C "$repo" diff --name-only "$C21_EXACT_RESUME_BOUND" "$C21_EXACT_START_CONTROL")" || return 20
  [[ "$(printf '%s\n' "$paths" | sed '/^$/d' | wc -l | tr -d ' ')" == 10 && "$(_c21_path_hash "$paths")" == '410EB4E3EB843BFF2FE9D332505445286986BE8572A288DF713E388DAF587B62' ]] || return 21
  paths="$(git -C "$repo" diff --name-only "$C21_EXACT_START_CONTROL" "$control_sha")" || return 20
  [[ "$(printf '%s\n' "$paths" | sed '/^$/d' | wc -l | tr -d ' ')" == 14 && "$(_c21_path_hash "$paths")" == 'B570C707DBEA3594C6AC57B0D44DBD0F64BBDEE26A037FC954FF03CFD78A133E' ]] || return 21
  paths="$(git -C "$repo" diff --name-only "$C21_RESUME_BASE" "$control_sha")" || return 20
  [[ "$(printf '%s\n' "$paths" | sed '/^$/d' | wc -l | tr -d ' ')" == 125 && "$(_c21_path_hash "$paths")" == 'E95EDFDE234D91C7F667B699991332E5FF3A8FDDBCDB2EADAF15087BB3501F76' ]] || return 21
  status_raw="$(git -C "$repo" status --porcelain=v1 --untracked-files=all)" || return 20
  [[ -z "$status_raw" ]] || { echo 'candidate working tree is not clean' >&2; return 21; }
  head="$(git -C "$repo" rev-parse --verify HEAD)" || return 20
  [[ "$head" == "$C21_EXACT_OBSERVED_RUNTIME" || "$head" == "$expected" || "$head" == "$control_sha" ]] || { echo 'runtime application HEAD mismatch' >&2; return 21; }
  if [[ -n "${ROOT:-}" ]]; then
    [[ -z "$(git -C "$repo" branch --show-current)" ]] || { echo 'runtime application repo must be detached' >&2; return 21; }
    origin="$(git -C "$repo" remote get-url origin)" || return 20
    [[ "$origin" == "$C21_EXACT_PRIVATE_URL" ]] || { echo 'runtime origin authority mismatch' >&2; return 21; }
  fi
  current_control="$(git -C "$repo" rev-parse --verify "$manifest_ref^{commit}")" || return 20
  [[ "$current_control" == "$control_sha" ]] || { echo 'control revision changed during binding validation' >&2; return 20; }
}

validate_wsl_execution_resume() {
  local repo="$1" control_sha="$2" expected="$3" root="${ROOT:-}"
  [[ -n "$root" ]] || return 0
  local head
  head="$(git -C "$repo" rev-parse --verify HEAD)" || return 22
  validate_c21_exact_runtime_state "$root" "$head" || return $?
  validate_c21_exact_runtime_images "$root" || return $?
}

validate_wsl_candidate_manifest() {
  local repo="$1" manifest_ref="$2" expected="$3" control_sha current_control
  control_sha="$(git -C "$repo" rev-parse --verify "$manifest_ref^{commit}")" || return 20
  validate_wsl_candidate_binding "$repo" "$manifest_ref" "$expected" "$control_sha" || return $?
  current_control="$(git -C "$repo" rev-parse --verify "$manifest_ref^{commit}")" || return 20
  [[ "$current_control" == "$control_sha" ]] || { echo 'control revision changed during runtime validation' >&2; return 20; }
  validate_wsl_execution_resume "$repo" "$control_sha" "$expected"
}
