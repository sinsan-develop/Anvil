# B-10 R3 InvocationPrompt

- invocation_id: `INV-B-10-20260821-003`
- work_instruction_id: `WI-B-10-20260821-003`
- work_instruction_sha256: `193734C3AD871D8042C0440342763A289DDCA70E1F862A143B357A1B8AABCF2D`
- baseline_git_commit: `5f644f45835329ef0195dae948d3c55ba7ff15af`
- source_tester_report_sha256: `23865D1722B231F04C7087328874A41D19431E5EE28C90AC71A3FACDA9D4F854`
- agent_role: `developer-primary-b10`
- completion_report_path: `docs/completion_reports/B-10_COMPLETION_REPORT.md`

위 ID/hash의 R3 WorkInstruction대로 test-first 수행하라. baseline/report와 epoch-3 fencing token, exact7을 먼저 확인하고 reservation-level terminal final overwrite를 RED로 재현한 뒤 exact canonical replay만 idempotent하게 허용하라. 다른 receipt ID 또는 canonical final 구성요소가 다른 replay는 fail closed하고, in-memory와 PostgreSQL 18에서 reservation-level identity 및 concurrent distinct receipt ID를 검증하라. exact7 밖을 수정하거나 B-10 acceptance, B-11/B-12, provider adapter, shared DB, ysna, production, deployment를 시작하지 않는다. 미실행 runtime과 잔여 위험은 정확히 보고한다.
