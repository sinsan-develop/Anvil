# B-10 InvocationPrompt

- invocation_id: `INV-B-10-20260820-001`
- work_instruction_id: `WI-B-10-20260820-001`
- work_instruction_sha256: `A1CE280DA209D0542C8F476C83B5DFB2A08A14086BA11F38C9D210C2E983B34F`
- baseline_git_commit: `ac371f5743dce0fa87b3ee3b767d63c9c6102cd8`
- agent_role: `developer-primary-b10`
- completion_report_path: `docs/completion_reports/B-10_COMPLETION_REPORT.md`

위 ID/hash의 WorkInstruction대로 test-first 수행하라. B-09 acceptance, epoch-1 worker/write fencing token, exact15 allowlist를 먼저 확인하고 HumanInterventionReceipt·pause/resume·원자 budget reservation·quota·cancel의 framework-neutral 공통 모듈만 구현한다. 상세 요구를 복제하지 않으며 B-10 acceptance, B-11 API/BFF/SSE/UI, B-12 recovery, provider adapter, ysna/shared-db/production/deploy를 시작하거나 완료로 기록하지 않는다. 실행하지 못한 runtime은 `NOT_EXECUTED` 또는 `BLOCKED`로 보고한다.
