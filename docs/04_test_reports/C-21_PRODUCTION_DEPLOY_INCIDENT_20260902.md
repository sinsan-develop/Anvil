# C-21 운영 배포 INCIDENT_HOLD 보고서

## 판정

`PARTIAL / TELEGRAM_ACCEPTED_PRECOUNT_CAPTURE_MISSING_SSE_NO_EVENT`

운영 배포 중 target container가 healthy가 된 뒤 최초 public live probe가 10초 timeout으로
실패하여 `INCIDENT_HOLD`에 진입했다. 자동 DB downgrade는 수행되지 않았고 migration
`0012_run_authority`를 유지했다. Main Agent가 exact target `5b0f3389dd6f54d1f7606ac99a36d237feda7b60`
image와 같은 commit의 compose blob으로 `anvil-web`을 healthy 상태로 복구했다.

## 운영 실행 사실

- 운영 FAILURE_REPORT: 동일 formal deploy failure 1회
- target release: `5b0f3389dd6f54d1f7606ac99a36d237feda7b60`
- DB migration: `0012_run_authority` 적용 및 유지
- backup:
  `/home/ubuntu/deploy/anvil/runtime/db-backups/anvil-20260902T111209Z-5b0f3389dd6f54d1f7606ac99a36d237feda7b60.dump`
- checksum sidecar: 위 경로에 `.sha256` suffix를 붙인 파일
- backup 검증: `sha256sum -c` 결과 `OK`; 실제 hash 문자열은 출력되지 않아 임의 기록하지 않음
- 최초 target container: healthy
- 최초 public live probe: curl 10초 timeout, 이후 `INCIDENT_HOLD`
- incident 진입 시 DB 자동 downgrade: 없음
- incident 진입 시 internal runtime: 보존
- incident 진입 시 Telegram NPM override: 보존

## rollback 실패와 복구

rollback 대상 previous release `8ba679e`의 compose는 runtime `env_file` 계약이 없고
preview `ANVIL_API_UPSTREAM` 설정을 사용했다. exact unified image를 해당 legacy compose로
기동하면서 `ANVIL_DATABASE_URL`이 주입되지 않아 container가 unhealthy가 됐다.

Main Agent 복구 후 확인 상태:

- `anvil-web`: exact target `5b0f338...` image + exact target compose blob, healthy
- NPM → anvil-web: HTTP 200
- local HTTPS: HTTP 200
- public `/health/live`, `/health/ready`, `/openapi.json`: HTTP 200
- NPM override backup SHA-256:
  `406052ff7d4764bd23d03d7bef48db01c9683f801c010dc41ba24c7d2d1593cf`
- NPM override: backup 후 제거, `nginx -t`와 graceful reload 성공, 현재 override 없음
- `anvil-internal-web-1`: healthy. 전체 수직 검증이 실패했으므로 제거하지 않고 보존

## 후속 수직 검증 상태

- Provider: 5 healthy / 4 unhealthy
- UPSTAGE: HTTP 401
- GEMINI: HTTP 400
- OPENAI: HTTP 401
- OLLAMA: timeout
- Telegram signed POST: fresh 담당자가 `2026-09-02T11:39:09Z` 공개 URL로
  `--resolve`·`--connect-to`·Host override 없이 정확히 1회 실행, HTTP 200 `ACCEPTED`
- Telegram post DB counts: updates/audits/rate_limits 각각 1; latest update/audit timestamp
  `2026-09-02T11:39:09Z`; NPM/application path correlation 확인
- Telegram 한계: pre-count psql capture가 stdin 오류로 누락되어 strict dynamic delta는
  `UNKNOWN`; 재전송 0회이며 추가 POST 금지
- historical-unbound: `2026-09-01T22:36:05Z` HTTP 400 파일은 5b0 배포
  `2026-09-02T11:12Z` 이전이므로 current evidence에서 제외
- auth session: HTTP 201
- authenticated SSE: HTTP 200, event 0건
- Last-Event-ID: event가 없어 미실행

위 결과는 C-21 전체 운영 완료를 의미하지 않는다.

## 코드 보완

1. rollback은 target release의 versioned Dockerfile과 compose를 checkout 전에 runtime
   temp에 각각 추출하고 SHA-256 exact 검증한다.
2. previous source는 보존 Dockerfile로 직접 build하고, runtime은 보존 compose와
   `ANVIL_RUNTIME_ENV_FILE`을 사용하여 `--no-build`로 기동한다.
3. public live/ready/OpenAPI probe는 connect timeout 2초, max-time 3초, 최대 5회,
   재시도 간 2초로 제한한다.
4. 고유 live probe log correlation은 최대 10회, 재시도 간 1초로 제한한다.
5. 모든 시도 실패 시 기존과 같이 `INCIDENT_HOLD`로 전환하며 DB downgrade는 하지 않는다.

## 로컬 TDD 증거와 경계

- RED: public 첫 timeout, persistent timeout, legacy previous compose env 누락은
  `3 failed`; log 첫 miss와 persistent log miss는 `2 failed`로 합계 5건 재현
- focused GREEN: `5 passed in 18.32s`
- pipeline GREEN: `14 passed in 38.35s`
- 전체 `tests/deploy`: `40 passed in 41.96s`
- bootstrap/deploy/rollback/NPM removal 4개 `bash -n`: PASS
- fixture cleanup 출력 확인 명령의 PowerShell parameter typo 1회가 있었으나 제거 동작은
  먼저 완료됐고, 후속 read-only 조회에서 `C:\tmp\anvil-c21-operational-*` 잔여 0건 확인
- 실제 운영 재배포·SSH·DB·NPM·Telegram·Provider 호출은 이 수정 작업에서 수행하지 않음
- secret, DSN, token, payload, cookie, signature 원문은 기록하지 않음
