# U-01 Task4 보고 통제 실행 지시

단일 Developer는 동명 WorkInstruction의 정확 2경로와 fail-closed 테스트 순서만 수행한다. Main이 A 문서의 원격 동일·clean, 유효한 worker/write token 및 통제 write 개방을 통지하기 전에는 코드·테스트 파일을 수정하지 않는다. 구현 결과는 변경 경로·diff, RED→GREEN 명령/종료 코드, 인접 회귀, 미검증, 잔여 위험, rollback을 포함한 `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED` 중 하나로 보고한다. Git commit/push·문서·제품·WSL-server 작업은 수행하지 않는다.
