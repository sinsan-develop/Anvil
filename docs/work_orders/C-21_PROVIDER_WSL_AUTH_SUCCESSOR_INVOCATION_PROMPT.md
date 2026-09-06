# C-21 Provider WSL Auth Successor 실행 프롬프트

`docs/work_orders/C-21_PROVIDER_WSL_AUTH_SUCCESSOR_WORK_INSTRUCTION.md`를 기준으로 `developer-primary`가 TDD로 구현한다.

- worker/write fencing token과 exact7을 확인한다.
- Provider READ exact3만 test session에 허용하고 mutation·유사 경로는 fail-closed한다.
- 기존 WSL `.env`에서는 scope 한 줄 외 bytes와 secret을 보존한다.
- 실제 Provider·Telegram 호출, ysna, main, DB migration을 수행하지 않는다.
- 완료 시 정확한 변경 경로·검증 명령·exit code·미검증 범위·rollback을 보고한다.

