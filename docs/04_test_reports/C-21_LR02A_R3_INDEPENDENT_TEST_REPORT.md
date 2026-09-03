# C-21 / LR-02A R3 independent test report

## 판정

`FAILURE_REPORT` — `C-21/LR-02A | LR02A_CANONICAL_DEPLOY_CONTRACT_NONEXECUTABLE_R1`의 동일 fingerprint 3차 유효 실패다. Developer를 중지하고 lease를 회수한 뒤 Main Agent가 직접 인수한다.

## Blocking findings

1. target commit rollback asset 로직은 구현됐지만 정상 deploy 성공 경로로 실행되지 않았고 `rollback-assets.current` pointer도 atomic 교체가 아니다.
2. 저장된 harness는 deploy invalid SHA, verify missing env, rollback missing previous의 입구 fail-closed만 실행하여 git·manifest·Docker·migration·rollback asset·HTTP 본문을 증명하지 않는다.
3. verify는 존재하지 않는 GET `/api/`, `/integrations/`, `/auth/`를 호출한다. 실제 API/method로 교체되지 않았고 session-cookie/run-SSE/Last-Event-ID 성공 harness가 없으며 `Content-Type` 비교가 대소문자를 구분한다.

## 독립 검증

- R3 raw7 checksum 7/7 일치, exact9 lease 일치
- actual 변경 35개는 repository exact36 부분집합
- deploy `39 passed`, 전체 API `84 passed`, tooling `83 passed`
- checker `PASS sequence=413 reporting=AUTO_CONTINUE`
- shell syntax, DRAFT JSON, diff-check PASS
- Docker/SSH/DB/NPM/DNS/browser/Telegram/Provider/운영 배포 `NOT_EXECUTED`

## Main takeover 요구

정상 성공 경로를 실행하는 격리 harness를 만들고, 실제 method/path와 인증 SSE resume를 검증하며, rollback pointer까지 atomic하게 교체해야 한다.
