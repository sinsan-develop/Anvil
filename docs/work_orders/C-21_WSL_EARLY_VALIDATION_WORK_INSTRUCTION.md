# C-21 WSL 선행검증 WorkInstruction

- WorkInstruction ID: `WI-C-21-WSL-EARLY-VALIDATION-20260904-001`
- package: `C-21/WSL-EARLY-VALIDATION`
- executor: `developer-primary-wsl`
- dispatch commit: `ca92b7845eda803cff3c432799642e4f9243d4d6`
- design baseline SHA-256: `DC7509CB76A4BF08A0AE4D6F802FFB747B670FAB93426D5636B14575F7BEF9A3`
- work plan SHA-256: `00F4B03E5C6A82D50268025A87EB86FAC52815D675B54216D7B69B5BD220DD18`
- approval: 신산님의 2026-09-04 명시 승인 문장
- execution environment: WSL-server Test/Staging

## 1. 승인된 목표

Phase F의 WSL 검증을 C-21 Phase C successor로 앞당긴다. `deploy/wsl`에 ysna와 분리된 Git-only staging harness와 candidate manifest/guard를 구현하고, WSL-server의 PostgreSQL 15 전용 DB와 별도 격리 PostgreSQL 18 RC에서 migration, API, authenticated SSE, Last-Event-ID, same-origin, backup/restore, application rollback을 실제 검증한다.

## 2. 강제 경계

- 서버는 승인 remote에서 fetch한 exact 40자 SHA의 clean detached checkout만 사용한다.
- candidate manifest control ref의 source commit은 승인 feature remote tip과 정확히 같아야 한다.
- manifest status는 `APPROVED_FOR_STAGING_VALIDATION`, environment는 `WSL_SERVER_TEST_STAGING`, target은 `[15, 18-rc]`다.
- migration 전에 대상별 custom-format backup과 `pg_restore --list` receipt가 있어야 한다.
- PG15와 PG18 RC는 Compose project, volume, port, receipt를 공유하지 않는다.
- restore는 대상별 scratch DB에 실제 수행하고 검증 후 scratch DB를 제거한다.
- rollback은 application image만 수행하며 공유 schema를 자동 downgrade하지 않는다.
- Telegram과 Provider 실제 호출, 실제 credential 사용 및 외부 egress는 금지한다. 런타임 필수값은 비운영 placeholder로만 주입하고 internal network로 outbound를 차단한다.
- `scp`, 서버 직접 patch, dirty checkout, main 병합, ysna 배포, DNS/TLS 변경은 금지한다.
- WSL 서비스 재시작, Windows 재부팅, Ubuntu 재등록, VHDX/ACL 변경은 금지한다.

## 3. 구현·검증 순서

1. candidate manifest/guard와 fail-closed entrypoint 계약을 RED로 확인한다.
2. 독립 WSL compose/bootstrap/deploy/verify/rollback을 최소 구현하고 GREEN을 확인한다.
3. Main Agent가 implementation commit을 만든다.
4. Main Agent가 그 exact SHA와 신산님 approval binding을 candidate manifest successor commit에 결박하고 feature remote에 push한다.
5. WSL-server에서 manifest control ref와 manifest checksum을 지정해 deploy한다.
6. PG15와 PG18 RC를 각각 검증하고 evidence receipt를 수집한다.
7. 이전 application image가 존재하는 target에서 rollback을 수행하고 health를 재검증한다.
8. 임시 cookie, scratch DB, 임시 파일을 정리하고 target별 runtime volume은 후속 독립 검증까지 보존한다.

## 4. 현재 write lease

- worker lease: `worker-lease-c21-wsl-successor-20260904-001`
- execution fencing: `c21-wsl-execution-fence-epoch-1-ca92b78`
- write lease: `write-lease-c21-wsl-successor-20260904-001`
- write fencing: `c21-wsl-write-fence-epoch-1-ca92b78`
- 범위: `deploy/wsl/**`, WSL harness 계약 테스트, 이 WorkInstruction/Invocation, C-21 WSL 보고서, successor event/progress/HANDOFF 및 그 checker 계약

## 5. 완료 조건

- local contract, Bash syntax, project checker, tooling test가 PASS한다.
- implementation SHA와 manifest control SHA가 commit/push된 뒤에만 실제 WSL 검증을 시작한다.
- 실제 WSL evidence는 PG15와 PG18 RC를 별도 판정하고 미실행 항목을 PASS로 승격하지 않는다.
- Telegram·Provider는 `NOT_EXECUTED`로 기록한다.
- Developer는 commit/push하지 않고 Main Agent에게 결과를 제출한다.
