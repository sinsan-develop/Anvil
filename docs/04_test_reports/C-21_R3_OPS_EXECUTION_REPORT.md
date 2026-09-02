# C-21 R3 운영 수직 검증 보고서

## 판정

`PARTIAL / TELEGRAM_ACCEPTED_PRECOUNT_CAPTURE_MISSING_SSE_NO_EVENT`

승인된 ysna-server Anvil 범위에서 공개 UI/API/health/OpenAPI와 테스트 세션 발급·인증 SSE 경계를 검증했다. fresh 담당자가 `2026-09-02T11:39:09Z`에 공개 URL로 Telegram signed `/status`를 정확히 1회 전송했고 HTTP 200 `ACCEPTED`를 확인했다. 요청에는 `--resolve`, `--connect-to`, Host override를 사용하지 않았다. 다만 POST 전 DB count capture가 psql stdin 오류로 누락되어 strict dynamic delta는 확정하지 않는다. 인증 SSE는 HTTP 200이지만 허용된 run에 이벤트가 없어 timeout으로 종료되었으며 `Last-Event-ID` successor 검증은 실행하지 않았다.

기존 HTTP 400 응답 파일의 timestamp는 `2026-09-01T22:36:05Z`로, 5b0 운영 배포 시각 `2026-09-02T11:12Z`보다 이전이다. 따라서 이 관측은 현재 5b0 release 증거로 사용할 수 없는 `HISTORICAL_UNBOUND`로 격리한다.

## 실행 경계

- 대상: `https://anvil.sinsan.kr` 및 ysna-server의 Anvil 컨테이너
- Anvil web 기준 commit: `5b0f3389dd6f54d1f7606ac99a36d237feda7b60` (fresh POST 시 current revision 및 healthy 확인)
- DB migration head: `0012`
- 실제 Telegram Bot API 호출: 금지 준수, 미실행
- Nginx Proxy Manager·타 서비스·internal 컨테이너 제거·소스 변경: 미수행
- secret, Authorization, cookie, payload 원문, signature: 출력·기록하지 않음

## 사전·사후 DB 상태

| 테이블 | 사전 | 사후 | 판정 |
|---|---:|---:|---|
| `telegram_webhook_updates` | `UNKNOWN` | 1 | post-count 확인, strict delta 미확정 |
| `telegram_webhook_audits` | `UNKNOWN` | 1 | post-count 확인, strict delta 미확정 |
| `telegram_webhook_rate_limits` | `UNKNOWN` | 1 | post-count 확인, strict delta 미확정 |

pre-count는 검증 스크립트의 psql stdin 오류로 capture되지 않았다. latest update와 audit의
timestamp는 모두 `2026-09-02T11:39:09Z`이며 fresh POST 시각과 일치한다.

## Telegram signed POST

- endpoint: public `/integrations/telegram/webhook`
- fixture: allowlisted identity, `/status` native Telegram-shaped update
- 실행 횟수: 정확히 1회 (재전송 없음)
- 요청 경로: 공개 URL 직접 호출, `--resolve`·`--connect-to`·Host override 없음
- HTTP: `200`
- 분류: `ACCEPTED`
- 실행 시각: `2026-09-02T11:39:09Z`
- 실행 시 runtime: full revision `5b0f3389dd6f54d1f7606ac99a36d237feda7b60`, healthy
- token·secret·Authorization·payload·signature: 미기록
- DB correlation: post-count는 updates/audits/rate_limits 각각 1, latest update/audit timestamp는 실행 시각과 일치
- path correlation: NPM과 application 양쪽에서 fresh POST 도달 상관관계 확인
- 한계: pre-count가 `UNKNOWN`이므로 strict dynamic delta는 미확정
- evidence: `docs/evidence/runtime/C-21_R3_TELEGRAM_REDACTED_RECEIPT.json`에 sanitized
  self-report와 NPM/application/DB correlation만 기록하고 SHA-256으로 manifest에 결박
- 실행 wrapper 한계: local numeric exit code는 보존되지 않았고, remote script는 POST 성공
  뒤 line 72 `unexpected EOF`로 종료됐다. 따라서 POST acceptance는 server-side correlation으로
  지지하지만 전체 검증 스크립트 성공은 주장하지 않는다.
- 결론: current 5b0 공개 경로에서 `ACCEPTED`는 확인했으나 승인된 1회를 모두 사용했으므로 추가 POST 금지

### Historical-unbound 관측

- timestamp: `2026-09-01T22:36:05Z`
- HTTP 400 `invalid host`
- 5b0 배포 시각 `2026-09-02T11:12Z` 이전 파일이므로 current release 판정에서 제외
- fresh 시도 횟수와 DB 판정에 합산하지 않음

## 테스트 세션 및 SSE

- `ANVIL_TEST_SESSION_*` required 설정: 모두 존재 여부만 확인
- public `POST /auth/session`: HTTP `201`
- session cookie/CSRF: 발급 여부만 확인, 원문 미기록
- public authenticated `GET /api/runs/{allowed_run}/events`: HTTP `200`
- first event metadata: 없음; response bytes `0`, 정확한 8초 timeout
- `Last-Event-ID` strict successor: `NOT_EXECUTED_NO_EVENT_ID`
- noncanonical event/DB seed: 미수행
- 임시 cookie/response/SSE 파일: 원격 종료 trap으로 삭제

## 공개 상태 및 경로

| 요청 | 결과 |
|---|---|
| `/` | HTTP 200 |
| `/health/live` | HTTP 200 |
| `/health/ready` | HTTP 200 |
| `/openapi.json` | HTTP 200 |
| `/api/providers` | HTTP 401 (`AUTHENTICATION_REQUIRED`) |

auth/session 및 SSE 요청은 public 경로에서 실행했다. 컨테이너 access log에는 해당 public 경로의 내부 API 도달을 식별할 수 있는 애플리케이션 로그가 없어 `anvil-web 도달/internal 미도달`을 로그만으로 독립 확정하지 않는다. 다만 internal 직접 endpoint는 호출하지 않았고, NPM/타 서비스 설정은 변경하지 않았다.

## 오류·미검증 범위

- Telegram strict dynamic DB delta: pre-count capture 누락으로 미확정
- 인증 SSE: 이벤트 부재로 successor 재개 미검증
- Telegram 실제 Bot API 발송: 미실행
- Provider probe: R2 보고서의 결과를 유지하며 R3에서 재실행하지 않음
- 공개 API의 인증 mutation 및 실제 run event seed: 미수행

fresh Telegram POST는 정확히 1회이며 재전송하지 않았다. 현재 미충족 fingerprint는
`C21-R3-TELEGRAM-PRECOUNT-CAPTURE-MISSING`이다. 과거 Host 400은
`C21-R3-TELEGRAM-HOST-BOUNDARY-400-HISTORICAL-UNBOUND`로만 보존한다.

## 설정 변경 및 rollback

이번 fresh Telegram 증거 수집에서는 소스·컨테이너·NPM 설정을 추가 변경하지 않았다.
현재 운영 runtime은 unified `anvil-web:3770`이며 server-only 설정은
`~/deploy/anvil/runtime/anvil.env`를 사용한다. rollback은 target release에서 exact 보존한
versioned Dockerfile과 `compose.public-preview.yml`로 previous source image를 build·기동하고,
container health, proxy-network/NPM DNS, `nginx -t`, graceful reload, bounded public live probe와
container log correlation을 모두 통과한 뒤에만 current alias를 변경해야 한다. legacy
internal web 재기동이나 preview `ANVIL_API_UPSTREAM` 복원은 rollback 절차가 아니다.
본 보고서에는 secret 값, identity, payload, update ID를 기록하지 않는다.

## 다음 조치

1. 별도 승인 없이는 Telegram POST를 추가하지 않는다.
2. Telegram strict delta가 필요하면 새로운 승인과 정상 pre-count capture를 먼저 확보한다.
3. 허용 run에 event가 생성된 승인된 환경에서만 인증 SSE first event와 `Last-Event-ID` successor를 재검증한다.
