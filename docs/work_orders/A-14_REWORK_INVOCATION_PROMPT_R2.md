# A-14 Rework InvocationPrompt Revision 2

- invocation_artifact_id: `INV-A-14-20260812-002`
- work_instruction_artifact_id: `WI-A-14-20260812-002`
- work_instruction_path: `docs/work_orders/A-14_REWORK_WORK_INSTRUCTION_R2.md`
- work_instruction_content_hash: `73DE02532280784326FDCE67BBB50F0EE037BD7AB693A4F6C6D4741D525F0CD2`
- source_test_report_sha256: `6A53A135F7362563846252D223376692938317F3A0C4E3EF07B5C767A201C768`
- executor_role: `developer-primary-a14`
- execution_mode: `SCOPED_REWORK_REVISION_2`

위 hash의 revision 2 WorkInstruction만 test-first로 실행하라. `BLK-A14-002` clean-checkout successor raw-byte mismatch만 제품 finding으로 수정하고, `BLK-A14-001`은 in-app browser 재시도 후 환경 차단이면 PASS로 승격하지 않는다. `apps/web/**` 등 제품 17개 경로와 predecessor evidence/TestReport/progress는 수정하지 않는다. epoch-2 worker/write fencing을 확인하고 successor evidence와 RED→GREEN을 제출하라.