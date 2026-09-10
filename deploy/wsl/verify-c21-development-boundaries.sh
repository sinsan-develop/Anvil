#!/usr/bin/env bash
set -euo pipefail

EXPECTED_CANDIDATE="a342d62391a44b349733d1468ac3b180761155ab"
EXPECTED_CONTROL="772afbd5eb55791ca7b5002d58378437ea496750"
EXPECTED_MANIFEST_SHA256="456a5240cd8be8a7739e9ac898b478ade5b8a2d68a67ced21b0fa023a30b120b"
EXPECTED_DEPLOY_SHA256="7b6ee6a02bed857299423f78c73d746b6f8ac8c0cc40e3a611ece06e43e1c1c0"
EXPECTED_VERIFY_SHA256="93e882d35c055535a7d989962fe0ee0ec49b91542eb462b655f1477dd2562a36"
EXPECTED_CLEANUP_SHA256="65e8aa6f5f02ab554ecf3f4fba1ceb16bd96616e952eb4d64d1285f183cc462d"
EXPECTED_PROJECTS=(anvil-wsl-pg15 anvil-wsl-pg18rc)
EXPECTED_VOLUMES=(anvil-wsl-pg15_anvil-db-data anvil-wsl-pg18rc_anvil-db-data)

contract() {
  printf '{"candidate":"%s","control":"%s","projects":["%s","%s"],"provider":"RECORDED_FIXTURE_ONLY","telegram":"OUTBOUND_FREE_WEBHOOK_ONLY","browser":"PAGE_EVALUATE_FETCH_SCOPE_ONLY"}\n' \
    "$EXPECTED_CANDIDATE" "$EXPECTED_CONTROL" "${EXPECTED_PROJECTS[0]}" "${EXPECTED_PROJECTS[1]}"
}

verify_control_binding() {
  local root="${ANVIL_WSL_DEPLOY_ROOT:-/srv/anvil-wsl}" base active active_path head actual name expected item
  base="$root/control"
  [[ -f "$base/active" ]] || { echo 'active control pointer missing' >&2; return 9; }
  active="$(tr -d '\r\n' < "$base/active")"
  [[ "$active" == stage.* && -d "$base/$active" ]] || { echo 'active control pointer invalid' >&2; return 9; }
  active_path="$(cd "$base/$active" && pwd -P)"
  [[ "$active_path" == "$base"/stage.* ]] || { echo 'active control escaped control root' >&2; return 9; }
  head="$(git -c safe.directory="$active_path" -C "$active_path" rev-parse HEAD)"
  [[ "$head" == "$EXPECTED_CONTROL" ]] || { echo 'active control HEAD mismatch' >&2; return 9; }
  [[ -z "$(git -c safe.directory="$active_path" -C "$active_path" status --porcelain)" ]] || { echo 'active control checkout is dirty' >&2; return 9; }
  git -c safe.directory="$active_path" -C "$active_path" merge-base --is-ancestor "$EXPECTED_CANDIDATE" "$EXPECTED_CONTROL" || { echo 'candidate/control ancestry mismatch' >&2; return 9; }
  for item in \
    "CandidateReleaseManifest.json:$EXPECTED_MANIFEST_SHA256" \
    "deploy.sh:$EXPECTED_DEPLOY_SHA256" \
    "verify.sh:$EXPECTED_VERIFY_SHA256" \
    "cleanup.sh:$EXPECTED_CLEANUP_SHA256"; do
    name="${item%%:*}"; expected="${item#*:}"
    actual="$(git -c safe.directory="$active_path" -C "$active_path" show "$EXPECTED_CONTROL:deploy/wsl/$name" | sha256sum | cut -d' ' -f1)"
    [[ "$actual" == "$expected" ]] || { echo "immutable control binding mismatch: $name" >&2; return 9; }
  done
  printf '{"active_control":"%s","candidate_ancestor":true,"immutable_action_binding":"PASS"}\n' "$head"
}

verify_remote_runtime() {
  local root="${ANVIL_WSL_DEPLOY_ROOT:-/srv/anvil-wsl}" project target port base body secret update_id before after outcomes logs audit_rows migration runtime_revision auth_count sse_count telegram_count error_count
  verify_control_binding >/dev/null
  [[ "$(git -c safe.directory="$root/repo" -C "$root/repo" rev-parse HEAD)" == "$EXPECTED_CANDIDATE" ]] || { echo 'candidate identity mismatch' >&2; return 10; }
  [[ -z "$(git -c safe.directory="$root/repo" -C "$root/repo" status --porcelain)" ]] || { echo 'candidate checkout is dirty' >&2; return 10; }
  for target in 15 18-rc; do
    if [[ "$target" == 15 ]]; then project=anvil-wsl-pg15; port=4770; else project=anvil-wsl-pg18rc; port=4870; fi
    base="http://127.0.0.1:$port"
    docker ps --format '{{.Label "com.docker.compose.project"}}|{{.Label "com.docker.compose.service"}}' \
      | grep -Fxq "$project|anvil-web" || { echo "runtime missing: $project" >&2; return 11; }
    secret="$(docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "${project}-anvil-web-1" | sed -n 's/^TELEGRAM_WEBHOOK_SECRET=//p')"
    [[ -n "$secret" ]] || { echo 'synthetic webhook secret missing' >&2; return 12; }
    before="$(docker exec "${project}-anvil-db-1" psql -U anvil_app -d anvil -Atqc 'select count(*) from telegram_webhook_audits')"
    update_id="$((15000 + port + before * 10))"
    body="$(printf '{"update_id":%s,"message":{"chat":{"id":"0"},"from":{"id":"0"},"text":"/status"}}' "$update_id")"
    first="$(curl --noproxy '*' -fsS -X POST -H "Host: 127.0.0.1:$port" -H "X-Telegram-Bot-Api-Secret-Token: $secret" -H 'Content-Type: application/json' --data-binary "$body" "$base/integrations/telegram/webhook")"
    second="$(curl --noproxy '*' -fsS -X POST -H "Host: 127.0.0.1:$port" -H "X-Telegram-Bot-Api-Secret-Token: $secret" -H 'Content-Type: application/json' --data-binary "$body" "$base/integrations/telegram/webhook")"
    high="$(printf '{"update_id":%s,"message":{"chat":{"id":"0"},"from":{"id":"0"},"text":"/deploy"}}' "$((update_id + 1))")"
    third="$(curl --noproxy '*' -fsS -X POST -H "Host: 127.0.0.1:$port" -H "X-Telegram-Bot-Api-Secret-Token: $secret" -H 'Content-Type: application/json' --data-binary "$high" "$base/integrations/telegram/webhook")"
    [[ "$first" == *'"outcome":"ACCEPTED"'* && "$second" == *'"outcome":"REPLAYED"'* && "$third" == *'"outcome":"APPROVAL_REQUIRED"'* ]] || { echo 'Telegram outcome contract mismatch' >&2; return 12; }
    after="$(docker exec "${project}-anvil-db-1" psql -U anvil_app -d anvil -Atqc 'select count(*) from telegram_webhook_audits')"
    [[ $((after - before)) == 3 ]] || { echo 'Telegram durable audit count mismatch' >&2; return 12; }
    outcomes="$(docker exec "${project}-anvil-db-1" psql -U anvil_app -d anvil -Atqc "select string_agg(outcome,',' order by occurred_at) from (select outcome,occurred_at from telegram_webhook_audits order by occurred_at desc limit 3) x")"
    [[ "$outcomes" == *ACCEPTED* && "$outcomes" == *REPLAYED* && "$outcomes" == *APPROVAL_REQUIRED* ]] || { echo 'Telegram durable audit outcomes mismatch' >&2; return 12; }
    logs="$(docker logs --since 10m "${project}-anvil-web-1" 2>&1)"
    [[ "$logs" != *"$secret"* ]] || { echo 'Telegram webhook secret appeared in server logs' >&2; return 13; }
    audit_rows="$(docker exec "${project}-anvil-db-1" psql -U anvil_app -d anvil -At -F '|' -c "select audit_id,command_id,outcome from telegram_webhook_audits where command_id in ('telegram-update-$update_id','telegram-update-$((update_id + 1))') order by occurred_at,audit_id")"
    migration="$(docker exec "${project}-anvil-db-1" psql -U anvil_app -d anvil -Atqc 'select version_num from alembic_version')"
    runtime_revision="$(docker inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "${project}-anvil-web-1")"
    auth_count="$(grep -c 'POST /auth/session' <<<"$logs" || true)"
    sse_count="$(grep -c '/api/runs/c21-wsl-run/events' <<<"$logs" || true)"
    telegram_count="$(grep -c 'POST /integrations/telegram/webhook' <<<"$logs" || true)"
    error_count="$(grep -Eci 'traceback|exception|error' <<<"$logs" || true)"
    PROJECT="$project" MIGRATION="$migration" AUDIT_ROWS="$audit_rows" RUNTIME_REVISION="$runtime_revision" AUTH_COUNT="$auth_count" SSE_COUNT="$sse_count" TELEGRAM_COUNT="$telegram_count" ERROR_COUNT="$error_count" python3 - <<'PY'
import json, os
rows = [line.split("|", 2) for line in os.environ["AUDIT_ROWS"].splitlines() if line]
receipt = {
    "audit": {
        "count": len(rows),
        "records": [
            {"audit_id": audit_id, "command_id": command_id, "outcome": outcome}
            for audit_id, command_id, outcome in rows
        ],
    },
    "candidate": "a342d62391a44b349733d1468ac3b180761155ab",
    "control": "772afbd5eb55791ca7b5002d58378437ea496750",
    "control_action_binding": "PASS",
    "migration": os.environ["MIGRATION"],
    "project": os.environ["PROJECT"],
    "runtime_revision": os.environ["RUNTIME_REVISION"],
    "server_log": {
        "auth_requests": int(os.environ["AUTH_COUNT"]),
        "errors": int(os.environ["ERROR_COUNT"]),
        "secret_exposure": 0,
        "sse_requests": int(os.environ["SSE_COUNT"]),
        "telegram_requests": int(os.environ["TELEGRAM_COUNT"]),
    },
    "telegram": "PASS",
}
print(json.dumps(receipt, ensure_ascii=True, separators=(",", ":"), sort_keys=True))
PY
  done
}

verify_residue_zero() {
  local project volume
  for project in "${EXPECTED_PROJECTS[@]}"; do
    [[ -z "$(docker ps -aq --filter "label=com.docker.compose.project=$project")" ]] || { echo "container residue: $project" >&2; return 20; }
    [[ -z "$(docker network ls -q --filter "label=com.docker.compose.project=$project")" ]] || { echo "network residue: $project" >&2; return 20; }
  done
  for volume in "${EXPECTED_VOLUMES[@]}"; do
    ! docker volume inspect "$volume" >/dev/null 2>&1 || { echo "volume residue: $volume" >&2; return 20; }
  done
  printf '{"cleanup":"PASS","containers":0,"networks":0,"volumes":0}\n'
}

case "${1:-}" in
  --contract) contract ;;
  --verify-control) verify_control_binding ;;
  --verify-running) verify_remote_runtime ;;
  --residue-zero) verify_residue_zero ;;
  *) echo 'usage: verify-c21-development-boundaries.sh --contract|--verify-running|--residue-zero' >&2; exit 2 ;;
esac
