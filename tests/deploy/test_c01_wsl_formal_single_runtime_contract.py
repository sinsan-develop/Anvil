from __future__ import annotations

import base64
from copy import deepcopy
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

import pytest


ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "deploy/wsl/formal-single-runtime.sh"
MANIFEST = ROOT / "deploy/wsl/FormalSingleRuntimeManifest.json"
CANDIDATE = "bb2ff4374c81865cab127eca14d3d4c9de575465"
PRIOR = "7b7e7cc0269b22115fd4ffe82bbe1f847e05f2bd"
CONTROL_PATHS = {
    "deploy/wsl/formal-single-runtime.sh",
    "deploy/wsl/FormalSingleRuntimeManifest.json",
    "tests/deploy/test_c01_wsl_formal_single_runtime_contract.py",
    "docs/work_orders/C-01_WSL_FORMAL_SINGLE_RUNTIME_WORK_INSTRUCTION.md",
    "docs/04_test_reports/C-01_WSL_FORMAL_SINGLE_RUNTIME_IMPLEMENTATION.md",
}


def _script() -> str:
    return SCRIPT.read_text(encoding="utf-8")


def _manifest() -> dict:
    return json.loads(MANIFEST.read_text(encoding="utf-8"))


def _validator() -> str:
    source = _script()
    begin = source.index("# C01_MANIFEST_VALIDATOR_BEGIN\n") + len("# C01_MANIFEST_VALIDATOR_BEGIN\n")
    end = source.index("# C01_MANIFEST_VALIDATOR_END\n")
    return source[begin:end]


def _validate(tmp_path: Path, payload: dict) -> subprocess.CompletedProcess[str]:
    path = tmp_path / "manifest.json"
    path.write_text(json.dumps(payload), encoding="utf-8")
    return subprocess.run(
        [sys.executable, "-c", _validator(), str(path), CANDIDATE],
        cwd=ROOT, text=True, capture_output=True, check=False,
    )


def test_manifest_binds_exact_candidate_prior_runtime_and_control_paths(tmp_path: Path):
    payload = _manifest()
    assert payload["status"] == "APPROVED_CONTROL_CONTRACT"
    assert payload["source"] == {
        "commit": CANDIDATE,
        "parent": "fd3c89665629addd78e74c2fe946fb9dfc893c36",
        "remote_url": "git@github-sinsan-develop:sinsan-develop/Anvil.git",
        "remote_ref": "refs/remotes/origin/candidates/c01-step-execution-bb2ff43",
        "checkout": "/srv/anvil-wsl/repo",
        "working_tree": "CLEAN_DETACHED",
    }
    assert payload["prior_runtime"]["oci_revision"] == PRIOR
    assert payload["runtime"]["resource_inventory"] == {
        "owner_name_pattern": "^anvil([-_]|$)",
        "formal_container_exclusion": "anvil-web",
        "required_initial_state": "NO_ADDITIONAL_ANVIL_RESOURCES",
        "shared_host_policy": "IGNORE_NON_ANVIL_NAMED_RESOURCES",
    }
    assert set(payload["control"]["changed_paths"]) == CONTROL_PATHS
    assert payload["control"]["changed_path_count"] == len(CONTROL_PATHS)
    assert _validate(tmp_path, payload).returncode == 0


@pytest.mark.parametrize("mutation", [
    lambda d: d["source"].update(commit="0" * 40),
    lambda d: d["source"].update(remote_url="https://example.invalid/anvil.git"),
    lambda d: d["source"].update(remote_ref="refs/remotes/origin/main"),
    lambda d: d["source"].update(checkout="/home/daon/deploy/anvil"),
    lambda d: d["prior_runtime"].update(oci_revision="1" * 40),
    lambda d: d["runtime"].update(container_name="anvil-web-copy"),
    lambda d: d["runtime"].update(public_host="127.0.0.1"),
    lambda d: d["runtime"].update(host_port=4770),
    lambda d: d["runtime"].update(network="new-network"),
    lambda d: d["runtime"].update(extra_host="host.docker.internal:127.0.0.1"),
    lambda d: d["runtime"].update(read_only=False),
    lambda d: d["runtime"]["resource_inventory"].update(owner_name_pattern=".*"),
    lambda d: d["control"]["changed_paths"].append("deploy/wsl/deploy.sh"),
])
def test_manifest_validator_rejects_malicious_binding_changes(tmp_path: Path, mutation):
    payload = deepcopy(_manifest())
    mutation(payload)
    assert _validate(tmp_path, payload).returncode != 0


def test_script_fails_closed_on_control_git_and_existing_runtime_drift():
    source = _script()
    required = (
        "git branch --show-current", "status --porcelain=v1 --untracked-files=all",
        "git show -s --format=%P", "git diff --name-only",
        "refs/remotes/origin/candidates/c01-step-execution-bb2ff43",
        "docker ps -aq --filter name=^/anvil-web$", "7b7e7cc0269b22115fd4ffe82bbe1f847e05f2bd",
        "HostPort", "3770", "proxy-network", "host.docker.internal:host-gateway",
        "RestartPolicy", "unless-stopped",
    )
    for marker in required:
        assert marker in source


def test_script_preserves_only_allowlisted_env_and_always_removes_temp():
    source, payload = _script(), _manifest()
    allowlist = payload["runtime"]["environment_allowlist"]
    assert allowlist and len(allowlist) == len(set(allowlist))
    assert "ANVIL_TEST_SESSION_PERMISSION_SCOPES" in allowlist
    assert set(allowlist) == {
        "ANVIL_AUTH_MODE", "ANVIL_CONSOLE_BASE_URL", "ANVIL_DATABASE_URL",
        "ANVIL_PUBLIC_HOST", "ANVIL_RUNTIME_ENVIRONMENT", "ANVIL_TEST_SESSION_ACTOR_ID",
        "ANVIL_TEST_SESSION_BOOTSTRAP_TOKEN", "ANVIL_TEST_SESSION_ENVIRONMENT_ID",
        "ANVIL_TEST_SESSION_PERMISSION_SCOPES", "ANVIL_TEST_SESSION_PROJECT_ID",
        "ANVIL_TEST_SESSION_RUN_IDS", "TELEGRAM_ALLOWED_IDENTITIES",
        "TELEGRAM_INTERNAL_SIGNING_SECRET", "TELEGRAM_WEBHOOK_SECRET",
    }
    assert payload["runtime"]["environment_source"] == "EXISTING_ANVIL_WEB_CONFIG_EXACT_ALLOWLIST"
    assert "run:execute" not in source
    assert "mktemp" in source and "chmod 600" in source
    assert "trap cleanup EXIT" in source
    assert "trap 'exit 130' HUP INT TERM" in source
    assert 'rm -f -- "$ENV_TEMP"' in source
    assert "set -x" not in source and "cat /srv/anvil-wsl/.env" not in source


def test_replacement_and_rollback_use_only_the_exact_runtime_container_shape():
    source = _script()
    replacement = source[source.index("start_candidate()") : source.index("verify_candidate()")]
    rollback = source[source.index("start_prior()") : source.index("cleanup()")]
    for shape in (replacement, rollback):
        for marker in (
            "--name anvil-web", "--env-file \"$ENV_TEMP\"", "--publish 3770:3770",
            "--network proxy-network", "--add-host host.docker.internal:host-gateway",
            "--restart unless-stopped",
        ):
            assert marker in shape
    for marker in ("--init", "--read-only", "--cap-drop ALL", "--security-opt no-new-privileges",
                   "--tmpfs /tmp:rw,noexec,nosuid,size=32m", "--health-cmd"):
        assert marker in replacement
    assert "--read-only" not in rollback and "--health-cmd" not in rollback
    assert "anvil-web:$CANDIDATE" in replacement
    assert "anvil-web:$PRIOR" in rollback


def test_script_cannot_create_extra_containers_networks_volumes_or_migrations():
    source = _script()
    forbidden = (
        "docker compose", "docker-compose", "docker network create", "docker volume create",
        "alembic upgrade", "alembic downgrade", "anvil-db", "anvil-ingress",
        "/home/daon/deploy/anvil", "/integrations/telegram", "/api/providers/",
    )
    for marker in forbidden:
        assert marker not in source
    assert "unchanged_non_runtime_containers" in source
    assert "unchanged_networks_and_volumes" in source
    assert source.count("/^anvil([-_]|$)/") >= 5


def test_success_verifies_exact_runtime_security_and_read_only_http_contract():
    source = _script()
    for marker in (
        "container_count", "org.opencontainers.image.revision", "ReadonlyRootfs",
        "CapDrop", "SecurityOpt", "Health", "/health/live", "/health/ready",
        "0013_task_bootstrap_authority", "/provider-workbench.html", "/openapi.json",
        "/api/runs/{id}/steps/{stepId}:execute", "/auth/session/status",
    ):
        assert marker in source


def test_auth_status_probe_uses_manifest_bound_public_host_header():
    source, payload = _script(), _manifest()
    assert payload["runtime"]["public_host"] == "172.27.253.53"
    assert 'PUBLIC_HOST="$(python3 -c' in source
    assert '--header "Host: ${PUBLIC_HOST}:3770" http://127.0.0.1:3770/auth/session/status' in source


def test_main_sequence_is_exact_git_build_replace_verify_without_migration_or_extra_runtime():
    source = _script()
    markers = (
        'remote get-url origin', 'fetch --no-tags origin "$PRIVATE_FETCH_REF"',
        'checkout --detach "$CANDIDATE"', 'diff --name-only "$CANDIDATE_PARENT" "$CANDIDATE"',
        'docker build --pull=false', 'deploy/ysna/Dockerfile.web',
        'remove_runtime_for_exact_replacement', 'start_candidate',
        'verify_candidate\nSUCCESS=1', '"extra_runtime_resources":0',
    )
    for marker in markers:
        assert marker in source
    assert source.index('docker build --pull=false') < source.index('remove_runtime_for_exact_replacement\nstart_candidate')


def test_embedded_validator_is_hidden_from_bash_parser():
    source = _script()
    assert ": <<'C01_MANIFEST_VALIDATOR_BODY'" in source
    assert source.count("C01_MANIFEST_VALIDATOR_BODY") == 2


def test_runtime_verification_failures_cannot_be_masked_by_bash_errexit_context():
    source = _script()
    common = source[source.index("verify_common_runtime()") : source.index("start_candidate()")]
    candidate = source[source.index("verify_candidate()") : source.index("start_prior()")]
    assert "verify_candidate || fail" not in source
    assert "verify_common_runtime || return 1" in candidate
    assert candidate.count("|| return 1") >= 10
    assert common.count("|| return 1") >= 2
    assert "verify_candidate\nSUCCESS=1" in source


def test_secret_temp_directory_rejects_symlink_and_group_or_other_writes():
    source = _script()
    assert '[[ ! -L /srv/anvil-wsl/runtime ]]' in source
    assert 'RUNTIME_DIR_MODE="$(stat -c \'%a\' /srv/anvil-wsl/runtime)"' in source
    assert '8#$RUNTIME_DIR_MODE & 0022' in source


def test_checkout_rollback_intent_is_set_before_candidate_checkout():
    source = _script()
    intent = source.index("CHECKOUT_CHANGED=1")
    checkout = source.index('git -C "$APP_CHECKOUT" checkout --detach "$CANDIDATE"')
    assert intent < checkout


def test_all_http_probes_have_connect_and_total_timeouts():
    source = _script()
    candidate = source[source.index("verify_candidate()") : source.index("start_prior()")]
    curl_lines = [line for line in candidate.splitlines() if line.lstrip().startswith("curl ")]
    assert len(curl_lines) == 6
    for line in curl_lines:
        assert "--connect-timeout 2" in line
        assert "--max-time 10" in line


def test_candidate_verification_semantically_rejects_every_injected_stage_failure():
    source = _script()
    candidate_function = source[
        source.index("verify_candidate() {") : source.index("start_prior() {")
    ]
    cases = (
        "success", "common", "revision-command", "revision-value", "hardening",
        "health-command", "health-unhealthy", "health-timeout", "live", "ready",
        "root", "workbench", "openapi", "auth", "other-containers", "networks",
    )
    harness = f"""
set -euo pipefail
CANDIDATE={CANDIDATE}
CONTAINER=anvil-web
PUBLIC_HOST=172.27.253.53
verify_common_runtime() {{ [[ "$CASE" != common ]]; }}
unchanged_non_runtime_containers() {{ [[ "$CASE" != other-containers ]]; }}
unchanged_networks_and_volumes() {{ [[ "$CASE" != networks ]]; }}
sleep() {{ :; }}
seq() {{ printf '1\\n'; }}
docker() {{
  if [[ "$*" == *org.opencontainers.image.revision* ]]; then
    [[ "$CASE" != revision-command ]] || return 1
    if [[ "$CASE" == revision-value ]]; then printf 'wrong-revision\\n'; else printf '%s\\n' "$CANDIDATE"; fi
  elif [[ "$*" == *State.Health* ]]; then
    [[ "$CASE" != health-command ]] || return 1
    case "$CASE" in
      health-unhealthy) printf 'unhealthy\\n' ;;
      health-timeout) printf 'starting\\n' ;;
      *) printf 'healthy\\n' ;;
    esac
  else
    printf '{{}}\\n'
  fi
}}
curl() {{
  local url="${{@: -1}}"
  case "$CASE:$url" in
    live:*/health/live|ready:*/health/ready|root:*/|workbench:*/provider-workbench.html|openapi:*/openapi.json|auth:*/auth/session/status) return 1 ;;
  esac
  if [[ "$url" == */auth/session/status && "$*" != *"Host: ${{PUBLIC_HOST}}:3770"* ]]; then return 1; fi
  [[ "$*" == *'--output /dev/null'* ]] || printf '{{}}\\n'
  return 0
}}
python3() {{
  local data
  data=$(</dev/stdin)
  [[ "$CASE" != hardening || "$*" != *ReadonlyRootfs* ]]
}}
{candidate_function}
for CASE in {' '.join(cases)}; do
  if verify_candidate; then result=ACCEPT; else result=REJECT; fi
  printf '%s=%s\\n' "$CASE" "$result"
done
"""
    if os.name == "nt":
        if shutil.which("wsl") is None:
            pytest.skip("WSL bash is unavailable")
        encoded = base64.b64encode(harness.encode("utf-8")).decode("ascii")
        command = [
            "wsl", "-d", "Ubuntu", "--", "bash", "-c",
            f"printf '%s' '{encoded}' | base64 --decode | bash",
        ]
    else:
        bash = shutil.which("bash")
        if bash is None:
            pytest.skip("bash is unavailable")
        command = [bash, "-c", harness]
    result = subprocess.run(
        command, cwd=ROOT, text=True, encoding="utf-8", capture_output=True,
        timeout=10, check=False,
    )
    assert result.returncode == 0, result.stderr
    observed = dict(line.split("=", 1) for line in result.stdout.splitlines())
    assert observed == {case: "ACCEPT" if case == "success" else "REJECT" for case in cases}


def test_inventory_snapshot_requires_no_additional_anvil_owned_resources():
    source = _script()
    snapshot_function = source[
        source.index("snapshot_inventories() {") : source.index("unchanged_non_runtime_containers() {")
    ]
    cases = (
        "success",
        "unrelated",
        "anvil-container",
        "anvil-network",
        "anvil-volume",
        "containers-command",
        "networks-command",
        "volumes-command",
    )
    harness = f"""
set -euo pipefail
BASE_CONTAINERS=''
BASE_NETWORKS=''
BASE_VOLUMES=''
docker() {{
  case "$CASE:$1:${{2:-}}" in
    containers-command:ps:-a|networks-command:network:ls|volumes-command:volume:ls) return 23 ;;
  esac
  if [[ "$1:${{2:-}}" == ps:-a ]]; then
    [[ "$CASE" == unrelated ]] && printf 'daon2-temp\\n'
    [[ "$CASE" == anvil-container ]] && printf 'anvil-extra\\n'
  elif [[ "$1:${{2:-}}" == network:ls ]]; then
    [[ "$CASE" == unrelated ]] && printf 'daon2-net\\n'
    [[ "$CASE" == anvil-network ]] && printf 'anvil-extra-net\\n'
  elif [[ "$1:${{2:-}}" == volume:ls ]]; then
    [[ "$CASE" == unrelated ]] && printf 'daon2-volume\\n'
    [[ "$CASE" == anvil-volume ]] && printf 'anvil-extra-volume\\n'
  fi
  return 0
}}
{snapshot_function}
for CASE in {' '.join(cases)}; do
  if snapshot_inventories; then result=ACCEPT; else result=REJECT; fi
  printf '%s=%s\\n' "$CASE" "$result"
done
"""
    if os.name == "nt":
        if shutil.which("wsl") is None:
            pytest.skip("WSL bash is unavailable")
        encoded = base64.b64encode(harness.encode("utf-8")).decode("ascii")
        command = [
            "wsl", "-d", "Ubuntu", "--", "bash", "-c",
            f"printf '%s' '{encoded}' | base64 --decode | bash",
        ]
    else:
        bash = shutil.which("bash")
        if bash is None:
            pytest.skip("bash is unavailable")
        command = [bash, "-c", harness]
    result = subprocess.run(
        command, cwd=ROOT, text=True, encoding="utf-8", capture_output=True,
        timeout=10, check=False,
    )
    assert result.returncode == 0, result.stderr
    observed = dict(line.split("=", 1) for line in result.stdout.splitlines())
    assert observed == {
        case: "ACCEPT" if case in {"success", "unrelated"} else "REJECT"
        for case in cases
    }


def test_inventory_helpers_scope_invariants_to_anvil_owned_resources():
    source = _script()
    inventory_functions = source[
        source.index("unchanged_non_runtime_containers() {") : source.index("verify_common_runtime() {")
    ]
    cases = (
        "success",
        "unrelated",
        "anvil-container",
        "anvil-network",
        "anvil-volume",
        "containers-command",
        "networks-command",
        "volumes-command",
    )
    harness = f"""
set -euo pipefail
BASE_CONTAINERS=''
BASE_NETWORKS=''
BASE_VOLUMES=''
docker() {{
  case "$CASE:$1:${{2:-}}" in
    containers-command:ps:-a|networks-command:network:ls|volumes-command:volume:ls) return 23 ;;
  esac
  if [[ "$1:${{2:-}}" == ps:-a ]]; then
    [[ "$CASE" == unrelated ]] && printf 'daon2-temp\\n'
    [[ "$CASE" == anvil-container ]] && printf 'anvil-extra\\n'
  elif [[ "$1:${{2:-}}" == network:ls ]]; then
    [[ "$CASE" == unrelated ]] && printf 'daon2-net\\n'
    [[ "$CASE" == anvil-network ]] && printf 'anvil-extra-net\\n'
  elif [[ "$1:${{2:-}}" == volume:ls ]]; then
    [[ "$CASE" == unrelated ]] && printf 'daon2-volume\\n'
    [[ "$CASE" == anvil-volume ]] && printf 'anvil-extra-volume\\n'
  fi
  return 0
}}
{inventory_functions}
for CASE in {' '.join(cases)}; do
  if unchanged_non_runtime_containers && unchanged_networks_and_volumes; then result=ACCEPT; else result=REJECT; fi
  printf '%s=%s\\n' "$CASE" "$result"
done
"""
    if os.name == "nt":
        if shutil.which("wsl") is None:
            pytest.skip("WSL bash is unavailable")
        encoded = base64.b64encode(harness.encode("utf-8")).decode("ascii")
        command = [
            "wsl", "-d", "Ubuntu", "--", "bash", "-c",
            f"printf '%s' '{encoded}' | base64 --decode | bash",
        ]
    else:
        bash = shutil.which("bash")
        if bash is None:
            pytest.skip("bash is unavailable")
        command = [bash, "-c", harness]
    result = subprocess.run(
        command, cwd=ROOT, text=True, encoding="utf-8", capture_output=True,
        timeout=10, check=False,
    )
    assert result.returncode == 0, result.stderr
    observed = dict(line.split("=", 1) for line in result.stdout.splitlines())
    assert observed == {
        case: "ACCEPT" if case in {"success", "unrelated"} else "REJECT"
        for case in cases
    }


def test_common_runtime_accepts_only_equivalent_public_port_bindings():
    source = _script()
    common_function = source[
        source.index("verify_common_runtime() {") : source.index("start_candidate() {")
    ]
    cases = (
        "empty-host", "explicit-any", "loopback", "wrong-port",
        "effective-loopback", "effective-missing",
    )
    harness = f"""
set -euo pipefail
CONTAINER=anvil-web
docker() {{
  if [[ "$1" == ps ]]; then
    printf 'container-id\\n'
    return 0
  fi
  local host_ip='' host_port=3770
  local resolved='[{{"HostIp":"0.0.0.0","HostPort":"3770"}},{{"HostIp":"::","HostPort":"3770"}}]'
  [[ "$CASE" == explicit-any ]] && host_ip=0.0.0.0
  [[ "$CASE" == loopback ]] && host_ip=127.0.0.1
  [[ "$CASE" == wrong-port ]] && host_port=4770
  [[ "$CASE" == effective-loopback ]] && resolved='[{{"HostIp":"127.0.0.1","HostPort":"3770"}}]'
  [[ "$CASE" == effective-missing ]] && resolved=null
  printf '[{{"Name":"/anvil-web","State":{{"Running":true}},"HostConfig":{{"PortBindings":{{"3770/tcp":[{{"HostIp":"%s","HostPort":"%s"}}]}},"ExtraHosts":["host.docker.internal:host-gateway"],"RestartPolicy":{{"Name":"unless-stopped"}}}},"NetworkSettings":{{"Networks":{{"proxy-network":{{}}}},"Ports":{{"3770/tcp":%s}}}}}}]\\n' "$host_ip" "$host_port" "$resolved"
}}
{common_function}
for CASE in {' '.join(cases)}; do
  if verify_common_runtime; then result=ACCEPT; else result=REJECT; fi
  printf '%s=%s\\n' "$CASE" "$result"
done
"""
    if os.name == "nt":
        if shutil.which("wsl") is None:
            pytest.skip("WSL bash is unavailable")
        encoded = base64.b64encode(harness.encode("utf-8")).decode("ascii")
        command = [
            "wsl", "-d", "Ubuntu", "--", "bash", "-c",
            f"printf '%s' '{encoded}' | base64 --decode | bash",
        ]
    else:
        bash = shutil.which("bash")
        if bash is None:
            pytest.skip("bash is unavailable")
        command = [bash, "-c", harness]
    result = subprocess.run(
        command, cwd=ROOT, text=True, encoding="utf-8", capture_output=True,
        timeout=10, check=False,
    )
    assert result.returncode == 0, result.stderr
    observed = dict(line.split("=", 1) for line in result.stdout.splitlines())
    assert observed == {
        "empty-host": "ACCEPT", "explicit-any": "ACCEPT",
        "loopback": "REJECT", "wrong-port": "REJECT",
        "effective-loopback": "REJECT", "effective-missing": "REJECT",
    }
