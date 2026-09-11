#!/usr/bin/env bash
set -euo pipefail

CANDIDATE="bb2ff4374c81865cab127eca14d3d4c9de575465"
CANDIDATE_PARENT="fd3c89665629addd78e74c2fe946fb9dfc893c36"
PRIOR="7b7e7cc0269b22115fd4ffe82bbe1f847e05f2bd"
PRIVATE_REMOTE_URL="git@github-sinsan-develop:sinsan-develop/Anvil.git"
PRIVATE_REMOTE_REF="refs/remotes/origin/candidates/c01-step-execution-bb2ff43"
PRIVATE_FETCH_REF="+refs/heads/candidates/c01-step-execution-bb2ff43:$PRIVATE_REMOTE_REF"
APP_CHECKOUT="/srv/anvil-wsl/repo"
CONTAINER="anvil-web"
NETWORK="proxy-network"
CONTROL_COMMIT="${1:-}"
EXECUTION_CONFIRMATION="${2:-}"

fail() {
  printf 'C01 formal runtime control failed: %s\n' "$1" >&2
  exit 1
}

for command_name in git docker python3 curl mktemp stat sort sed awk wc seq; do
  command -v "$command_name" >/dev/null 2>&1 || fail "required command unavailable: $command_name"
done
[[ "$EUID" -eq 0 ]] || fail "must run as root"
[[ "$CONTROL_COMMIT" =~ ^[0-9a-f]{40}$ ]] || fail "first argument must be the exact control commit"
[[ "$EXECUTION_CONFIRMATION" == "REPLACE-EXACT-ANVIL-WEB" ]] || fail "explicit replacement confirmation missing"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
CONTROL_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"
cd "$CONTROL_ROOT"
[[ -z "$(git branch --show-current)" ]] || fail "control checkout must be detached"
[[ -z "$(git status --porcelain=v1 --untracked-files=all)" ]] || fail "control checkout must be clean"
CONTROL_HEAD="$(git rev-parse HEAD)"
[[ "$CONTROL_HEAD" == "$CONTROL_COMMIT" ]] || fail "control argument does not equal detached HEAD"
[[ "$(git show -s --format=%P "$CONTROL_HEAD")" == "$CANDIDATE" ]] || fail "control commit is not a single child of candidate"

MANIFEST="$CONTROL_ROOT/deploy/wsl/FormalSingleRuntimeManifest.json"
[[ -f "$MANIFEST" ]] || fail "formal manifest missing"
MANIFEST_VALIDATOR="$(sed -n '/^# C01_MANIFEST_VALIDATOR_BEGIN$/,/^# C01_MANIFEST_VALIDATOR_END$/p' "$0" | sed '1d;$d')"
: <<'C01_MANIFEST_VALIDATOR_BODY'
# C01_MANIFEST_VALIDATOR_BEGIN
import json
import sys

manifest_path, candidate_arg = sys.argv[1:3]
with open(manifest_path, encoding="utf-8") as handle:
    data = json.load(handle)

candidate = "bb2ff4374c81865cab127eca14d3d4c9de575465"
prior = "7b7e7cc0269b22115fd4ffe82bbe1f847e05f2bd"
candidate_paths = [
    "packages/api/fastapi_app.py",
    "packages/api/registry.py",
    "packages/api/runtime.py",
    "packages/api/step_execution.py",
    "packages/events/reducer.py",
    "packages/events/transition_guard.py",
    "packages/persistence/event_repository.py",
    "packages/persistence/intervention_budget_repository.py",
    "tests/api/test_c01_step_execution.py",
    "tests/api/test_runtime_app.py",
    "tests/events/test_event_store.py",
    "tests/persistence/test_c01_step_execution_postgres.py",
    "tests/verification/test_c01_l3_independent_acceptance.py",
]
control_paths = [
    "deploy/wsl/FormalSingleRuntimeManifest.json",
    "deploy/wsl/formal-single-runtime.sh",
    "docs/04_test_reports/C-01_WSL_FORMAL_SINGLE_RUNTIME_IMPLEMENTATION.md",
    "docs/work_orders/C-01_WSL_FORMAL_SINGLE_RUNTIME_WORK_INSTRUCTION.md",
    "tests/deploy/test_c01_wsl_formal_single_runtime_contract.py",
]
allowlist = [
    "ANVIL_AUTH_MODE", "ANVIL_CONSOLE_BASE_URL", "ANVIL_DATABASE_URL", "ANVIL_PUBLIC_HOST",
    "ANVIL_RUNTIME_ENVIRONMENT", "ANVIL_TEST_SESSION_ACTOR_ID",
    "ANVIL_TEST_SESSION_BOOTSTRAP_TOKEN", "ANVIL_TEST_SESSION_ENVIRONMENT_ID",
    "ANVIL_TEST_SESSION_PERMISSION_SCOPES", "ANVIL_TEST_SESSION_PROJECT_ID",
    "ANVIL_TEST_SESSION_RUN_IDS", "TELEGRAM_ALLOWED_IDENTITIES",
    "TELEGRAM_INTERNAL_SIGNING_SECRET", "TELEGRAM_WEBHOOK_SECRET",
]

def require(condition, message):
    if not condition:
        raise SystemExit(message)

require(candidate_arg == candidate, "candidate argument mismatch")
require(data.get("schema_version") == 1, "schema mismatch")
require(data.get("manifest_type") == "C01_WSL_FORMAL_SINGLE_RUNTIME_CONTROL", "type mismatch")
require(data.get("status") == "APPROVED_CONTROL_CONTRACT", "status mismatch")
require(data.get("source") == {
    "commit": candidate,
    "parent": "fd3c89665629addd78e74c2fe946fb9dfc893c36",
    "remote_url": "git@github-sinsan-develop:sinsan-develop/Anvil.git",
    "remote_ref": "refs/remotes/origin/candidates/c01-step-execution-bb2ff43",
    "checkout": "/srv/anvil-wsl/repo",
    "working_tree": "CLEAN_DETACHED",
}, "source binding mismatch")
require(data.get("candidate_changed_paths") == candidate_paths, "candidate path binding mismatch")
require(data.get("prior_runtime") == {
    "oci_revision": prior,
    "observed_container_id_prefix": "cb9ba3c39bc7",
    "observed_read_only": False,
    "observed_healthcheck": "ABSENT",
    "security_delta": "HARDEN_REPLACEMENT_ONLY",
}, "prior runtime binding mismatch")
runtime = data.get("runtime", {})
require(runtime.get("container_name") == "anvil-web", "container mismatch")
require(runtime.get("public_host") == "172.27.253.53", "public host mismatch")
require(runtime.get("host_port") == 3770 and runtime.get("container_port") == 3770, "port mismatch")
require(runtime.get("network") == "proxy-network", "network mismatch")
require(runtime.get("extra_host") == "host.docker.internal:host-gateway", "extra-host mismatch")
require(runtime.get("restart") == "unless-stopped", "restart mismatch")
require(runtime.get("init") is True and runtime.get("read_only") is True, "security mode mismatch")
require(runtime.get("cap_drop") == ["ALL"], "cap-drop mismatch")
require(runtime.get("security_opt") == ["no-new-privileges"], "security-opt mismatch")
require(runtime.get("tmpfs") == "/tmp:rw,noexec,nosuid,size=32m", "tmpfs mismatch")
require(runtime.get("healthcheck") == {
    "command": "/opt/venv/bin/python -c \"import urllib.request; urllib.request.urlopen('http://127.0.0.1:3770/health/live', timeout=2)\"",
    "interval_seconds": 15, "timeout_seconds": 5, "retries": 4, "start_period_seconds": 10,
}, "healthcheck mismatch")
require(runtime.get("environment_source") == "EXISTING_ANVIL_WEB_CONFIG_EXACT_ALLOWLIST", "environment source mismatch")
require(runtime.get("temporary_environment_pattern") == "/srv/anvil-wsl/runtime/c01-formal-env.XXXXXX", "temporary environment pattern mismatch")
require(runtime.get("environment_allowlist") == allowlist, "environment allowlist mismatch")
require(runtime.get("permission_scope_policy") == "PRESERVE_EXACT_NO_ADDITION", "permission policy mismatch")
require(runtime.get("resource_inventory") == {
    "owner_name_pattern": "^anvil([-_]|$)",
    "formal_container_exclusion": "anvil-web",
    "required_initial_state": "NO_ADDITIONAL_ANVIL_RESOURCES",
    "shared_host_policy": "IGNORE_NON_ANVIL_NAMED_RESOURCES",
}, "resource inventory policy mismatch")
control = data.get("control", {})
require(control.get("binding") == "RUNTIME_ARGUMENT_EQUALS_DETACHED_HEAD", "control binding mismatch")
require(control.get("candidate_parent") == candidate, "control parent mismatch")
require(control.get("changed_path_count") == 5, "control path count mismatch")
require(control.get("changed_paths") == control_paths, "control path binding mismatch")
require(data.get("exclusions") == [
    "DATABASE_WRITES", "MIGRATION_CONTAINERS", "PROVIDER_CALLS", "TELEGRAM_CALLS",
    "ENV_FILE_EDITS", "EXTRA_CONTAINERS_NETWORKS_OR_VOLUMES",
    "LEGACY_C21_CONTROL_CHANGES", "PROTECTED_DEPLOYMENT_PATHS",
], "exclusion binding mismatch")
# C01_MANIFEST_VALIDATOR_END
C01_MANIFEST_VALIDATOR_BODY

python3 -c "$MANIFEST_VALIDATOR" "$MANIFEST" "$CANDIDATE" || fail "manifest validation failed"
mapfile -t EXPECTED_CONTROL_PATHS < <(python3 -c 'import json,sys; print("\n".join(sorted(json.load(open(sys.argv[1], encoding="utf-8"))["control"]["changed_paths"])))' "$MANIFEST")
mapfile -t ACTUAL_CONTROL_PATHS < <(git diff --name-only "$CANDIDATE" "$CONTROL_HEAD" | sort)
[[ "${EXPECTED_CONTROL_PATHS[*]}" == "${ACTUAL_CONTROL_PATHS[*]}" ]] || fail "control changed path set mismatch"

container_count="$(docker ps -aq --filter name=^/anvil-web$ | sed '/^$/d' | wc -l | tr -d ' ')"
[[ "$container_count" == "1" ]] || fail "formal runtime container count is not one"
[[ "$(docker ps -q --filter name=^/anvil-web$ | sed '/^$/d' | wc -l | tr -d ' ')" == "1" ]] || fail "formal runtime is not running"
[[ "$(docker image inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "anvil-web:$PRIOR")" == "$PRIOR" ]] || fail "prior image revision mismatch"
CURRENT_IMAGE_ID="$(docker inspect --format '{{.Image}}' "$CONTAINER")"
PRIOR_IMAGE_ID="$(docker image inspect --format '{{.Id}}' "anvil-web:$PRIOR")"
[[ "$CURRENT_IMAGE_ID" == "$PRIOR_IMAGE_ID" ]] || fail "current container is not the exact prior image"
docker inspect "$CONTAINER" | python3 -c '
import json, sys
c = json.load(sys.stdin)[0]
def need(ok, message):
    if not ok: raise SystemExit(message)
need(c["Name"] == "/anvil-web", "name drift")
need(c["State"]["Running"] is True, "runtime stopped")
bindings = c["HostConfig"].get("PortBindings") or {}
need(set(bindings) == {"3770/tcp"} and len(bindings["3770/tcp"]) == 1, "port drift")
binding = bindings["3770/tcp"][0]
need(binding.get("HostIp") in ("", "0.0.0.0") and binding.get("HostPort") == "3770", "port drift")
resolved = c["NetworkSettings"].get("Ports") or {}
need(set(resolved) == {"3770/tcp"} and isinstance(resolved["3770/tcp"], list), "resolved port drift")
resolved_bindings = resolved["3770/tcp"]
need(any(item.get("HostIp") == "0.0.0.0" and item.get("HostPort") == "3770" for item in resolved_bindings), "public IPv4 binding missing")
need(all(item.get("HostIp") in ("0.0.0.0", "::") and item.get("HostPort") == "3770" for item in resolved_bindings), "resolved port is not public")
need(set(c["NetworkSettings"]["Networks"]) == {"proxy-network"}, "network drift")
need(c["HostConfig"].get("ExtraHosts") == ["host.docker.internal:host-gateway"], "extra-host drift")
need(c["HostConfig"]["RestartPolicy"].get("Name") == "unless-stopped", "restart drift")
' || fail "existing runtime config mismatch"

ENV_TEMP=""
PUBLIC_HOST=""
ROLLBACK_REQUIRED=0
CHECKOUT_CHANGED=0
SUCCESS=0
BASE_CONTAINERS=""
BASE_NETWORKS=""
BASE_VOLUMES=""

snapshot_inventories() {
  BASE_CONTAINERS="$(docker ps -a --format '{{.Names}}' | awk '$1 ~ /^anvil([-_]|$)/ && $1 != "anvil-web" {print $1}' | sort)" || return 1
  BASE_NETWORKS="$(docker network ls --format '{{.Name}}' | awk '$1 ~ /^anvil([-_]|$)/ {print $1}' | sort)" || return 1
  BASE_VOLUMES="$(docker volume ls --format '{{.Name}}' | awk '$1 ~ /^anvil([-_]|$)/ {print $1}' | sort)" || return 1
  [[ -z "$BASE_CONTAINERS" && -z "$BASE_NETWORKS" && -z "$BASE_VOLUMES" ]]
}

unchanged_non_runtime_containers() {
  local current
  current="$(docker ps -a --format '{{.Names}}' | awk '$1 ~ /^anvil([-_]|$)/ && $1 != "anvil-web" {print $1}' | sort)" || return 1
  [[ "$current" == "$BASE_CONTAINERS" ]]
}

unchanged_networks_and_volumes() {
  local current_networks current_volumes
  current_networks="$(docker network ls --format '{{.Name}}' | awk '$1 ~ /^anvil([-_]|$)/ {print $1}' | sort)" || return 1
  current_volumes="$(docker volume ls --format '{{.Name}}' | awk '$1 ~ /^anvil([-_]|$)/ {print $1}' | sort)" || return 1
  [[ "$current_networks" == "$BASE_NETWORKS" && "$current_volumes" == "$BASE_VOLUMES" ]]
}

verify_common_runtime() {
  [[ "$(docker ps -aq --filter name=^/anvil-web$ | sed '/^$/d' | wc -l | tr -d ' ')" == "1" ]] || return 1
  docker inspect "$CONTAINER" | python3 -c '
import json, sys
c = json.load(sys.stdin)[0]
def need(ok, message):
    if not ok: raise SystemExit(message)
need(c["Name"] == "/anvil-web", "name mismatch")
need(c["State"]["Running"] is True, "not running")
bindings = c["HostConfig"].get("PortBindings") or {}
need(set(bindings) == {"3770/tcp"} and len(bindings["3770/tcp"]) == 1, "port mismatch")
binding = bindings["3770/tcp"][0]
need(binding.get("HostIp") in ("", "0.0.0.0") and binding.get("HostPort") == "3770", "port mismatch")
resolved = c["NetworkSettings"].get("Ports") or {}
need(set(resolved) == {"3770/tcp"} and isinstance(resolved["3770/tcp"], list), "resolved port mismatch")
resolved_bindings = resolved["3770/tcp"]
need(any(item.get("HostIp") == "0.0.0.0" and item.get("HostPort") == "3770" for item in resolved_bindings), "public IPv4 binding missing")
need(all(item.get("HostIp") in ("0.0.0.0", "::") and item.get("HostPort") == "3770" for item in resolved_bindings), "resolved port is not public")
need(set(c["NetworkSettings"]["Networks"]) == {"proxy-network"}, "network mismatch")
need(c["HostConfig"].get("ExtraHosts") == ["host.docker.internal:host-gateway"], "extra-host mismatch")
need(c["HostConfig"]["RestartPolicy"].get("Name") == "unless-stopped", "restart mismatch")
' || return 1
}

start_candidate() {
  docker run --detach \
    --name anvil-web \
    --env-file "$ENV_TEMP" \
    --env ANVIL_HOST=0.0.0.0 \
    --env ANVIL_PORT=3770 \
    --publish 3770:3770 \
    --network proxy-network \
    --add-host host.docker.internal:host-gateway \
    --restart unless-stopped \
    --init \
    --read-only \
    --cap-drop ALL \
    --security-opt no-new-privileges \
    --tmpfs /tmp:rw,noexec,nosuid,size=32m \
    --health-cmd "/opt/venv/bin/python -c \"import urllib.request; urllib.request.urlopen('http://127.0.0.1:3770/health/live', timeout=2)\"" \
    --health-interval 15s \
    --health-timeout 5s \
    --health-retries 4 \
    --health-start-period 10s \
    "anvil-web:$CANDIDATE" >/dev/null
}

verify_candidate() {
  local health="" attempt
  verify_common_runtime || return 1
  [[ "$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$CONTAINER")" == "$CANDIDATE" ]] || return 1
  docker inspect "$CONTAINER" | python3 -c '
import json, sys
c = json.load(sys.stdin)[0]
h = c["HostConfig"]
def need(ok, message):
    if not ok: raise SystemExit(message)
need(h.get("ReadonlyRootfs") is True, "ReadonlyRootfs mismatch")
need(h.get("Init") is True, "init mismatch")
need(h.get("CapDrop") == ["ALL"], "CapDrop mismatch")
need(len(h.get("SecurityOpt") or []) == 1 and h["SecurityOpt"][0].startswith("no-new-privileges"), "SecurityOpt mismatch")
tmpfs = h.get("Tmpfs") or {}
need("/tmp" in tmpfs and all(token in tmpfs["/tmp"] for token in ("rw", "noexec", "nosuid", "size=")), "tmpfs mismatch")
need(c["Config"].get("Healthcheck") is not None, "Health contract missing")
' || return 1
  for attempt in $(seq 1 30); do
    health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' "$CONTAINER")" || return 1
    [[ "$health" == "healthy" ]] && break
    [[ "$health" == "unhealthy" ]] && return 1
    sleep 5
  done
  [[ "$health" == "healthy" ]] || return 1
  curl --noproxy '*' --fail --silent --show-error --connect-timeout 2 --max-time 10 http://127.0.0.1:3770/health/live |
    python3 -c 'import json,sys; d=json.load(sys.stdin); raise SystemExit(0 if d.get("status") in {"alive", "ok"} else 1)' || return 1
  curl --noproxy '*' --fail --silent --show-error --connect-timeout 2 --max-time 10 http://127.0.0.1:3770/health/ready |
    python3 -c 'import json,sys; d=json.load(sys.stdin); raise SystemExit(0 if d.get("status") == "ready" and d.get("migration_head") == "0013_task_bootstrap_authority" else 1)' || return 1
  curl --noproxy '*' --fail --silent --show-error --connect-timeout 2 --max-time 10 --output /dev/null http://127.0.0.1:3770/ || return 1
  curl --noproxy '*' --fail --silent --show-error --connect-timeout 2 --max-time 10 --output /dev/null http://127.0.0.1:3770/provider-workbench.html || return 1
  curl --noproxy '*' --fail --silent --show-error --connect-timeout 2 --max-time 10 http://127.0.0.1:3770/openapi.json |
    python3 -c 'import json,sys; d=json.load(sys.stdin); raise SystemExit(0 if "/api/runs/{id}/steps/{stepId}:execute" in d.get("paths", {}) else 1)' || return 1
  curl --noproxy '*' --fail --silent --show-error --connect-timeout 2 --max-time 10 --header "Host: ${PUBLIC_HOST}:3770" http://127.0.0.1:3770/auth/session/status |
    python3 -c 'import json,sys; d=json.load(sys.stdin); raise SystemExit(0 if "authenticated" in d and "mode" in d else 1)' || return 1
  unchanged_non_runtime_containers || return 1
  unchanged_networks_and_volumes || return 1
}

start_prior() {
  docker run --detach \
    --name anvil-web \
    --env-file "$ENV_TEMP" \
    --env ANVIL_HOST=0.0.0.0 \
    --env ANVIL_PORT=3770 \
    --publish 3770:3770 \
    --network proxy-network \
    --add-host host.docker.internal:host-gateway \
    --restart unless-stopped \
    "anvil-web:$PRIOR" >/dev/null
}

remove_runtime_for_exact_replacement() {
  docker stop --time 30 "$CONTAINER" >/dev/null
  docker container rm "$CONTAINER" >/dev/null
}

cleanup() {
  local rc=$? rollback_rc=0
  trap - EXIT HUP INT TERM
  set +e
  if [[ "$SUCCESS" != "1" && "$ROLLBACK_REQUIRED" == "1" ]]; then
    if docker container inspect "$CONTAINER" >/dev/null 2>&1; then
      docker stop --time 30 "$CONTAINER" >/dev/null 2>&1 || rollback_rc=1
      docker container rm "$CONTAINER" >/dev/null 2>&1 || rollback_rc=1
    fi
    if [[ "$rollback_rc" == "0" ]]; then
      start_prior || rollback_rc=1
      verify_common_runtime || rollback_rc=1
      unchanged_non_runtime_containers || rollback_rc=1
      unchanged_networks_and_volumes || rollback_rc=1
    fi
  fi
  if [[ "$SUCCESS" != "1" && "$CHECKOUT_CHANGED" == "1" ]]; then
    git -C "$APP_CHECKOUT" checkout --detach "$PRIOR" >/dev/null 2>&1 || rollback_rc=1
  fi
  if [[ -n "$ENV_TEMP" && -e "$ENV_TEMP" ]]; then
    rm -f -- "$ENV_TEMP" || rollback_rc=1
  fi
  if [[ "$rollback_rc" != "0" ]]; then
    printf 'C01 formal runtime rollback failed; operator intervention required\n' >&2
    exit 70
  fi
  exit "$rc"
}
trap cleanup EXIT
trap 'exit 130' HUP INT TERM

[[ -d /srv/anvil-wsl/runtime ]] || fail "root-only runtime temp directory missing"
[[ ! -L /srv/anvil-wsl/runtime ]] || fail "runtime temp directory must not be a symlink"
[[ "$(stat -c '%U:%G' /srv/anvil-wsl/runtime)" == "root:root" ]] || fail "runtime temp directory owner mismatch"
RUNTIME_DIR_MODE="$(stat -c '%a' /srv/anvil-wsl/runtime)"
[[ "$RUNTIME_DIR_MODE" =~ ^[0-7]{3,4}$ ]] || fail "runtime temp directory mode is invalid"
(( (8#$RUNTIME_DIR_MODE & 0022) == 0 )) || fail "runtime temp directory is writable by group or other"
ENV_TEMP="$(mktemp /srv/anvil-wsl/runtime/c01-formal-env.XXXXXX)"
chmod 600 "$ENV_TEMP"

docker inspect --format '{{json .Config.Env}}' "$CONTAINER" | python3 -c '
import json, re, sys
manifest_path, output_path = sys.argv[1:3]
with open(manifest_path, encoding="utf-8") as handle:
    allowlist = json.load(handle)["runtime"]["environment_allowlist"]
allowed, found = set(allowlist), {}
for line in json.load(sys.stdin):
    if "=" not in line:
        continue
    key, value = line.split("=", 1)
    if key not in allowed:
        continue
    if key in found:
        raise SystemExit("duplicate allowlisted environment key: " + key)
    if not re.fullmatch(r"[A-Z][A-Z0-9_]*", key) or not value:
        raise SystemExit("invalid allowlisted environment key: " + key)
    if any(marker in value for marker in ("\x00", "\n", "\r")):
        raise SystemExit("invalid environment value encoding: " + key)
    found[key] = value
missing = sorted(allowed - found.keys())
if missing:
    raise SystemExit("missing allowlisted environment keys: " + ",".join(missing))
scope_value = found["ANVIL_TEST_SESSION_PERMISSION_SCOPES"]
if "run" + ":" + "execute" in {item.strip() for item in scope_value.split(",")}:
    raise SystemExit("execution permission scope is forbidden")
with open(output_path, "w", encoding="utf-8", newline="\n") as output:
    for key in allowlist:
        output.write(key + "=" + found[key] + "\n")
' "$MANIFEST" "$ENV_TEMP" || fail "allowlisted environment extraction failed"

docker inspect --format '{{json .Config.Env}}' "$CONTAINER" | python3 -c '
import json, sys
current = {}
for entry in json.load(sys.stdin):
    if "=" in entry:
        key, value = entry.split("=", 1)
        current[key] = value
expected = {}
with open(sys.argv[1], encoding="utf-8") as source:
    for line in source:
        key, value = line.rstrip("\n").split("=", 1)
        expected[key] = value
for key, value in expected.items():
    if current.get(key) != value:
        raise SystemExit("current environment mismatch: " + key)
' "$ENV_TEMP" || fail "allowlisted environment differs from the current runtime"

PUBLIC_HOST="$(python3 -c '
import json, sys
manifest_path, environment_path = sys.argv[1:3]
with open(manifest_path, encoding="utf-8") as source:
    expected = json.load(source)["runtime"]["public_host"]
actual = None
with open(environment_path, encoding="utf-8") as source:
    for line in source:
        key, value = line.rstrip("\n").split("=", 1)
        if key == "ANVIL_PUBLIC_HOST":
            actual = value
            break
if actual != expected:
    raise SystemExit("public host environment mismatch")
print(expected)
' "$MANIFEST" "$ENV_TEMP")" || fail "public host binding validation failed"

snapshot_inventories || fail "unexpected Anvil-owned Docker resource or inventory failure"
[[ "$(git -C "$APP_CHECKOUT" remote get-url origin)" == "$PRIVATE_REMOTE_URL" ]] || fail "application origin mismatch"
[[ -z "$(git -C "$APP_CHECKOUT" status --porcelain=v1 --untracked-files=all)" ]] || fail "application checkout is dirty"
git -C "$APP_CHECKOUT" fetch --no-tags origin "$PRIVATE_FETCH_REF"
[[ "$(git -C "$APP_CHECKOUT" rev-parse --verify "$PRIVATE_REMOTE_REF^{commit}")" == "$CANDIDATE" ]] || fail "private candidate ref mismatch"
[[ "$(git -C "$APP_CHECKOUT" show -s --format=%P "$CANDIDATE")" == "$CANDIDATE_PARENT" ]] || fail "candidate parent mismatch"
mapfile -t EXPECTED_CANDIDATE_PATHS < <(python3 -c 'import json,sys; print("\n".join(sorted(json.load(open(sys.argv[1], encoding="utf-8"))["candidate_changed_paths"])))' "$MANIFEST")
mapfile -t ACTUAL_CANDIDATE_PATHS < <(git -C "$APP_CHECKOUT" diff --name-only "$CANDIDATE_PARENT" "$CANDIDATE" | sort)
[[ "${EXPECTED_CANDIDATE_PATHS[*]}" == "${ACTUAL_CANDIDATE_PATHS[*]}" ]] || fail "candidate changed path set mismatch"
CHECKOUT_CHANGED=1
git -C "$APP_CHECKOUT" checkout --detach "$CANDIDATE"
[[ "$(git -C "$APP_CHECKOUT" rev-parse HEAD)" == "$CANDIDATE" ]] || fail "candidate detached checkout mismatch"
[[ -z "$(git -C "$APP_CHECKOUT" status --porcelain=v1 --untracked-files=all)" ]] || fail "candidate checkout is dirty"

docker build --pull=false \
  --build-arg "ANVIL_RELEASE_COMMIT=$CANDIDATE" \
  --file "$APP_CHECKOUT/deploy/ysna/Dockerfile.web" \
  --tag "anvil-web:$CANDIDATE" \
  "$APP_CHECKOUT"
[[ "$(docker image inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "anvil-web:$CANDIDATE")" == "$CANDIDATE" ]] || fail "candidate image revision mismatch"

ROLLBACK_REQUIRED=1
remove_runtime_for_exact_replacement
start_candidate
verify_candidate
SUCCESS=1
printf '{"status":"VERIFIED","candidate":"%s","prior":"%s","container":"anvil-web","port":3770,"container_count":1,"database_writes":0,"provider_calls":0,"telegram_calls":0,"extra_runtime_resources":0,"secrets":"omitted"}\n' "$CANDIDATE" "$PRIOR"
