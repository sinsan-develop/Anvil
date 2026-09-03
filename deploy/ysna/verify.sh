#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="${ANVIL_DEPLOY_ROOT:-$(cd "$SCRIPT_DIR/../../.." && pwd)}"
REPO="$ROOT/repo"; EXPECTED="${1:-${ANVIL_RELEASE_COMMIT:-}}"; : "${EXPECTED:?release SHA required}"
[[ "$EXPECTED" =~ ^[0-9a-f]{40}$ ]] || exit 2
RUNTIME_ENV="$ROOT/runtime/anvil.env"; EVIDENCE="$ROOT/evidence"
INCIDENT_RECEIPT="$EVIDENCE/c21-test-session-incident-hold.json"
BACKUP_RECEIPT="$EVIDENCE/c21-db-backup.json"; BACKUP_FILE="$ROOT/backups/c21/$EXPECTED/anvil.dump"
PROVISION="$REPO/deploy/ysna/provision-c21-validation.py"; REBIND="$REPO/deploy/ysna/rebind-c21-test-session.sh"; PROBE="$REPO/deploy/ysna/probe-providers.py"
mkdir -p "$EVIDENCE"

[[ ! -e "$INCIDENT_RECEIPT" ]] || { echo 'existing INCIDENT_HOLD requires separately approved operator clearance' >&2; exit 91; }

[[ -f "$BACKUP_RECEIPT" && -f "$BACKUP_FILE" ]] || { echo 'verified C-21 database backup is required before operational verification' >&2; exit 4; }
python3 - "$BACKUP_RECEIPT" "$BACKUP_FILE" "$EXPECTED" <<'PY'
from hashlib import sha256
import json, os, stat, sys
r=json.load(open(sys.argv[1], encoding='utf-8')); raw=open(sys.argv[2], 'rb').read()
ok=(r.get('status')=='BACKUP_VERIFIED' and r.get('release_commit')==sys.argv[3] and r.get('bytes')==len(raw)
    and r.get('sha256')==sha256(raw).hexdigest() and r.get('restore_listable') is True and r.get('mode')=='600')
mode_ok = os.name == 'nt' or stat.S_IMODE(os.stat(sys.argv[2]).st_mode) == 0o600
if not ok or not mode_ok: raise SystemExit('verified C-21 database backup receipt mismatch')
PY

[[ -f "$RUNTIME_ENV" ]] || { echo 'runtime secret file is missing' >&2; exit 4; }
mode="$(stat -c '%a' "$RUNTIME_ENV")"; [[ "$mode" == 600 || "$mode" == 400 ]] || { echo 'runtime secret file must be mode 0600 (or stricter)' >&2; exit 4; }
[[ "$(grep -Ec '^ANVIL_TEST_SESSION_PERMISSION_SCOPES=' "$RUNTIME_ENV" || true)" == 1 ]] || { echo 'ANVIL_TEST_SESSION_PERMISSION_SCOPES must be assigned exactly once' >&2; exit 7; }
[[ "$(sed -n 's/^ANVIL_TEST_SESSION_PERMISSION_SCOPES=//p' "$RUNTIME_ENV")" == 'tasks:write,tasks:read,run:events:read' ]] || { echo 'ANVIL_TEST_SESSION_PERMISSION_SCOPES must equal tasks:write,tasks:read,run:events:read' >&2; exit 7; }
read_runtime_env() { sed -n "s/^${1}=//p" "$RUNTIME_ENV" | tail -n 1; }
export ANVIL_DATABASE_URL="${ANVIL_DATABASE_URL:-$(read_runtime_env ANVIL_DATABASE_URL)}"
bootstrap_token="${ANVIL_TEST_SESSION_BOOTSTRAP_TOKEN:-$(read_runtime_env ANVIL_TEST_SESSION_BOOTSTRAP_TOKEN)}"
environment_id="${ANVIL_TEST_SESSION_ENVIRONMENT_ID:-$(read_runtime_env ANVIL_TEST_SESSION_ENVIRONMENT_ID)}"
approval_file="${ANVIL_C21_APPROVAL_RECEIPT_FILE:-$ROOT/runtime/c21-approval-receipt.json}"
[[ -n "$ANVIL_DATABASE_URL" && -n "$bootstrap_token" && -n "$environment_id" ]] || { echo 'C-21 runtime inputs are missing' >&2; exit 7; }
[[ -f "$approval_file" ]] || { echo 'C-21 approval receipt is missing' >&2; exit 7; }

[[ "$(git -C "$REPO" rev-parse HEAD)" == "$EXPECTED" ]] || { echo 'commit mismatch' >&2; exit 3; }
(cd "$REPO" && [[ -z "$(git status --porcelain)" ]]) || { echo 'checkout is dirty' >&2; exit 3; }
source "$REPO/deploy/ysna/manifest-guard.sh"; ANVIL_RELEASE_MANIFEST_REF="${ANVIL_RELEASE_MANIFEST_REF:-origin/main}"; validate_release_manifest "$REPO" "$ANVIL_RELEASE_MANIFEST_REF" "$EXPECTED"
ANVIL_RUNTIME_ENV_FILE="$RUNTIME_ENV" ANVIL_RELEASE_COMMIT="$EXPECTED" docker compose -f "$REPO/deploy/ysna/compose.production.yml" ps --status running anvil-web >/dev/null
revision="$(docker image inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "anvil-web:$EXPECTED")"; [[ "$revision" == "$EXPECTED" ]] || { echo 'OCI revision mismatch' >&2; exit 5; }
probe() { curl --fail --silent --show-error --connect-timeout 2 --max-time 3 "$@"; }
json_field() { python3 -c 'import json,sys; value=json.load(open(sys.argv[1])); [value:=value[key] for key in sys.argv[2].split(".")]; print(value)' "$1" "$2"; }
compose() { ANVIL_RUNTIME_ENV_FILE="$RUNTIME_ENV" ANVIL_RELEASE_COMMIT="$EXPECTED" docker compose -f "$REPO/deploy/ysna/compose.production.yml" "$@"; }

cookie=''; session=''; task=''; task_read=''; run=''; sse_headers=''; sse=''; resume_headers=''; resume=''; telegram_body=''
revision=''; task_id=''; run_id=''; verification_ready=0; rebind_started=0
FINALIZATION_RECEIPT="$EVIDENCE/c21-test-session-finalization.json"
cleanup_and_restore() {
  local original_rc=$? restore_rc=0 recreate_rc=0 restored_hash='unavailable' temp
  trap - EXIT INT TERM HUP
  set +e
  for temp in "$cookie" "$session" "$task" "$task_read" "$run" "$sse_headers" "$sse" "$resume_headers" "$resume" "$telegram_body"; do
    [[ -z "$temp" ]] || rm -f "$temp"
  done
  if [[ "$rebind_started" == 1 ]]; then
    ( source "$REBIND" restore ) >/dev/null
    restore_rc=$?
    if [[ "$restore_rc" == 0 ]]; then
      compose up -d --force-recreate anvil-web >/dev/null
      recreate_rc=$?
      [[ ! -f "$EVIDENCE/c21-test-session-rebind.json" ]] || restored_hash="$(sha256sum "$EVIDENCE/c21-test-session-rebind.json" | cut -d' ' -f1)"
    else
      recreate_rc=125
    fi
    if [[ "$restore_rc" != 0 || "$recreate_rc" != 0 ]]; then
      printf '{"status":"INCIDENT_HOLD","release_commit":"%s","original_exit_code":%s,"restore_exit_code":%s,"runtime_recreate_exit_code":%s,"secret_values":"omitted"}\n' \
        "$EXPECTED" "$original_rc" "$restore_rc" "$recreate_rc" > "$INCIDENT_RECEIPT.tmp.$$"
      chmod 600 "$INCIDENT_RECEIPT.tmp.$$"; mv -f "$INCIDENT_RECEIPT.tmp.$$" "$INCIDENT_RECEIPT"
      install -m 600 "$INCIDENT_RECEIPT" "$FINALIZATION_RECEIPT.tmp.$$"; mv -f "$FINALIZATION_RECEIPT.tmp.$$" "$FINALIZATION_RECEIPT"
      install -m 600 "$INCIDENT_RECEIPT" "$EVIDENCE/verification.json.tmp.$$"; mv -f "$EVIDENCE/verification.json.tmp.$$" "$EVIDENCE/verification.json"
      echo 'C-21 test-session restore or runtime recreation failed; INCIDENT_HOLD' >&2
      exit 90
    fi
    printf '{"status":"RESTORED_RUNTIME_RECREATED","release_commit":"%s","original_exit_code":%s,"restore_receipt_sha256":"%s","runtime_recreate_exit_code":0,"secret_values":"omitted"}\n' \
      "$EXPECTED" "$original_rc" "$restored_hash" > "$FINALIZATION_RECEIPT.tmp.$$"
    chmod 600 "$FINALIZATION_RECEIPT.tmp.$$"; mv -f "$FINALIZATION_RECEIPT.tmp.$$" "$FINALIZATION_RECEIPT"
  fi
  if [[ "$original_rc" == 0 && "$verification_ready" == 1 ]]; then
    printf '{"status":"VERIFIED","release_commit":"%s","listener":"anvil-web:3770","migration_head":"0013_task_bootstrap_authority","oci_revision":"%s","task_id":"%s","run_id":"%s","sse_initial_event":"TASK_CONFIRMED","last_event_id_resume":"EMPTY_NO_REPLAY","telegram_post_attempts":1,"provider_generation_requests":0,"test_session_restore":"RESTORED_RUNTIME_RECREATED","restore_receipt_sha256":"%s","runtime_recreate_exit_code":0,"secret_values":"omitted"}\n' \
      "$EXPECTED" "$revision" "$task_id" "$run_id" "$restored_hash" > "$EVIDENCE/verification.json.tmp.$$"
    chmod 600 "$EVIDENCE/verification.json.tmp.$$"; mv -f "$EVIDENCE/verification.json.tmp.$$" "$EVIDENCE/verification.json"
  elif [[ "$rebind_started" == 1 ]]; then
    printf '{"status":"FAILED_RESTORED","release_commit":"%s","original_exit_code":%s,"test_session_restore":"RESTORED_RUNTIME_RECREATED","restore_receipt_sha256":"%s","runtime_recreate_exit_code":0,"secret_values":"omitted"}\n' \
      "$EXPECTED" "$original_rc" "$restored_hash" > "$EVIDENCE/verification.json.tmp.$$"
    chmod 600 "$EVIDENCE/verification.json.tmp.$$"; mv -f "$EVIDENCE/verification.json.tmp.$$" "$EVIDENCE/verification.json"
  fi
  exit "$original_rc"
}
trap cleanup_and_restore EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP

probe https://anvil.sinsan.kr/ >/dev/null
openapi="$(probe https://anvil.sinsan.kr/openapi.json)"
for path in '/api/providers' '/api/projects/{projectId}/tasks' '/api/tasks/{taskId}' '/api/tasks/{taskId}/runs' '/api/runs/{id}/events'; do [[ "$openapi" == *"\"$path\""* ]] || { echo "OpenAPI path missing: $path" >&2; exit 6; }; done
ready="$(probe https://anvil.sinsan.kr/health/ready)"; [[ "$ready" == *'"migration_head":"0013_task_bootstrap_authority"'* ]] || { echo 'readiness migration head mismatch' >&2; exit 6; }
probe https://anvil.sinsan.kr/health/live >/dev/null

plan="$EVIDENCE/c21-authority-plan.json"; python3 "$PROVISION" plan --release "$EXPECTED" --environment "$environment_id" --output "$plan"
project_id="$(json_field "$plan" project_id)"; task_target_hash="$(json_field "$plan" task_authority_hash)"
work_instruction_id="$(json_field "$plan" artifact_ids.work_instruction)"; execution_plan_id="$(json_field "$plan" artifact_ids.execution_plan)"; execution_plan_hash="$(json_field "$plan" hashes.execution_plan)"
export ANVIL_RELEASE_COMMIT="$EXPECTED" ANVIL_C21_PROJECT_ID="$project_id" ANVIL_C21_RUN_ID="pending-$EXPECTED"
rebind_started=1; ( source "$REBIND" apply ); compose up -d --force-recreate anvil-web >/dev/null
python3 "$PROVISION" prepare --release "$EXPECTED" --environment "$environment_id" --approval "$approval_file" --output "$EVIDENCE/c21-authority-prepared.json"

cookie="$(mktemp "$ROOT/runtime/c21-cookie.XXXXXX")"; session="$(mktemp "$ROOT/runtime/c21-session.XXXXXX")"; task="$(mktemp "$ROOT/runtime/c21-task.XXXXXX")"; task_read="$(mktemp "$ROOT/runtime/c21-task-read.XXXXXX")"; run="$(mktemp "$ROOT/runtime/c21-run.XXXXXX")"
sse_headers="$(mktemp "$ROOT/runtime/c21-sse-headers.XXXXXX")"; sse="$(mktemp "$ROOT/runtime/c21-sse.XXXXXX")"; resume_headers="$(mktemp "$ROOT/runtime/c21-resume-headers.XXXXXX")"; resume="$(mktemp "$ROOT/runtime/c21-resume.XXXXXX")"; telegram_body="$(mktemp "$ROOT/runtime/c21-telegram.XXXXXX")"
issue_session() { : > "$cookie"; probe -c "$cookie" -o "$session" -X POST -H 'Host: anvil.sinsan.kr' -H 'Origin: https://anvil.sinsan.kr' -H "Authorization: Bearer $bootstrap_token" https://anvil.sinsan.kr/auth/session; json_field "$session" data.csrf_token; }
csrf="$(issue_session)"
task_payload="$(printf '{"objective":"Validate canonical C-21 lifecycle for release %s.","targetEnvironment":"%s","conversationMessage":"Use the approved release-bound C-21 authority."}' "$EXPECTED" "$environment_id")"
probe -b "$cookie" -o "$task" -X POST -H 'Host: anvil.sinsan.kr' -H 'Origin: https://anvil.sinsan.kr' -H "X-CSRF-Token: $csrf" -H 'X-Permission-Scope: tasks:write' -H 'If-Match: "0"' -H "Idempotency-Key: c21-task-$EXPECTED" -H "X-Target-Hash: $task_target_hash" -H 'X-Reason: validate approved C-21 lifecycle' -H 'Content-Type: application/json' --data "$task_payload" "https://anvil.sinsan.kr/api/projects/$project_id/tasks"
task_id="$(json_field "$task" data.taskId)"
python3 "$PROVISION" confirm --release "$EXPECTED" --environment "$environment_id" --approval "$approval_file" --task-id "$task_id" --output "$EVIDENCE/c21-task-confirmed.json"
probe -b "$cookie" -o "$task_read" -H 'Host: anvil.sinsan.kr' "https://anvil.sinsan.kr/api/tasks/$task_id"
[[ "$(json_field "$task_read" data.status)" == confirmed && "$(json_field "$task_read" data.version)" == 2 ]] || { echo 'confirmed Task read contract mismatch' >&2; exit 7; }
run_payload="$(printf '{"workInstructionId":"%s","executionPlanId":"%s","expectedStateVersion":2,"priorRunId":null,"resumeCheckpointId":null}' "$work_instruction_id" "$execution_plan_id")"
probe -b "$cookie" -o "$run" -X POST -H 'Host: anvil.sinsan.kr' -H 'Origin: https://anvil.sinsan.kr' -H "X-CSRF-Token: $csrf" -H 'X-Permission-Scope: tasks:write' -H 'If-Match: "2"' -H "Idempotency-Key: c21-run-$EXPECTED" -H "X-Target-Hash: $execution_plan_hash" -H 'X-Reason: start approved C-21 validation run' -H 'Content-Type: application/json' --data "$run_payload" "https://anvil.sinsan.kr/api/tasks/$task_id/runs"
run_id="$(json_field "$run" data.runId)"

export ANVIL_C21_RUN_ID="$run_id"; ( source "$REBIND" apply ); compose up -d --force-recreate anvil-web >/dev/null; csrf="$(issue_session)"
probe -b "$cookie" -D "$sse_headers" -o "$sse" -H 'Accept: text/event-stream' "https://anvil.sinsan.kr/api/runs/$run_id/events"
tr '[:upper:]' '[:lower:]' < "$sse_headers" | tr -d '\r' | grep -Eq '^content-type:[[:space:]]*text/event-stream([;[:space:]]|$)' || { echo 'initial SSE content type mismatch' >&2; exit 7; }
[[ "$(grep -c '^id:' "$sse")" == 1 && "$(grep -c '^event: TASK_CONFIRMED$' "$sse")" == 1 ]] || { echo 'initial SSE must contain exactly TASK_CONFIRMED seq1' >&2; exit 7; }
event_id="$(sed -n 's/^id:[[:space:]]*//p' "$sse")"
probe -b "$cookie" -D "$resume_headers" -o "$resume" -H 'Accept: text/event-stream' -H "Last-Event-ID: $event_id" "https://anvil.sinsan.kr/api/runs/$run_id/events"
tr '[:upper:]' '[:lower:]' < "$resume_headers" | tr -d '\r' | grep -Eq '^content-type:[[:space:]]*text/event-stream([;[:space:]]|$)' || { echo 'resume SSE content type mismatch' >&2; exit 7; }
[[ ! -s "$resume" ]] || { echo 'Last-Event-ID replayed the only stored event' >&2; exit 7; }

telegram_receipt="$EVIDENCE/c21-telegram-post.json"; [[ ! -e "$telegram_receipt" ]] || { echo 'Telegram validation POST was already attempted; refusing replay' >&2; exit 8; }
identity="$(read_runtime_env TELEGRAM_ALLOWED_IDENTITIES)"; identity="${identity%%,*}"; chat_id="${identity%%:*}"; user_id="${identity#*:}"
[[ -n "$chat_id" && -n "$user_id" && "$chat_id" != "$identity" ]] || { echo 'Telegram allowlisted identity is invalid' >&2; exit 8; }
update_id="$(python3 -c 'import sys; print(int(sys.argv[1][:12],16))' "$EXPECTED")"; command_id="telegram-update-$update_id"
printf '{"status":"SENDING","release_commit":"%s","command_id":"%s","post_attempts":1,"secret_values":"omitted"}\n' "$EXPECTED" "$command_id" > "$telegram_receipt.tmp.$$"; chmod 600 "$telegram_receipt.tmp.$$"; mv -f "$telegram_receipt.tmp.$$" "$telegram_receipt"
telegram_payload="$(printf '{"update_id":%s,"message":{"chat":{"id":"%s"},"from":{"id":"%s"},"text":"/status"}}' "$update_id" "$chat_id" "$user_id")"; telegram_secret="$(read_runtime_env TELEGRAM_WEBHOOK_SECRET)"
set +e; telegram_status="$(curl --silent --show-error --connect-timeout 2 --max-time 3 -o "$telegram_body" -w '%{http_code}' -X POST -H 'Host: anvil.sinsan.kr' -H "X-Telegram-Bot-Api-Secret-Token: $telegram_secret" -H 'Content-Type: application/json' --data "$telegram_payload" https://anvil.sinsan.kr/integrations/telegram/webhook)"; telegram_rc=$?; set -e
python3 "$PROVISION" telegram-status --release "$EXPECTED" --environment "$environment_id" --telegram-command-id "$command_id" --output "$EVIDENCE/c21-telegram-db-status.json"
[[ "$(json_field "$EVIDENCE/c21-telegram-db-status.json" result.update_count)" == 1 && "$(json_field "$EVIDENCE/c21-telegram-db-status.json" result.audit_count)" == 1 ]] || { echo 'Telegram POST outcome is uncertain; no retry permitted' >&2; exit 8; }
[[ "$telegram_rc" == 0 && "$telegram_status" == 200 ]] || { echo 'Telegram response was uncertain but DB audit was preserved; no retry permitted' >&2; exit 8; }
python3 - "$telegram_receipt" <<'PY'
import json, os, sys
p=sys.argv[1]; v=json.load(open(p, encoding='utf-8')); v['status']='ACCEPTED_DB_VERIFIED'; t=p+'.tmp'; open(t,'w',encoding='utf-8').write(json.dumps(v,sort_keys=True,separators=(',',':'))+'\n'); os.chmod(t,0o600); os.replace(t,p)
PY

python3 "$PROBE" --output "$EVIDENCE/c21-provider-probe.json"
verification_ready=1
