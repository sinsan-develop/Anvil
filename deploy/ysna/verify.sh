#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; ROOT="${ANVIL_DEPLOY_ROOT:-$(cd "$SCRIPT_DIR/../../.." && pwd)}"; REPO="$ROOT/repo"; EXPECTED="${1:-${ANVIL_RELEASE_COMMIT:-}}"; : "${EXPECTED:?release SHA required}"
RUNTIME_ENV="$ROOT/runtime/anvil.env"; [[ -f "$RUNTIME_ENV" ]] || { echo 'runtime secret file is missing' >&2; exit 4; }; [[ "$(stat -c '%a' "$RUNTIME_ENV")" == "600" || "$(stat -c '%a' "$RUNTIME_ENV")" == "400" ]] || { echo 'runtime secret file must be mode 0600 (or stricter)' >&2; exit 4; }
[[ "$EXPECTED" =~ ^[0-9a-f]{40}$ ]] || exit 2; [[ "$(git -C "$REPO" rev-parse HEAD)" == "$EXPECTED" ]] || { echo 'commit mismatch' >&2; exit 3; }; (cd "$REPO" && [[ -z "$(git status --porcelain)" ]]) || exit 3
source "$REPO/deploy/ysna/manifest-guard.sh"; ANVIL_RELEASE_MANIFEST_REF="${ANVIL_RELEASE_MANIFEST_REF:-origin/main}"; validate_release_manifest "$REPO" "$ANVIL_RELEASE_MANIFEST_REF" "$EXPECTED"
ANVIL_RUNTIME_ENV_FILE="$RUNTIME_ENV" ANVIL_RELEASE_COMMIT="$EXPECTED" docker compose -f "$REPO/deploy/ysna/compose.production.yml" ps --status running anvil-web >/dev/null
revision="$(docker image inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "anvil-web:$EXPECTED")"; [[ "$revision" == "$EXPECTED" ]] || { echo 'OCI revision mismatch' >&2; exit 5; }
probe() { curl --fail --silent --show-error --connect-timeout 2 --max-time 3 "$@"; }
read_runtime_env() {
  local name="$1"
  sed -n "s/^${name}=//p" "$RUNTIME_ENV" | tail -n 1
}
scope_assignment_count="$(grep -Ec '^ANVIL_TEST_SESSION_PERMISSION_SCOPES=' "$RUNTIME_ENV" || true)"
[[ "$scope_assignment_count" == 1 ]] || {
  echo 'ANVIL_TEST_SESSION_PERMISSION_SCOPES must be assigned exactly once' >&2
  exit 7
}
permission_scopes="$(read_runtime_env ANVIL_TEST_SESSION_PERMISSION_SCOPES)"
[[ "$permission_scopes" == 'tasks:write,tasks:read,run:events:read' ]] || {
  echo 'ANVIL_TEST_SESSION_PERMISSION_SCOPES must equal tasks:write,tasks:read,run:events:read' >&2
  exit 7
}
probe https://anvil.sinsan.kr/ >/dev/null
openapi="$(probe https://anvil.sinsan.kr/openapi.json)"
for contract_path in '/api/providers' '/api/runs/{id}/events'; do
  [[ "$openapi" == *"\"$contract_path\""* ]] || { echo "OpenAPI path missing: $contract_path" >&2; exit 6; }
done
ready="$(probe https://anvil.sinsan.kr/health/ready)"; [[ "$ready" == *'"migration_head":"0013_task_bootstrap_authority"'* ]] || { echo 'readiness migration head mismatch' >&2; exit 6; }
probe https://anvil.sinsan.kr/health/live >/dev/null
# The Telegram route is intentionally hidden from OpenAPI. A deliberately invalid
# transport secret proves the POST-only route without reaching rate-limit, replay,
# audit or command persistence.
telegram_body="$(mktemp "$ROOT/runtime/verify-telegram-body.XXXXXX")"
telegram_status="$(curl --silent --show-error --connect-timeout 2 --max-time 3 -o "$telegram_body" -w '%{http_code}' -X POST -H 'Host: anvil.sinsan.kr' -H 'Content-Type: application/json' --data '{}' https://anvil.sinsan.kr/integrations/telegram/webhook)"
[[ "$telegram_status" == 403 ]] && grep -Fq 'webhook authentication failed' "$telegram_body" || { rm -f "$telegram_body"; echo 'Telegram route/auth boundary mismatch' >&2; exit 6; }
rm -f "$telegram_body"
bootstrap_token="${ANVIL_TEST_SESSION_BOOTSTRAP_TOKEN:-$(read_runtime_env ANVIL_TEST_SESSION_BOOTSTRAP_TOKEN)}"
run_ids="${ANVIL_TEST_SESSION_RUN_IDS:-$(read_runtime_env ANVIL_TEST_SESSION_RUN_IDS)}"
[[ -n "$bootstrap_token" ]] || { echo 'test session bootstrap token missing' >&2; exit 7; }
run_id="${run_ids%%,*}"; [[ -n "$run_id" ]] || { echo 'allowlisted test run id missing' >&2; exit 7; }
cookie_jar="$(mktemp "$ROOT/runtime/verify-cookie.XXXXXX")"
sse_headers="$(mktemp "$ROOT/runtime/verify-sse-headers.XXXXXX")"
sse_body="$(mktemp "$ROOT/runtime/verify-sse-body.XXXXXX")"
resume_headers="$(mktemp "$ROOT/runtime/verify-resume-headers.XXXXXX")"
resume_body="$(mktemp "$ROOT/runtime/verify-resume-body.XXXXXX")"
trap 'rm -f "$cookie_jar" "$sse_headers" "$sse_body" "$resume_headers" "$resume_body"' EXIT
probe -c "$cookie_jar" -X POST -H 'Host: anvil.sinsan.kr' -H 'Origin: https://anvil.sinsan.kr' -H "Authorization: Bearer $bootstrap_token" https://anvil.sinsan.kr/auth/session >/dev/null
capture_sse() {
  local headers="$1" body="$2"; shift 2
  local rc
  set +e
  curl --fail --silent --show-error --connect-timeout 2 --max-time 3 -b "$cookie_jar" -D "$headers" -o "$body" -H 'Accept: text/event-stream' "$@"
  rc=$?
  set -e
  [[ "$rc" == 0 || "$rc" == 28 ]] || return "$rc"
  tr '[:upper:]' '[:lower:]' < "$headers" | tr -d '\r' | grep -Eq '^content-type:[[:space:]]*text/event-stream([;[:space:]]|$)'
  grep -q '^id:' "$body"
}
capture_sse "$sse_headers" "$sse_body" "https://anvil.sinsan.kr/api/runs/$run_id/events" || { echo 'initial SSE contract mismatch' >&2; exit 7; }
event_id="$(sed -n 's/^id:[[:space:]]*//p' "$sse_body" | head -n 1)"; [[ -n "$event_id" ]] || { echo 'initial SSE id missing' >&2; exit 7; }
capture_sse "$resume_headers" "$resume_body" -H "Last-Event-ID: $event_id" "https://anvil.sinsan.kr/api/runs/$run_id/events" || { echo 'Last-Event-ID resume mismatch' >&2; exit 7; }
resume_event_id="$(sed -n 's/^id:[[:space:]]*//p' "$resume_body" | head -n 1)"
[[ -n "$resume_event_id" && "$resume_event_id" != "$event_id" ]] || { echo 'Last-Event-ID was not advanced' >&2; exit 7; }
printf '{"status":"verified","commit":"%s","listener":"anvil-web:3770","migration_head":"0013_task_bootstrap_authority","oci_revision":"%s","secret_values":"omitted"}\n' "$EXPECTED" "$revision" > "$ROOT/evidence/verification.json"
