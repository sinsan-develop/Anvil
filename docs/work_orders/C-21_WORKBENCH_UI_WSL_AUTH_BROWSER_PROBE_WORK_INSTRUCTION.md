# WI-C-21-WORKBENCH-UI-WSL-AUTH-BROWSER-PROBE-20260908-001

## 목적

WSL Workbench의 authenticated browser 인수 검증을 위한 환경변수 전용, secret-safe probe 계약을 Git-only로 준비한다.

## 범위

- `--wsl-workbench-auth`는 base URL, bootstrap token, Run ID를 환경변수에서만 읽고 screenshot은 path 없는 Buffer로 메모리에만 캡처한다. CLI credential/run-id 입력은 거부하며 screenshot-root 환경변수의 nonempty 입력도 fail-closed 거부한다.
- 1920x1080, 1440x900, 430x844에서 Provider list/detail, Run Event click, status/alert, overflow, keyboard focus, accessible name, SSE와 Last-Event-ID 재개를 사실대로 기록한다.
- Provider 요청은 READ GET만 허용하고 Provider write, cross-origin, fixture API 요청은 0이어야 한다.
- stdout은 canonical JSON receipt 1건만 허용한다. token, cookie/header, internal upstream, raw URL은 receipt와 screenshot metadata에 기록하지 않는다.
- screenshot은 `page.screenshot()`의 Buffer로만 캡처한다. filesystem file/directory 생성은 0이고 receipt에는 logical relative name, bytes, SHA-256만 기록한다. `ANVIL_SCREENSHOT_ROOT`와 이전 `ANVIL_WSL_WORKBENCH_SCREENSHOT_DIR`가 주어지면 fail-closed 거부한다.
- 재개 요청의 `Last-Event-ID` 값은 같은 viewport의 첫 event ID와 exact 동일해야 하며 missing·stale·wrong 값을 모두 거부한다.
- self-test는 receipt와 screenshot metadata schema만 검증하며 실제 WSL runtime을 실행하거나 PASS로 승격하지 않는다.

## 완료 조건

seq609~614 append-only, exact13/cumulative213, focused/browser/node/web/API/full tooling, live checker와 Git direct-child 검증을 통과한다. 실제 WSL/Provider/Telegram/ysna/main은 실행하지 않는다.
