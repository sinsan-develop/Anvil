# A-15 Artifact·§49 상태·API·화면 Field Trace

상태: `STATIC_TRACE_CONTRACT_ONLY / NOT ACTUAL PASS`  
사용자 UX 결정: `PENDING_USER_DECISION`  
DIR-1: `NOT_REACHED`

## 목적과 경계

이 문서는 설계서 §49.1~49.17의 canonical aggregate와 API draft를 A-14 Workbench read model에 연결한다. 화면·fixture·정적 문서는 원장이 아니며 canonical aggregate 또는 명시된 projection만 읽는다. A-15에서 API·DB·브라우저·Provider·secret·egress·배포·DIR을 실행하지 않았다.

## 계약 묶음

- `A-15_ARTIFACT_SCHEMA.json`: ProductValidation, Defect, ReleaseDecision, 승인, DIR, fencing, budget, egress, secret, evidence/release manifest, deployment/monitoring 원장.
- `A-15_API_DRAFT.json`: §49.15 same-origin 상대 API와 모든 mutation의 actor/role, idempotency, optimistic version, target hash, permission, reason, audit envelope. 구현이 아니다.
- `A-15_FIELD_TRACE_MATRIX.json`: artifact field → source aggregate/projection → API → A-14 화면 → permission → evidence/AV → runtime boundary.

## 불변식

1. source 없는 화면 필드와 화면/API만의 canonical write를 거부한다.
2. target 또는 environment가 다른 ProductValidation·ReleaseDecision·EvidenceManifest를 재사용하지 않는다.
3. worker lease와 write lease 모두의 현재 fencing token 없이는 mutation을 거부한다.
4. 화면에는 Secret 값과 raw token을 노출하지 않는다.
5. `RELEASE`, DIR continue, egress 확대, Apply/Deploy 승인 같은 사람 전용 결정을 Agent가 만들지 않는다.
6. A-15 Developer 결과는 독립 Tester PASS나 Main acceptance가 아니며 DIR-1을 만들지 않는다.

## A-14 계승 경계

A-14 R5 fixture browser findings closed 증거는 byte-stable predecessor로만 참조한다. R6 IAB는 `ENVIRONMENT_BLOCKED / NOT_EXECUTED`였고 A-15는 새 browser/runtime 실행을 하지 않았다. 따라서 이 trace의 화면 연결은 `FIXTURE / NOT ACTUAL PASS`다.
