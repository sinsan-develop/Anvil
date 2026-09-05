#!/usr/bin/env bash
set -euo pipefail

require_exact_sha() {
  [[ "${1:-}" =~ ^[0-9a-f]{40}$ ]] || { echo 'full 40-character SHA required' >&2; return 2; }
}

require_control_utility_checkout() {
  local script_dir="$1" root="${ANVIL_WSL_DEPLOY_ROOT:-/srv/anvil-wsl}"
  local control_repo="${ANVIL_WSL_CONTROL_REPO:-$root/control}"
  local application_repo="${ANVIL_WSL_APPLICATION_REPO:-$root/repo}"
  local actual expected application
  actual="$(cd "$script_dir" && pwd -P)"
  expected="$(cd "$control_repo/deploy/wsl" && pwd -P)" || {
    echo 'control utility checkout is missing' >&2; return 3;
  }
  application="$(cd "$application_repo" && pwd -P)" || {
    echo 'candidate application checkout is missing' >&2; return 3;
  }
  [[ "$actual" == "$expected" ]] || {
    echo 'control-plane script must execute from the control utility checkout' >&2; return 3;
  }
  [[ "$expected" != "$application/deploy/wsl" ]] || {
    echo 'control utility checkout must be separate from candidate application checkout' >&2; return 3;
  }
}

configure_wsl_target() {
  local target="${1:-}"
  case "$target" in
    15)
      ANVIL_TARGET_SLUG=pg15
      ANVIL_POSTGRES_IMAGE="${ANVIL_WSL_PG15_IMAGE:-postgres:15}"
      ANVIL_POSTGRES_VOLUME_TARGET=/var/lib/postgresql/data
      ANVIL_WSL_HTTP_PORT="${ANVIL_WSL_PG15_HTTP_PORT:-4770}"
      ;;
    18-rc)
      ANVIL_TARGET_SLUG=pg18rc
      ANVIL_POSTGRES_IMAGE="${ANVIL_WSL_PG18_RC_IMAGE:-postgres:18rc1}"
      ANVIL_POSTGRES_VOLUME_TARGET=/var/lib/postgresql
      ANVIL_WSL_HTTP_PORT="${ANVIL_WSL_PG18_RC_HTTP_PORT:-4870}"
      ;;
    *) echo 'PostgreSQL target must be 15 or 18-rc' >&2; return 2 ;;
  esac
  ANVIL_COMPOSE_PROJECT_NAME="anvil-wsl-${ANVIL_TARGET_SLUG}"
  export ANVIL_TARGET_SLUG ANVIL_POSTGRES_IMAGE ANVIL_POSTGRES_VOLUME_TARGET ANVIL_WSL_HTTP_PORT ANVIL_COMPOSE_PROJECT_NAME
}

load_server_environment() {
  local file="$1" mode name value
  [[ -f "$file" ]] || { echo "server-only environment missing: $file" >&2; return 4; }
  mode="$(stat -c '%a' "$file")"
  [[ "$mode" == 600 || "$mode" == 400 ]] || { echo 'server-only environment must be mode 0600 or stricter' >&2; return 4; }
  for name in ANVIL_WSL_PG_PASSWORD ANVIL_TEST_SESSION_BOOTSTRAP_TOKEN ANVIL_TEST_SESSION_ACTOR_ID ANVIL_TEST_SESSION_PROJECT_ID ANVIL_TEST_SESSION_ENVIRONMENT_ID ANVIL_TEST_SESSION_RUN_IDS ANVIL_TEST_SESSION_PERMISSION_SCOPES; do
    [[ "$(grep -Ec "^${name}=" "$file" || true)" == 1 ]] || { echo "required environment value must appear exactly once: $name" >&2; return 4; }
    value="$(sed -n "s/^${name}=//p" "$file")"
    [[ -n "$value" && "$value" != *$'\n'* && "$value" != *$'\r'* ]] || { echo "invalid environment value: $name" >&2; return 4; }
    printf -v "$name" '%s' "$value"
    export "$name"
  done
  [[ "$ANVIL_WSL_PG_PASSWORD" =~ ^[0-9a-f]{48}$ ]] || { echo 'PostgreSQL password format is invalid' >&2; return 4; }
  [[ "$ANVIL_TEST_SESSION_BOOTSTRAP_TOKEN" =~ ^[0-9a-f]{64}$ ]] || { echo 'bootstrap token format is invalid' >&2; return 4; }
  [[ "$ANVIL_TEST_SESSION_PERMISSION_SCOPES" == 'tasks:write,tasks:read,run:events:read,provider:read' ]] || { echo 'test session scope mismatch' >&2; return 4; }
}

verify_backup_receipt() {
  local receipt="$1" dump="$2" expected="$3" target="$4"
  [[ -s "$receipt" && -s "$dump" ]] || { echo 'backup receipt or dump is missing' >&2; return 4; }
  local actual_hash python_bin="${ANVIL_PYTHON:-python3}"
  actual_hash="$(sha256sum "$dump" | cut -d' ' -f1)"
  command -v "$python_bin" >/dev/null || { echo 'Python 3 is required for backup receipt validation' >&2; return 4; }
  "$python_bin" - "$receipt" "$expected" "$target" "$actual_hash" <<'PY'
import json, sys
path, expected, target, actual_hash = sys.argv[1:]
with open(path, encoding="utf-8") as stream:
    receipt = json.load(stream)
required = {
    "status": "BACKUP_VERIFIED",
    "release_commit": expected,
    "postgres_target": target,
    "sha256": actual_hash,
    "secret_values": "omitted",
}
if any(receipt.get(key) != value for key, value in required.items()):
    raise SystemExit("backup receipt binding mismatch")
PY
}

start_wsl_ingress() {
  local attempt ready base="http://127.0.0.1:$ANVIL_WSL_HTTP_PORT"
  wsl_compose run --rm --no-deps --entrypoint nginx anvil-ingress -t || return $?
  # Recreate after every application replacement so static upstream DNS is fresh.
  wsl_compose up -d --no-build --force-recreate anvil-ingress || return $?
  for attempt in {1..30}; do
    if ready="$(curl --noproxy '*' --connect-timeout 2 --max-time 3 -fsS -H "Host: 127.0.0.1:$ANVIL_WSL_HTTP_PORT" "$base/health/ready" 2>/dev/null)"; then
      [[ "$ready" == *'"status":"ready"'* && "$ready" == *'"migration_head":"0013_task_bootstrap_authority"'* ]] && return 0
    fi
    sleep 1
  done
  echo "ingress readiness timeout for $ANVIL_TARGET_SLUG" >&2
  return 6
}

# Explicit final-stage entrypoint; never called by deploy, verify, or rollback.
cleanup_wsl_test_volumes() {
  local expected="$1" repo="$2" manifest_ref="$3"
  require_exact_sha "$expected" || return $?
  source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/candidate-manifest-guard.sh"
  validate_wsl_candidate_manifest "$repo" "$manifest_ref" "$expected" || return $?
  local -a targets=(15 18-rc)
  local -a projects=(anvil-wsl-pg15 anvil-wsl-pg18rc)
  local -a volumes=(anvil-wsl-pg15_anvil-db-data anvil-wsl-pg18rc_anvil-db-data)
  local index volume project network kind container service inventory volumes_present networks_present containers
  volumes_present="$(docker volume ls --format '{{.Name}}')" || return $?
  networks_present="$(docker network ls --format '{{.Name}}')" || return $?
  REPO="$repo"
  ANVIL_RELEASE_COMMIT="$expected"
  export REPO ANVIL_RELEASE_COMMIT

  # Validate all exact names and all labels before the first deletion.
  for index in 0 1; do
    volume="${volumes[$index]}"
    project="${projects[$index]}"
    containers="$(docker ps -aq --filter "label=com.docker.compose.project=$project")" || return $?
    for container in $containers; do
      [[ "$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "$container")" == "$project" ]] || return 9
      service="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.service"}}' "$container")" || return $?
      case "$service" in anvil-web|anvil-db|anvil-ingress) ;; *) echo 'unrelated container in cleanup project' >&2; return 9 ;; esac
    done
    for kind in anvil-wsl anvil-ingress; do
      network="${project}_${kind}"
      grep -Fxq "$network" <<< "$networks_present" || continue
      [[ "$(docker network inspect --format '{{index .Labels "com.docker.compose.project"}}' "$network")" == "$project" ]] || return 9
      [[ "$(docker network inspect --format '{{index .Labels "com.docker.compose.network"}}' "$network")" == "$kind" ]] || return 9
      if [[ "$kind" == anvil-wsl ]]; then
        [[ "$(docker network inspect --format '{{.Internal}}' "$network")" == true ]] || return 9
      else
        [[ "$(docker network inspect --format '{{.Internal}}' "$network")" == false ]] || return 9
        [[ "$(docker network inspect --format '{{index .Labels "com.anvil.environment"}}' "$network")" == WSL_SERVER_TEST_STAGING ]] || return 9
        [[ "$(docker network inspect --format '{{index .Labels "com.anvil.cleanup-scope"}}' "$network")" == C21_WSL_ISOLATED_TEST ]] || return 9
      fi
      inventory="$(docker network inspect --format '{{range $id, $value := .Containers}}{{$id}} {{end}}' "$network")" || return $?
      for container in $inventory; do
        [[ "$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "$container")" == "$project" ]] || { echo 'unrelated network endpoint' >&2; return 9; }
        service="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.service"}}' "$container")" || return $?
        case "$service" in anvil-web|anvil-db|anvil-ingress) ;; *) return 9 ;; esac
      done
    done
    grep -Fxq "$volume" <<< "$volumes_present" || continue
    [[ "$(docker volume inspect --format '{{ index .Labels "com.docker.compose.project" }}' "$volume")" == "$project" ]] || {
      echo "cleanup Compose project label mismatch: $volume" >&2; return 9;
    }
    [[ "$(docker volume inspect --format '{{ index .Labels "com.anvil.environment" }}' "$volume")" == "WSL_SERVER_TEST_STAGING" ]] || {
      echo "cleanup environment label mismatch: $volume" >&2; return 9;
    }
    [[ "$(docker volume inspect --format '{{ index .Labels "com.anvil.cleanup-scope" }}' "$volume")" == "C21_WSL_ISOLATED_TEST" ]] || {
      echo "cleanup scope label mismatch: $volume" >&2; return 9;
    }
  done
  for index in 0 1; do
    configure_wsl_target "${targets[$index]}" || return $?
    [[ "$ANVIL_COMPOSE_PROJECT_NAME" == "${projects[$index]}" ]] || { echo 'fixed project mapping mismatch' >&2; return 9; }
    wsl_compose rm -sf anvil-ingress anvil-web anvil-db || return $?
    for kind in anvil-wsl anvil-ingress; do
      network="${projects[$index]}_${kind}"
      grep -Fxq "$network" <<< "$networks_present" || continue
      [[ "$(docker network inspect --format '{{len .Containers}}' "$network")" == 0 ]] || { echo 'network still has endpoints' >&2; return 9; }
      docker network rm "$network" || return $?
    done
    volume="${volumes[$index]}"
    if grep -Fxq "$volume" <<< "$volumes_present"; then docker volume rm "$volume" || return $?; fi
  done
}

wsl_compose() {
  if docker compose version >/dev/null 2>&1; then
    ANVIL_RELEASE_COMMIT="$ANVIL_RELEASE_COMMIT" docker compose -f "$REPO/deploy/wsl/compose.wsl.yml" "$@"
  elif command -v docker-compose >/dev/null 2>&1; then
    ANVIL_RELEASE_COMMIT="$ANVIL_RELEASE_COMMIT" docker-compose -f "$REPO/deploy/wsl/compose.wsl.yml" "$@"
  else
    echo 'Docker Compose runner unavailable: neither docker compose nor docker-compose is available' >&2
    return 127
  fi
}
