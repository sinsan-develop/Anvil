# B-02 Rework InvocationPrompt Revision 2

- invocation_artifact_id: `INV-B-02-20260814-002`
- work_instruction_artifact_id: `WI-B-02-20260814-002`
- work_instruction_path: `docs/work_orders/B-02_REWORK_WORK_INSTRUCTION_R2.md`
- work_instruction_content_hash: `89EC3E369CEAB820148408F9A2635767FBE9E5ECADC963C4311AE703A23A74F8`
- source_test_report_sha256: `1B2F3A70056BB50AAA01229A86EC6D8A5B2B74B5A797B35FC4E505AAAED419F1`
- executor_role: `developer-primary-b02`
- execution_mode: `SCOPED_REWORK_REVISION_2`

위 hash로 결박되는 revision 2 WorkInstruction만 test-first로 실행하라. `BLK-B02-001`의 runtime 필드 의미만 고치고 epoch-2 fencing과 exact 4 paths를 먼저 확인한다. R1 source/runtime evidence와 Tester report는 수정하지 않는다. R2 RED→GREEN evidence를 제출하되 B-02 acceptance, B-03, commit/push 또는 runtime 재실행을 수행하지 않는다.
