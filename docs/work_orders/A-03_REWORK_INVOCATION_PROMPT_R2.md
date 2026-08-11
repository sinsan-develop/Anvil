# A-03 Rework InvocationPrompt Revision 2

- invocation_artifact_id: `INV-A-03-20260811-002`
- work_instruction_artifact_id: `WI-A-03-20260811-002`
- work_instruction_path: `docs/work_orders/A-03_REWORK_WORK_INSTRUCTION_R2.md`
- work_instruction_content_hash: `6FBED907089748236B8CF7FA119E517EFB55CA92A693738F0BB20A93781C35ED`
- source_test_report_sha256: `DD89EB18AB4F16FB46C752734870DBC125D11AC38512EC1F79B25D47EEDC00D6`
- executor_role: `developer-primary-a03`
- execution_mode: `SCOPED_REWORK_REVISION_2`

위 hash로 고정된 revision 2 WorkInstruction만 실행하라. `A03-TST-BLK-001/002` 외 계약을 다시 열지 말고 active epoch-2 worker/write fencing을 먼저 확인한다. original WI·revision 1 evidence·completion progress·Tester report는 수정하지 않는다. RED→GREEN과 successor manifest를 제출하되 static evidence를 canonical L7 runtime PASS로 승격하지 않는다.
