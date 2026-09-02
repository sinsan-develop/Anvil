# C-21 R3 운영 수직 검증 보고서

## 판정

`PARTIAL / TELEGRAM_HOST_BOUNDARY_FAILED_SSE_NO_EVENT`

승인된 ysna-server Anvil 범위에서 공개 UI/API/health/OpenAPI와 테스트 세션 발급·인증 SSE 경계를 검증했다. Telegram signed `/status`는 이번 실행에서 정확히 1회 전송했으나 HTTP 400 `invalid host`로 거부되었고 DB side effect는 없었다. 인증 SSE는 HTTP 200이지만 허용된 run에 이벤트가 없어 timeout으로 종료되었으며 `Last-Event-ID` successor 검증은 실행하지 않았다.

## 실행 경계

- 대상: `https://anvil.sinsan.kr` 및 ysna-server의 Anvil 컨테이너
- Anvil web 기준 commit: `5b0f338` (운영 확인값)
- DB migration head: `0012`
- 실제 Telegram Bot API 호출: 금지 준수, 미실행
- Nginx Proxy Manager·타 서비스·internal 컨테이너 제거·소스 변경: 미수행
- secret, Authorization, cookie, payload 원문, signature: 출력·기록하지 않음

## 사전·사후 DB 상태

| 테이블 | 사전 | 사후 | 판정 |
|---|---:|---:|---|
| `telegram_webhook_updates` | 0 | 0 | side effect 없음 |
| `telegram_webhook_audits` | 0 | 0 | audit 없음 |
| `telegram_webhook_rate_limits` | 0 | 0 | rate state 없음 |

## Telegram signed POST

- endpoint: public `/integrations/telegram/webhook`
- fixture: allowlisted identity, `/status` native Telegram-shaped update
- 실행 횟수: 정확히 1회 (재전송 없음)
- HTTP: `400`
- 분류: `invalid host`
- token·secret·Authorization·payload·signature: 미기록
- DB correlation: 세 webhook 테이블 모두 `0 → 0`
- 결론: webhook transport 도달은 했지만 application Host allowlist boundary에서 실패했다. 승인 횟수 소진으로 추가 POST 금지.

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

- R3 signed POST: `invalid host`, 유효한 운영 side effect 미생성
- 인증 SSE: 이벤트 부재로 successor 재개 미검증
- Telegram 실제 Bot API 발송: 미실행
- Provider probe: R2 보고서의 결과를 유지하며 R3에서 재실행하지 않음
- 공개 API의 인증 mutation 및 실제 run event seed: 미수행

이번 실행에서 동일 근본 원인 오류를 재시도하지 않았다. Host 실패는 `C21-R3-TELEGRAM-HOST-BOUNDARY-400`으로 기록한다.

## 설정 변경 및 rollback

이번 최신 R3 실행에서는 소스·컨테이너·NPM 설정 변경이 없었다. 기존 운영 `.env`의 공개 Host 설정은 실행 컨테이너에서 존재 여부만 확인했다. 이전 승인 조치로 생성된 `.env` 백업은 원격에 보존되어 있으며, 환경 변경이 필요할 경우 해당 백업으로 복원한 뒤 internal web만 재기동해야 한다. 본 보고서에는 경로·파일명 외 secret 값은 기록하지 않는다.

## 다음 조치

1. Main Agent가 `invalid host`의 실제 정규화 Host metadata를 기존 구현 보고서와 대조한다.
2. 별도 승인 없이는 Telegram POST를 추가하지 않는다.
3. 허용 run에 event가 생성된 승인된 환경에서만 인증 SSE first event와 `Last-Event-ID` successor를 재검증한다.
