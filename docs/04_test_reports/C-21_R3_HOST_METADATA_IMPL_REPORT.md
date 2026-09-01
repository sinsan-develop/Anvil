# C-21 R3 Telegram Host metadata 진단 구현 보고서

## 판정

- 상태: `COMPLETED`
- 작업 브랜치: `codex/c21-host-metadata-impl2`
- 기준 HEAD: `1862d6e3122431dfd6ca62f9d1fbae9594859c7b`
- 담당: `c21_host_metadata_impl2`
- 범위: Telegram webhook Host 거부 경로의 credential-safe 구조화 진단

## 판단 이유

공통 Web 보안과 Telegram webhook은 Host를 각각 검증하지만, 기존 webhook 거부 경로는 `invalid host` 응답만 반환하여 실제 webhook 경계에서 정규화된 수신 Host와 허용 Host를 비교할 증거가 없었다.

이번 변경은 Host 불일치 시에만 다음 metadata를 WARNING 구조화 로그로 기록한다.

- `received_host`: 포트 제거, 소문자화, 좌우 공백 제거가 끝난 수신 Host
- `allowed_hosts`: 소문자화와 공백 제거 후 정렬된 허용 Host tuple

요청 body, Telegram secret header, 내부 signing secret 및 전체 headers는 기록하지 않는다. HTTP 상태와 응답 body는 기존 `400 {"error":"invalid host"}` 계약을 유지한다.

## 변경 파일

- `packages/api/telegram_webhook.py`
  - Host 검증에 사용한 정규화 값을 재사용한다.
  - Host 거부 분기에 credential-safe WARNING 구조화 로그를 추가한다.
- `tests/api/test_telegram_webhook.py`
  - 수신/허용 Host가 정규화되어 기록되는지 검증한다.
  - payload와 secret sentinel이 LogRecord에 포함되지 않는지 검증한다.
  - 기존 오류 응답 계약이 유지되는지 검증한다.
- `docs/04_test_reports/C-21_R3_HOST_METADATA_IMPL_REPORT.md`
  - 작업 상태, TDD 증거, 검증 범위와 다음 조치를 기록한다.

## TDD 및 검증 증거

### 기준선

```text
명령: ..\ysna-internal-deploy\.venv\Scripts\python.exe -m pytest tests/api/test_telegram_webhook.py -q
종료 코드: 0
결과: 8 passed in 0.72s
```

### RED

```text
명령: ..\ysna-internal-deploy\.venv\Scripts\python.exe -m pytest tests/api/test_telegram_webhook.py::test_webhook_logs_only_normalized_host_metadata_when_host_is_rejected -q
종료 코드: 1
결과: 1 failed in 0.69s
실패 이유: 기대한 구조화 진단 로그가 없어 caplog.records 길이가 0이었다.
```

### GREEN

```text
명령: ..\ysna-internal-deploy\.venv\Scripts\python.exe -m pytest tests/api/test_telegram_webhook.py::test_webhook_logs_only_normalized_host_metadata_when_host_is_rejected -q
종료 코드: 0
결과: 1 passed in 0.57s

명령: ..\ysna-internal-deploy\.venv\Scripts\python.exe -m pytest tests/api/test_telegram_webhook.py -q
종료 코드: 0
결과: 9 passed in 0.62s

명령: ..\ysna-internal-deploy\.venv\Scripts\python.exe -m pytest tests/api -q
종료 코드: 0
결과: 35 passed in 1.26s

최종 검증 명령: ..\ysna-internal-deploy\.venv\Scripts\python.exe -m pytest tests/api -q
종료 코드: 0
결과: 35 passed in 1.36s
```

## 미수행 및 운영 경계

- 배포: 수행하지 않음
- Telegram POST: 수행하지 않음
- Nginx Proxy Manager 변경·reload·restart: 수행하지 않음
- 운영 로그 확인: 배포하지 않았으므로 수행하지 않음
- DB 변경: 없음

## 다음 조치

Main Agent가 diff와 테스트 증거를 검토한 뒤 승인된 Git/배포 절차로 통합한다. 운영 배포 후 승인된 단일 Telegram 요청에서 `received_host`와 `allowed_hosts`만 확인하면 Host 불일치가 발생하는 정확한 애플리케이션 경계를 좁힐 수 있다.

## Rollback

이 작업 commit 하나를 revert하면 진단 로그와 해당 테스트만 제거되며 webhook 성공·거부 응답 계약에는 별도 데이터 migration이나 운영 정리가 필요하지 않다.
