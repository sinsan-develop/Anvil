# U-01 Task4 두 조합 WSL-server 격리 QA 자원 계획

## 판정

`READY_TO_PREPARE; ACTUAL_QA_NOT_EXECUTED`. 로컬 구현 `0dff0ea73650a8c4d1a5b426f295b1113f6682c1`은 두 신규 테스트 파일만 포함한다. 집중 로컬 22 PASS/1 opt-in SKIP, Node 자체 검사·구문 검사·Ruff·staged diff check는 통과했다. 이전 개발자 인접 묶음은 84 PASS/2 opt-in SKIP이었고, Main의 동일 인접 묶음 재실행은 장시간 무출력으로 중단했으므로 완료 결과로 사용하지 않는다. U-01은 `NOT_ACCEPTED`, Release `DEFER`, Production `NOT_EXECUTED`다.

## 생성 전 읽기 전용 대조

- `2026-10-09T16:49:33Z`, `ssh WSL-server`, 사용자 `daon` 확인. 공유 `anvil-web` ID `f0107aada3b2` healthy, 공유 `local-postgres` ID `99f3bf939d40` running; 다른 프로젝트 PG도 존재하므로 모두 보존한다.
- 전용 경로 `/home/daon/anvil-u01-two-pair-qa-0dff0ea-{checkout,material,browser}` 세 곳 모두 부재. WSL loopback `5546`·`8444` listener 없음. 캐시된 Playwright Chromium 1228/1234와 Node·Python은 존재한다.

## 정확한 일회성 범위

- 이 계획을 원격에 게시한 뒤 그 **최종 exact SHA**를 `development/codex/u01-dashboard-r2`에서 WSL-server의 위 `checkout`으로 Git clone/pull한다. checkout은 clean, 같은 branch·remote SHA로 확인한다. WSL에서 소스를 patch·개발하지 않는다.
- `material`에는 합성 OIDC/TLS/DB credential만 저장하고 owner `daon`·최소 권한을 사용한다. `browser`에는 격리 Chromium profile과 네 phase 증거만 저장한다. Secret 원문은 Git·보고서·명령 출력에 기록하지 않는다.
- 전용 Docker label `com.anvil.qa-run=anvil-u01-two-pair-qa-0dff0ea`, PG15 container `anvil-u01-two-pair-qa-0dff0ea-pg15`, network `anvil-u01-two-pair-qa-0dff0ea-net`, tmpfs 데이터, DB/user `anvil_u01_qa_0dff0ea`, host loopback `127.0.0.1:5546`만 사용한다. HTTPS 합성 issuer/app은 `anvil-f18-qa.local:8444`를 같은 전용 수명에서만 기동한다. 공유 Web/PG·다른 프로젝트 컨테이너/포트/DB는 변경하지 않는다.
- `granted → revoked → restored → other` 네 phase를 같은 전용 DB에서 순차 실행한다. 각각 exact pair 목록, 기간별 실제 PG audit 집계, OIDC 세션/권한, 화면·키보드·same-origin Network, 철회/복원, 증거 파일을 확인한다. 이전 R6 저장 Critical 실패는 별도 원인 조사이며 이 신규 하네스 PASS로 덮지 않는다.
- 기동 전에 실제 Docker image·mount·label·포트·공유 ID를 재확인한다. 자원 수명은 생성 후 최대 6시간 또는 QA 종료 직후 중 먼저 도래하는 때까지다. 종료 시 전용 프로세스/container/network/익명 volume/image tag와 위 세 정확 경로만 ID·owner·realpath·mount·symlink를 확인하고 정리하며, port·label·경로 잔여 0 및 공유 ID 불변을 기록한다. 실패해도 PASS로 승격하지 않는다.

## 다음 조치

본 계획과 상태를 현 branch에 기록·push해 exact SHA를 고정하고, WSL-server 전용 환경을 구축해 실측한다. 전용 환경 준비나 실제 테스트가 불가능한 항목은 원인과 미검증 범위를 `design_change.md` 및 `docs/WORK_STATUS.md`에 남긴다. 이 단계에서 PR/main 병합·새 branch·ysna-server/Production 작업은 하지 않는다.
