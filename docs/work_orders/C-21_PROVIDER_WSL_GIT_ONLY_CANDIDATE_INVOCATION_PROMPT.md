# C-21 Provider WSL Git-only Candidate 실행 프롬프트

`docs/work_orders/C-21_PROVIDER_WSL_GIT_ONLY_CANDIDATE_WORK_INSTRUCTION.md`를 canonical authority로 사용한다.

- dispatch source와 worker/write fencing token을 먼저 확인한다.
- K exact12 밖은 수정하지 않는다.
- candidate ref `refs/remotes/origin/candidates/c21-wsl-exact107`, predecessor remote control, source cumulative exact107을 fail-closed 결박한다.
- Stage S에서 push, WSL, Docker, DB, Provider, Telegram, ysna, main을 실행하지 않는다.
- 완료 시 변경 경로, 검증 명령·exit code, 미검증 범위, rollback을 보고한다.
