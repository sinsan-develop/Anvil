# C-21 WSL rollback scope compatibility R1

## 판정

`COMPLETED_LOCAL_IMPLEMENTATION`; WSL 재실행 전 exact16 control commit 결박이 필요하다.

## 판단 이유

- Candidate exact4 및 historical exact3 scope를 commit별로 Manifest에 결박했다.
- rollback은 두 target의 marker, scope, image와 Compose render를 첫 mutation 전에 확인한다.
- mapped scope는 process-local로만 주입하며 health 성공 전 marker/receipt를 기록하지 않는다.
- `.env` 수정 명령은 없고 candidate scope 일치만 검증한다.
- 기존 runtime evidence는 PG15/PG18RC verify PASS, 최초 PG15 rollback unhealthy 중단, PG18 mutation 미시작, 표준 redeploy 후 양쪽 candidate healthy 복구다.

## 외부 경계

Provider, Telegram, WSL runtime, push, ysna, main merge는 이 패키지에서 실행하지 않았다.

## 로컬 검증 결과

- seq554 focused product: `3 passed, 105 deselected`
- historical rollback+allowlist focused: `10 passed in 22.27s`
- deploy 전체: `106 passed, 2 skipped in 888.04s`
- tooling 전체: `199 passed in 916.77s`
- live checker, rollback/guard `bash -n`, `git diff --check`: PASS

skip 2건은 Windows에서 POSIX mode 및 WSL Compose parser 조건을 직접 표현할 수 없는 기존 한계다. 로컬 계약 PASS는 실제 WSL rollback 성공 증거로 대체하지 않는다.
