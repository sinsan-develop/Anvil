#!/usr/bin/env bash
set -euo pipefail
EXPECTED="${1:-}"
[[ "$EXPECTED" =~ ^[0-9a-f]{40}$ ]] || { echo 'full 40-character SHA required' >&2; exit 2; }
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="${ANVIL_WSL_DEPLOY_ROOT:-/srv/anvil-wsl}"
ENV_FILE="$ROOT/.env"
TEMP_FILE=""

cleanup_temp() {
  [[ -z "$TEMP_FILE" ]] || rm -f -- "$TEMP_FILE"
}

trap cleanup_temp EXIT
trap 'cleanup_temp; exit 130' HUP INT TERM

create_secure_temp() {
  umask 077
  TEMP_FILE="$(mktemp "$ENV_FILE.tmp.XXXXXX")"
}

if [[ ! -e "$ENV_FILE" ]]; then
  mkdir -p "$ROOT"
  create_secure_temp
  password="$(openssl rand -hex 24)"
  bootstrap_token="$(openssl rand -hex 32)"
  cat > "$TEMP_FILE" <<EOF
ANVIL_WSL_PG_PASSWORD=$password
ANVIL_TEST_SESSION_BOOTSTRAP_TOKEN=$bootstrap_token
ANVIL_TEST_SESSION_ACTOR_ID=c21-wsl-validator
ANVIL_TEST_SESSION_PROJECT_ID=c21-wsl-project
ANVIL_TEST_SESSION_ENVIRONMENT_ID=wsl-test-staging
ANVIL_TEST_SESSION_RUN_IDS=c21-wsl-run
ANVIL_TEST_SESSION_PERMISSION_SCOPES=tasks:write,tasks:read,run:events:read,provider:read
EOF
  chmod 600 "$TEMP_FILE"
  mv -f "$TEMP_FILE" "$ENV_FILE"
  TEMP_FILE=""
else
  mode="$(stat -c '%a' "$ENV_FILE")"
  [[ "$mode" == 600 || "$mode" == 400 ]] || { echo 'server-only environment must be mode 0600 or stricter' >&2; exit 4; }
  create_secure_temp
  python_bin="${ANVIL_PYTHON:-python3}"
  command -v "$python_bin" >/dev/null || { echo 'Python 3 is required for test-session scope update' >&2; exit 4; }
  "$python_bin" - "$ENV_FILE" "$TEMP_FILE" <<'PY'
import re
import sys

source_path, target_path = sys.argv[1:]
scope_name = b"ANVIL_TEST_SESSION_PERMISSION_SCOPES"
replacement = scope_name + b"=tasks:write,tasks:read,run:events:read,provider:read"
with open(source_path, "rb") as source:
    content = source.read()
pattern = re.compile(rb"(?m)^" + re.escape(scope_name) + rb"=[^\r\n]*")
matches = list(pattern.finditer(content))
if len(matches) > 1:
    raise SystemExit("test session scope must appear at most once")
if matches:
    updated = content[:matches[0].start()] + replacement + content[matches[0].end():]
else:
    separator = b"\r\n" if b"\r\n" in content else b"\n"
    updated = content + (separator if content and not content.endswith(b"\n") else b"") + replacement + separator
with open(target_path, "wb") as target:
    target.write(updated)
PY
  chmod "$mode" "$TEMP_FILE"
  mv -f "$TEMP_FILE" "$ENV_FILE"
  TEMP_FILE=""
fi
trap - EXIT HUP INT TERM
exec bash "$SCRIPT_DIR/control-runtime.sh" deploy "$EXPECTED"
