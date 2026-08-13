# B-01 Rework InvocationPrompt Revision 2

- invocation_artifact_id: `INV-B-01-20260813-002`
- work_instruction_artifact_id: `WI-B-01-20260813-002`
- work_instruction_path: `docs/work_orders/B-01_REWORK_WORK_INSTRUCTION_R2.md`
- work_instruction_content_hash: `0DB329051E34218DE1CBBD20E1221CA1E29DFA5B32C174FF91B508272B9FEFAF`
- source_test_report_sha256: `3215F8C1BF8BDFCED692C7AE86B7ABE0D26A8712C41B9E31B7C8481474BEEED8`
- executor_role: `developer-primary-b01`
- execution_mode: `SCOPED_REWORK_REVISION_2`

위 hash로 결박되는 revision 2 WorkInstruction만 test-first로 실행하라. `BLK-B01-001` 세 hostile 입력 외 계약과 R1 산출물을 다시 열지 말고 epoch-2 worker/write fencing과 exact 5 paths를 먼저 확인한다. R1 evidence와 Tester report는 수정하지 않는다. R2 RED→GREEN evidence를 제출하되 B-01 acceptance, B-02, commit/push 또는 실제 runtime·배포 PASS로 승격하지 않는다.
