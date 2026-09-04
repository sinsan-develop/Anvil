#!/usr/bin/env bash
set -euo pipefail
EXPECTED="${1:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"
require_exact_sha "$EXPECTED" || exit $?
ROOT="${ANVIL_WSL_DEPLOY_ROOT:-/srv/anvil-wsl}"
REPO="$ROOT/repo"
MANIFEST_REF="${ANVIL_CANDIDATE_MANIFEST_REF:?candidate manifest control ref is required}"
: "${ANVIL_CANDIDATE_MANIFEST_SHA256:?candidate manifest checksum is required}"
source "$SCRIPT_DIR/candidate-manifest-guard.sh"
validate_wsl_candidate_manifest "$REPO" "$MANIFEST_REF" "$EXPECTED"
load_server_environment "$ROOT/.env"
mkdir -p "$ROOT/evidence" "$ROOT/backups"

for target in 15 18-rc; do
  configure_wsl_target "$target"
  ANVIL_RELEASE_COMMIT="$EXPECTED"
  export ANVIL_RELEASE_COMMIT
  [[ "$(cat "$ROOT/runtime/$ANVIL_TARGET_SLUG/current.sha")" == "$EXPECTED" ]] || { echo "deployed SHA mismatch for $target" >&2; exit 5; }
  [[ "$(git -C "$REPO" rev-parse HEAD)" == "$EXPECTED" && -z "$(git -C "$REPO" status --porcelain)" ]] || { echo 'checkout must remain clean and detached at the candidate' >&2; exit 5; }
  base="http://127.0.0.1:$ANVIL_WSL_HTTP_PORT"
  origin="$base"
  migration="$(wsl_compose exec -T anvil-db psql -U anvil_app -d anvil -Atqc 'select version_num from alembic_version')"
  [[ "$migration" == 0013_task_bootstrap_authority ]] || { echo "migration head mismatch for $target" >&2; exit 6; }
  curl -fsS -H "Host: 127.0.0.1:$ANVIL_WSL_HTTP_PORT" "$base/" >/dev/null
  ready="$(curl -fsS -H "Host: 127.0.0.1:$ANVIL_WSL_HTTP_PORT" "$base/health/ready")"
  [[ "$ready" == *'"migration_head":"0013_task_bootstrap_authority"'* ]] || { echo 'readiness contract mismatch' >&2; exit 6; }
  openapi="$(curl -fsS -H "Host: 127.0.0.1:$ANVIL_WSL_HTTP_PORT" "$base/openapi.json")"
  [[ "$openapi" == *'"/api/runs/{id}/events"'* ]] || { echo 'SSE OpenAPI path missing' >&2; exit 6; }

  run_id="${ANVIL_TEST_SESSION_RUN_IDS%%,*}"
  request_hash="sha256:$(printf '%064d' 0)"
  wsl_compose exec -T anvil-db psql -v ON_ERROR_STOP=1 -U anvil_app -d anvil \
    -v run_id="$run_id" -v request_hash="$request_hash" <<'SQL'
INSERT INTO tasks (task_id,project_id,repository_id,title,objective,requested_by,status,version)
VALUES ('c21-wsl-task', 'c21-wsl-project', 'c21-wsl-repository', 'WSL validation', 'Validate SSE', 'c21-wsl-validator', 'CONFIRMED', 1)
ON CONFLICT (task_id) DO NOTHING;
INSERT INTO runs (run_id,task_id,baseline_id,phase,status,version)
VALUES (:'run_id','c21-wsl-task','c21-wsl-baseline','ANALYZING','ACTIVE',1)
ON CONFLICT (run_id) DO NOTHING;
INSERT INTO run_events (event_id,run_id,sequence_no,event_type,actor_type,actor_id,correlation_id,idempotency_key,expected_version,applied_version,request_hash,payload,created_at)
VALUES ('c21-wsl-event',:'run_id',1,'TASK_CONFIRMED','HUMAN','c21-wsl-validator','c21-wsl-correlation','c21-wsl-idempotency',0,1,:'request_hash','{}',CURRENT_TIMESTAMP)
ON CONFLICT (event_id) DO NOTHING;
SQL
  cookie="$(mktemp)"; session="$(mktemp)"; headers="$(mktemp)"; body="$(mktemp)"; resume="$(mktemp)"
  trap 'rm -f "$cookie" "$session" "$headers" "$body" "$resume"' EXIT
  curl -fsS -c "$cookie" -o "$session" -X POST -H "Host: 127.0.0.1:$ANVIL_WSL_HTTP_PORT" -H "Origin: $origin" \
    -H "Authorization: Bearer $ANVIL_TEST_SESSION_BOOTSTRAP_TOKEN" "$base/auth/session"
  curl -fsS -b "$cookie" -D "$headers" -o "$body" -H 'Accept: text/event-stream' "$base/api/runs/$run_id/events"
  grep -Eqi '^content-type:[[:space:]]*text/event-stream' "$headers" || { echo 'SSE content type mismatch' >&2; exit 7; }
  [[ "$(grep -c '^event: TASK_CONFIRMED$' "$body")" == 1 ]] || { echo 'initial SSE event mismatch' >&2; exit 7; }
  event_id="$(sed -n 's/^id:[[:space:]]*//p' "$body")"
  curl -fsS -b "$cookie" -o "$resume" -H 'Accept: text/event-stream' -H "Last-Event-ID: $event_id" "$base/api/runs/$run_id/events"
  [[ ! -s "$resume" ]] || { echo 'Last-Event-ID replayed an acknowledged event' >&2; exit 7; }

  dump="$ROOT/backups/$ANVIL_TARGET_SLUG/$EXPECTED/round-trip.dump"
  mkdir -p "$(dirname "$dump")"; umask 077
  wsl_compose exec -T anvil-db pg_dump -U anvil_app -d anvil -Fc > "$dump.tmp.$$"
  wsl_compose exec -T anvil-db pg_restore --list < "$dump.tmp.$$" >/dev/null
  mv -f "$dump.tmp.$$" "$dump"; chmod 600 "$dump"
  scratch="anvil_restore_${ANVIL_TARGET_SLUG}"
  wsl_compose exec -T anvil-db dropdb -U anvil_app --if-exists "$scratch"
  wsl_compose exec -T anvil-db createdb -U anvil_app "$scratch"
  wsl_compose exec -T anvil-db pg_restore -U anvil_app -d "$scratch" --exit-on-error < "$dump"
  restored="$(wsl_compose exec -T anvil-db psql -U anvil_app -d "$scratch" -Atqc "select count(*) from run_events where run_id='$run_id'")"
  [[ "$restored" == 1 ]] || { echo "restore round trip mismatch for $target" >&2; exit 8; }
  wsl_compose exec -T anvil-db dropdb -U anvil_app "$scratch"
  rm -f "$cookie" "$session" "$headers" "$body" "$resume"; trap - EXIT
  printf '{"status":"VERIFIED","release_commit":"%s","postgres_target":"%s","migration_head":"0013_task_bootstrap_authority","authenticated_sse":"PASS","last_event_id":"PASS","same_origin":"PASS","backup_restore":"PASS","telegram":"NOT_EXECUTED","provider":"NOT_EXECUTED","secret_values":"omitted"}\n' \
    "$EXPECTED" "$target" > "$ROOT/evidence/$ANVIL_TARGET_SLUG-verification.json.tmp.$$"
  mv -f "$ROOT/evidence/$ANVIL_TARGET_SLUG-verification.json.tmp.$$" "$ROOT/evidence/$ANVIL_TARGET_SLUG-verification.json"
done
