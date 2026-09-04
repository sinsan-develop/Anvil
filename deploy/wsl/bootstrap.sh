#!/usr/bin/env bash
set -euo pipefail
EXPECTED="${1:-}"
[[ "$EXPECTED" =~ ^[0-9a-f]{40}$ ]] || { echo 'full 40-character SHA required' >&2; exit 2; }
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="${ANVIL_WSL_DEPLOY_ROOT:-/srv/anvil-wsl}"
ENV_FILE="$ROOT/.env"
if [[ ! -e "$ENV_FILE" ]]; then
  mkdir -p "$ROOT"
  umask 077
  password="$(openssl rand -hex 24)"
  bootstrap_token="$(openssl rand -hex 32)"
  cat > "$ENV_FILE.tmp.$$" <<EOF
ANVIL_WSL_PG_PASSWORD=$password
ANVIL_TEST_SESSION_BOOTSTRAP_TOKEN=$bootstrap_token
ANVIL_TEST_SESSION_ACTOR_ID=c21-wsl-validator
ANVIL_TEST_SESSION_PROJECT_ID=c21-wsl-project
ANVIL_TEST_SESSION_ENVIRONMENT_ID=wsl-test-staging
ANVIL_TEST_SESSION_RUN_IDS=c21-wsl-run
ANVIL_TEST_SESSION_PERMISSION_SCOPES=tasks:write,tasks:read,run:events:read
EOF
  chmod 600 "$ENV_FILE.tmp.$$"
  mv -f "$ENV_FILE.tmp.$$" "$ENV_FILE"
fi
exec "$SCRIPT_DIR/control-runtime.sh" deploy "$EXPECTED"
