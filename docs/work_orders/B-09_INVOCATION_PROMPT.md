# B-09 InvocationPrompt

- invocation_id: `INV-B-09-20260820-002`
- work_instruction_id: `WI-B-09-20260820-002`
- work_instruction_sha256: `59CB28881109B2FAF1FF36FFCD29F698AE3EE51C398FA1DE7955B8D3AED83E83`
- baseline_git_commit: `716398fe0a44d6dbce17c4378c78c8e9e0cb5962`
- agent_role: `developer-primary-b09`
- completion_report_path: `docs/completion_reports/B-09_COMPLETION_REPORT.md`

위 ID/hash의 R2 WorkInstruction대로 test-first 수행하라. R1 epoch-1 write→worker revoke 뒤 R2 epoch-2 worker→write fencing token과 exact 15-path allowlist를 먼저 검증한다. `APPROVAL-20260814-WORKPLAN-V16-001` successor authority binding은 Operating Rules §2의 이전 역사 표보다 우선하며, 이 rebind는 기능·요구사항·중요 위험·Developer exact15를 바꾸지 않는다. 상세 요구를 복제하지 않으며 B-09 acceptance, B-10 intervention/budget, B-11 FastAPI/BFF/SSE/UI, B-12 process/PC recovery, provider, ysna/shared-db/production/deploy를 수행하거나 완료로 기록하지 않는다. 실제 DB 검증은 이후 Anvil 전용 격리 WSL PostgreSQL 18에서만 허용하며, 시작 시점과 실행하지 못한 범위는 `NOT_EXECUTED` 또는 `BLOCKED`로 보고한다.
