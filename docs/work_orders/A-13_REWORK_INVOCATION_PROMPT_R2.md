# A-13 Rework InvocationPrompt Revision 2

- invocation_artifact_id: `INV-A-13-20260812-002`
- work_instruction_artifact_id: `WI-A-13-20260812-002`
- work_instruction_path: `docs/work_orders/A-13_REWORK_WORK_INSTRUCTION_R2.md`
- work_instruction_content_hash: `A803A7A2C0810EB9E9F8521AEE1E5A66B99D71246888ECDAD193D233582EB46B`
- source_test_report_sha256: `90765FDA6C240AE04A7548B265BC4E2506E9E1878F93DE353ECFEE1AD736A986`
- executor_role: `developer-primary-a13`
- execution_mode: `SCOPED_REWORK_REVISION_2`

위 hash로 결박되는 revision 2 WorkInstruction만 test-first로 실행하라. `A13-TST-BLK-001/002` 외 계약과 scanner core를 다시 열지 말고 epoch-2 worker/write fencing을 먼저 확인한다. predecessor evidence와 Tester report는 수정하지 않는다. successor evidence와 RED→GREEN을 제출하되 실제 사용자 저장소·runtime·DIR PASS로 승격하지 않는다.
