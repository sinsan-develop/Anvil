# C-21 Workbench UI WSL authenticated browser probe R1

## 판정

`COMMIT_READY` 후보. env-only actual probe와 schema-only self-test를 구현했으며 실제 WSL runtime은 `NOT_EXECUTED`다.

## 구현

- 세 viewport의 실제 UI click, Provider list/detail, Run Event, status/alert, overflow, keyboard focus, accessible name을 기록한다.
- authenticated SSE 초기 연결과 `Last-Event-ID` 재개를 화면 action과 network ledger로 확인한다.
- Provider READ GET 외 Provider write, cross-origin, fixture API를 fail-closed한다.
- screenshot은 path 없는 `page.screenshot()` Buffer로만 캡처한다. filesystem file/directory 생성과 residue는 0이며 receipt에는 logical relative name, bytes, SHA-256만 남긴다. screenshot root 환경변수는 fail-closed 거부한다.
- 재개 요청은 `Last-Event-ID`의 존재만 보지 않고 첫 event ID와 exact 동일함을 검사한다.
- CLI credential/run-id를 거부하고 stdout에 정렬된 canonical JSON receipt 1건만 출력한다.

## 검증

- TDD focused: `7 passed, 231 deselected`
- final full tooling: `606 passed in 1320.29s (0:22:00)`
- Web: `12 passed`
- API: `41 passed`
- existing actual headless workbench click/network self-test: PASS
- Node syntax, live checker, diff-check: PASS

## 미실행

WSL actual probe/screenshot, Provider 외부 호출, Telegram, ysna, main merge, C-01은 실행하지 않았다.

- 판정: `READY_FOR_C21_WORKBENCH_UI_WSL_AUTH_BROWSER_RUNTIME_EXECUTION`
- 구현: 환경변수 전용 `--wsl-workbench-auth`, 3 viewport, UI click/SSE/Last-Event-ID, 접근성·overflow·request·secret-safety·screenshot metadata receipt 계약
- self-test: schema-only이며 actual browser acceptance 증거가 아니다.
- runtime: `NOT_EXECUTED`
- Provider·Telegram·WSL·ysna·main·C-01: `NOT_EXECUTED`
- C-21: `BLOCKED_NOT_ACCEPTED`; DIR-2: `NOT_TRIGGERED`
