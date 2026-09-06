# C-21 Provider WSL Execution Resume 실행 프롬프트

`docs/work_orders/C-21_PROVIDER_WSL_EXECUTION_RESUME_WORK_INSTRUCTION.md`를 canonical authority로 사용한다.

- dispatch source와 worker/write fencing token을 먼저 확인한다.
- source commit은 `e6c562cf07bc2c35e24addb60efa9d90fae08046`이며 machine projection의 canonical token을 작업지시서와 대조한다.
- K exact14 밖을 수정하지 않는다.
- S와 K에서 commit, push, WSL, Docker, DB, Provider, Telegram, ysna, main을 실행하지 않는다.
- K direct-child commit 및 Main exact binding 전 runtime dispatch를 시도하지 않는다.
- 완료 시 변경 경로, 검증 명령·exit code, 미검증 범위와 rollback 관측 필요 조건을 보고한다.
- 준비 상태는 `READY_FOR_APPROVED_WSL_QA`까지만 기록한다. Git-only 준비와 실제 runtime 검증 결과를 구분한다.
