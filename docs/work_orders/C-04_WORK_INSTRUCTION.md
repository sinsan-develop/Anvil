# C-04 WorkInstruction — steer·resume·handoff projection

## 목표

C-03 Developer lifecycle에 실행 중 steer, 중단 후 resume, 현재 작업 조회와 결과 handoff projection을 추가한다.

## 범위

- 세션에 대한 `steer`, `pause`, `resume`, `current`, `handoff` 명령과 단조 상태 전이를 구현한다.
- checkpoint handoff에 동일 delegation/session identity와 packet hash를 유지한다.
- 중단·재개·멱등·잘못된 명령을 deterministic in-memory service와 테스트로 검증한다.
- API projection은 framework-neutral dataclass/serializer로 제공하며 실제 HTTP/UI는 구현하지 않는다.

## 금지

- C-05 Result Envelope 이후 구조화 결과 검증, 실제 subprocess/Provider/DB/API/browser/deployment 호출 금지
- historical progress/event/hash 및 C-03 계약의 암묵적 변경 금지

## 완료조건·검증

1. 실행 중 steer가 다음 작업 지시로 기록되고 현재 session identity를 유지한다.
2. pause→resume가 checkpoint handoff로 복원되며 다른 packet hash는 거부된다.
3. terminal session에 대한 명령은 멱등 또는 명시적 거부다.
4. 테스트, compileall, `git diff --check` 통과.

## 결과보고

`COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED`와 변경 파일·명령·결과·미검증·rollback을 보고한다.
