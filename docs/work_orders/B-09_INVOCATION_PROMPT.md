# B-09 InvocationPrompt

- invocation_id: `INV-B-09-20260820-001`
- work_instruction_id: `WI-B-09-20260820-001`
- work_instruction_sha256: `648E8A8C95010D0F43EC2DFB7ACEF3919FA1B6D150EA12E15C513E5AE40D1F21`
- baseline_git_commit: `716398fe0a44d6dbce17c4378c78c8e9e0cb5962`
- agent_role: `developer-primary-b09`
- completion_report_path: `docs/completion_reports/B-09_COMPLETION_REPORT.md`

위 ID/hash의 WorkInstruction대로 test-first 수행하라. baseline, authority, B-06~B-08 acceptance, epoch-1 worker/write fencing token과 exact 15-path allowlist를 먼저 검증한다. 상세 요구를 복제하지 않으며 B-09 acceptance, B-10 intervention/budget, B-11 FastAPI/BFF/SSE/UI, B-12 process/PC recovery, provider, ysna/shared-db/production/deploy를 수행하거나 완료로 기록하지 않는다. 실제 DB 검증은 이후 Anvil 전용 격리 WSL PostgreSQL 18에서만 허용하며, 시작 시점과 실행하지 못한 범위는 `NOT_EXECUTED` 또는 `BLOCKED`로 보고한다.
