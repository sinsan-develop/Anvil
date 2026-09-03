# APPROVAL-20260903-C21-LIFECYCLE-RUNTIME-001

- approval_id: `APPROVAL-20260903-C21-LIFECYCLE-RUNTIME-001`
- approver: `신산님`
- approval_recorded_at: `2026-09-03 (Asia/Seoul)`
- approval_mode: `AUTHENTICATED_HUMAN_DIRECTION`
- subject_hash: `3A68623BF9426EB619AC0B8E082028F73442F90F4680FDCE871711B60A6B5FAD`
- scope: `lifecycle API runtime activation; production DB canonical C-21 test-chain creation; test-session write scope and allowlist change; deployment and validation external side-effect execution; C-01 start excluded`
- classification: `HUMAN_APPROVED_SEMANTIC_C21_LIFECYCLE_RUNTIME_SCOPE`
- baseline_git_commit: `1573e0242aa718d0f81f6b6fc936c754b7c75e60`

## 승인 문구

`lifecycle API runtime 활성화, production DB canonical C-21 테스트 체인 생성, 테스트 세션 write scope·allowlist 변경, 해당 변경 배포 및 검증용 외부 side effect 실행을 승인한다.`

위 문구의 UTF-8 SHA-256이 `subject_hash`다. 이 기록은 이전 `WAITING_APPROVAL` 경계를 해제하지만, 승인 문구에 없는 기능을 추가하지 않는다.

## 허용 범위

- 설계서 28.2/28.3의 일반 Task bootstrap API runtime을 C-21 lifecycle chain의 첫 단계로 구현·검증한다.
- 후속 승인된 WorkInstruction에서 production DB canonical C-21 test chain, test-session write scope·allowlist, 같은 변경의 배포 및 검증용 외부 side effect를 수행할 수 있다.
- 모든 외부 side effect는 대상 hash·환경·receipt·정리/rollback 경계를 해당 실행 EvidenceManifest에 기록한다.

## 명시적 제외

- C-01의 일반 시작, Agent/provider kernel, UI 기능, NPM/DNS/secret 정책 변경
- 승인 범위 밖 production 데이터, 결제 가능한 Provider 요청, 반복 Telegram/외부 호출
- 기존 seq1~389 event, historical Gate/approval, 이전 evidence의 수정 또는 재해석

## 결박 원칙

- LR-01은 이 승인 아래 일반 Task create/read API만 구현한다. production DB canonical chain, test-session write scope·allowlist 변경, 배포, 외부 side effect는 LR-01에서 실행하지 않는다.
- C-01은 계속 `BLOCKED_PENDING_C21_INDEPENDENT_JUDGMENT`이며 이 승인으로 WorkInstruction을 발행하거나 시작하지 않는다.
