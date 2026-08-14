# B-05 InvocationPrompt

- invocation_id: `INV-B-05-20260815-002`
- work_instruction_id: `WI-B-05-20260815-002`
- work_instruction_sha256: `DFC7BDECBECE0E6A2E48E68011D91E51AEB370A0E6CB67E1EA1ACBAE00F17A43`
- baseline_git_commit: `0a3a9bbf0c11ed53a5f5ff647591d48bc4d06565`
- agent_role: `developer-primary-b05`
- completion_report_path: `docs/completion_reports/B-05_COMPLETION_REPORT.md`

위 ID/hash의 교정된 WorkInstruction대로 test-first 수행하라. baseline, authority, predecessor acceptance, epoch-2 worker/write fencing token과 exact 15-path allowlist를 먼저 검증하고 폐기된 epoch-1 token은 사용하지 않는다. 상세 요구를 복제하지 않으며 B-05 acceptance, B-06, FastAPI/BFF/UI, provider, ysna/shared-db/production/deploy를 수행하거나 완료로 기록하지 않는다. WSL을 사용하는 경우 Anvil 전용 격리 PostgreSQL 자원만 생성·검증·삭제하고, 실제 실행하지 못한 범위는 `NOT_EXECUTED` 또는 `BLOCKED`로 보고한다.
