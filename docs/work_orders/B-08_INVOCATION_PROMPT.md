# B-08 InvocationPrompt

- invocation_id: `INV-B-08-20260815-001`
- work_instruction_id: `WI-B-08-20260815-001`
- work_instruction_sha256: `655E40B3FE2C5834F3D7E143348DC99B411A2992A3381B3C45D6B36FB2AE2406`
- baseline_git_commit: `9913636f030aa248216f58e3251cfa181f491d9c`
- agent_role: `developer-primary-b08`
- completion_report_path: `docs/completion_reports/B-08_COMPLETION_REPORT.md`

위 ID/hash의 WorkInstruction대로 test-first 수행하라. baseline, authority, B-06~B-07 acceptance, epoch-1 worker/write fencing token과 exact 15-path allowlist를 먼저 검증한다. 상세 요구를 복제하지 않으며 B-08 acceptance, B-09, durable queue/scheduler/fencing, intervention/budget, FastAPI/BFF/SSE/UI, process/PC recovery orchestration, provider, ysna/shared-db/production/deploy를 수행하거나 완료로 기록하지 않는다. WSL을 사용하는 경우 Anvil 전용 격리 PostgreSQL 자원만 생성·검증·삭제하고, 실제 실행하지 못한 범위는 `NOT_EXECUTED` 또는 `BLOCKED`로 보고한다.
