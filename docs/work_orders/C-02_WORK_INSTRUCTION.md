# C-02 WorkInstruction — DelegationPacket 권한·컨텍스트·egress 계약

## 목표

C-01 Main Agent Kernel에서 Developer Subagent로 전달되는 최소 `DelegationPacket` 계약을 구현한다.

## 범위

- 목표, 허용 경로, 금지 경로, 완료조건, baseline hash, DataEgressProfile hash를 불변 schema로 정의한다.
- 권한·컨텍스트·egress snapshot 누락 또는 불일치 시 packet 시작을 거부한다.
- JSON 직렬화/역직렬화와 deterministic validation reason code를 제공한다.
- 정상 packet, 필수 필드 누락, hash 불일치, 경로 충돌 테스트를 작성한다.

## 금지

- 실제 Developer launch/lifecycle(C-03 이후) 구현 금지
- 기존 historical progress/event/hash 및 C-01 코드 수정 금지
- secret·외부 Provider·DB·배포 호출 금지

## 완료조건

1. packet이 목표·허용·금지·완료조건·baseline·egress hash를 모두 요구한다.
2. canonical path와 hash가 검증된다.
3. 검증 실패는 구조화된 reason code로 반환된다.
4. JSON round-trip 및 hostile 누락/변조 테스트가 통과한다.

## 검증

- 신규 테스트, compileall, `git diff --check` 실행
- 실제 Provider·DB·API·browser·deployment는 `NOT_EXECUTED`

## 결과보고

`COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED`와 변경 파일·명령·결과·미검증·rollback을 포함한다.
