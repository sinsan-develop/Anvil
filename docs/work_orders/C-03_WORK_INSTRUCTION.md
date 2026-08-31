# C-03 WorkInstruction — Developer Subagent read-only lifecycle

## 목표

C-02 DelegationPacket을 받아 Developer Subagent를 저장소 변경 없이 시작·대기·중지하고 raw result를 자동 수신하는 최소 M1 lifecycle을 구현한다.

## 범위

- DelegationPacket 검증 후 read-only 실행 세션의 `start`, `wait`, `stop` 상태 전이를 구현한다.
- 세션 상태(`PENDING`, `RUNNING`, `STOP_REQUESTED`, `COMPLETED`, `STOPPED`, `FAILED`)와 raw result envelope를 정의한다.
- 허용 경로 밖 write, secret read, external network를 차단하는 read-only policy를 적용한다.
- deterministic fake developer runner와 start/wait/stop/idempotency/invalid transition 테스트를 작성한다.

## 금지

- C-04 steer/resume, C-05 구조화 Result Envelope, 실제 subprocess·Provider·DB·browser·deployment 구현 금지
- 제품 파일·historical progress/event/hash 변경 금지

## 완료조건·검증

1. 유효 packet만 lifecycle을 시작한다.
2. start/wait/stop이 단조 상태 전이를 보장하고 중지 요청이 재실행에 안전하다.
3. raw result가 변경 없이 보존되고 read-only policy 위반은 거부된다.
4. 신규 테스트, compileall, `git diff --check` 통과.
5. 실제 Developer/외부 시스템 실행은 `NOT_EXECUTED`로 구분한다.

## 결과보고

`COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED`와 변경 파일·정확한 명령/결과·미검증·rollback을 보고한다.
