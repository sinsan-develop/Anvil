# Phase G Gate InvocationPrompt

- invocation_artifact_id: `INV-PHASE-G-GATE-20260810-001`
- work_instruction_id: `WI-PHASE-G-GATE-20260810-001`
- work_instruction_path: `docs/work_orders/PHASE_G_GATE_WORK_INSTRUCTION.md`
- work_instruction_sha256: `5F0172B7CADDBBA9086428AE5DD294F67F6D5BADD44573D4730E84E76D1BB7D7`

위 WorkInstruction의 실제 SHA-256을 먼저 검증하고 `reconstruction_contract`와 절차를 그대로 실행한다. 범위·검증·완료조건을 이 Invocation에서 재정의하지 않는다. 결과는 지정 산출물과 progress/HANDOFF에 기록하되 Developer 판정은 `COMPLETED / TEST_REVIEW`까지만 허용한다. 기능 범위·요구사항·중요 위험 변경 또는 실제 DIR 도달 때만 중단해 Main Agent에게 보고한다.
