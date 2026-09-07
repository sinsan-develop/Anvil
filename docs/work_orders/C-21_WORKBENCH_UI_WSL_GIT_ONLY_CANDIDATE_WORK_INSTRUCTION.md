# C-21 Workbench UI WSL Git-only candidate WorkInstruction

- ID: `WI-C-21-WORKBENCH-UI-WSL-GIT-ONLY-CANDIDATE-20260907-001`
- 실행자: `developer-primary`
- 기준 commit: `468b1408f6e817d20d68c46a79ba44dc82cb4b3d`
- 제품 commit: `7eb2cc291bda729e21deebbed86376eac4db7c2b`
- 이벤트: seq585~590 append-only
- 상태: `GIT_ONLY_CANDIDATE_BOUND_PENDING_PRIVATE_ATOMIC_CAS`

## 범위

1. S direct-child commit에서 seq585~587과 exact10 start/candidate projection을 기록한다.
2. K direct-child commit에서 seq588~590과 exact12 control binding을 기록한다.
3. 새 private candidate ref는 `refs/heads/candidates/c21-wsl-exact187`로 결박한다.
4. 기존 `c21-wsl-exact107` candidate와 seq1~584 및 historical evidence를 변경하지 않는다.
5. Candidate manifest와 guard는 private candidate/control atomic CAS 이전 상태를 fail-closed로 검증한다.

## 경계

- `accepted=false`
- C-21: `BLOCKED_NOT_ACCEPTED`
- C-01: `BLOCKED_PENDING_C21_ACCEPTANCE`
- DIR-2: `NOT_TRIGGERED`
- 최소 test-session scope: `tasks:write,tasks:read,run:events:read,provider:read`
- Provider/Telegram: `NOT_EXECUTED`
- push, WSL, Docker, DB, ysna, main merge: `NOT_EXECUTED`

## 금지 경로

`deploy.sh`, `verify.sh`, `rollback.sh`, `cleanup.sh`, Compose, nginx, Dockerfile은 변경하지 않는다. 기존 guard 정의와 historical evidence는 보존한다.

